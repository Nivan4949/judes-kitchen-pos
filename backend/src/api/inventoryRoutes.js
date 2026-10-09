const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Simple in-memory lock (for production use Redis or DB-based lock)
const locks = new Map();

router.post('/lock/:productId', (req, res) => {
    const { productId } = req.params;
    const { terminalId } = req.body;

    const existingLock = locks.get(productId);
    if (existingLock && existingLock.terminalId !== terminalId && Date.now() - existingLock.timestamp < 30000) {
        return res.status(423).json({ message: 'Product is being billed on another terminal' });
    }

    locks.set(productId, { terminalId, timestamp: Date.now() });
    res.json({ status: 'locked' });
});

router.post('/unlock/:productId', (req, res) => {
    const { productId } = req.params;
    const { terminalId } = req.body;

    const existingLock = locks.get(productId);
    if (existingLock && existingLock.terminalId === terminalId) {
        locks.delete(productId);
    }
    res.json({ status: 'unlocked' });
});

// --- RAW MATERIALS ENDPOINTS ---

// Get all raw materials
router.get('/raw-materials', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const items = await prisma.$queryRaw`
      SELECT "id", "name", "unit", "stockQuantity", "lowStockThreshold", "createdAt", "updatedAt"
      FROM "RawMaterial"
      WHERE COALESCE("is_active", true) = true
      ORDER BY "name" ASC
    `;
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create raw material
router.post('/raw-materials', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { name, unit, stockQuantity, lowStockThreshold } = req.body;
  if (!name || !unit) {
    return res.status(400).json({ error: 'Name and unit are required' });
  }

  const trimmedName = name.trim();

  try {
    // Check if raw material already exists (case-insensitive)
    const existing = await prisma.rawMaterial.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive'
        }
      }
    });

    const existingStatus = existing
      ? await prisma.$queryRaw`SELECT "is_active" FROM "RawMaterial" WHERE "id" = ${existing.id}`
      : [];

    if (existing && existingStatus[0]?.is_active) {
      return res.json({
        ...existing,
        alreadyExists: true,
        message: `Raw material "${existing.name}" already exists in the catalog.`
      });
    }

    if (existing) {
      await prisma.$executeRaw`
        UPDATE "RawMaterial" SET "is_active" = true WHERE "id" = ${existing.id}
      `;
      const reactivated = await prisma.rawMaterial.update({
        where: { id: existing.id },
        data: {
          unit,
          stockQuantity: parseFloat(stockQuantity) || 0,
          lowStockThreshold: parseFloat(lowStockThreshold) || 0
        }
      });
      return res.json(reactivated);
    }

    const item = await prisma.rawMaterial.create({
      data: {
        name: trimmedName,
        unit,
        stockQuantity: parseFloat(stockQuantity) || 0,
        lowStockThreshold: parseFloat(lowStockThreshold) || 0
      }
    });
    res.json(item);
  } catch (error) {
    if (error.code === 'P2002') {
      const fallback = await prisma.rawMaterial.findFirst({
        where: { name: { equals: trimmedName, mode: 'insensitive' } }
      });
      if (fallback) {
        return res.json({
          ...fallback,
          alreadyExists: true,
          message: `Raw material "${fallback.name}" already exists in the catalog.`
        });
      }
      return res.status(409).json({ error: `A raw material named "${trimmedName}" already exists.` });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update raw material
router.put('/raw-materials/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { id } = req.params;
  const { name, unit, stockQuantity, lowStockThreshold } = req.body;

  try {
    const item = await prisma.rawMaterial.update({
      where: { id },
      data: {
        name,
        unit,
        stockQuantity: stockQuantity !== undefined ? parseFloat(stockQuantity) : undefined,
        lowStockThreshold: lowStockThreshold !== undefined ? parseFloat(lowStockThreshold) : undefined
      }
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete raw material
router.delete('/raw-materials/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Remove active recipe matrix entries for this ingredient
      await tx.recipeMatrix.deleteMany({ where: { rawMaterialId: id } });

      // 2. Remove from legacy Product.recipe JSON for all products
      const legacyRecipeLinks = await tx.$queryRaw`
        SELECT "id", "recipe" FROM "Product"
        WHERE "recipe" @> ${JSON.stringify([{ rawMaterialId: id }])}::jsonb
      `;
      for (const prod of legacyRecipeLinks) {
        if (Array.isArray(prod.recipe)) {
          await tx.product.update({
            where: { id: prod.id },
            data: {
              recipe: prod.recipe.filter((item) => item.rawMaterialId !== id)
            }
          });
        }
      }

      // 3. Check if this ingredient has any transaction history (purchases, wastage, production)
      const hasPurchases = await tx.rawMaterialPurchaseItem.findFirst({ where: { rawMaterialId: id }, select: { id: true } });
      const hasWastage = await tx.wastageEntry.findFirst({ where: { rawMaterialId: id }, select: { id: true } });
      const hasProduction = await tx.productionBatchItem.findFirst({ where: { rawMaterialId: id }, select: { id: true } });

      if (!hasPurchases && !hasWastage && !hasProduction) {
        // Completely safe to delete the record
        await tx.rawMaterial.delete({ where: { id } });
      } else {
        // Soft delete / archive to keep historical purchase and wastage ledgers valid
        const archived = await tx.$executeRaw`
          UPDATE "RawMaterial" SET "is_active" = false WHERE "id" = ${id}
        `;
        if (archived === 0) {
          throw Object.assign(new Error('Ingredient not found'), { status: 404 });
        }
      }
    });
    res.json({ message: 'Ingredient removed from the active matrix' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// --- PURCHASE LOGS (Multi-Product Tax Invoice & Stock Movements) ---

function normalizeUnit(u) {
  if (!u) return 'kg';
  const s = u.toLowerCase().trim();
  if (s === 'gram' || s === 'grams' || s === 'g') return 'g';
  if (s === 'kilogram' || s === 'kilograms' || s === 'kg' || s === 'kgs') return 'kg';
  if (s === 'litre' || s === 'litres' || s === 'liter' || s === 'liters' || s === 'ltr' || s === 'l') return 'ltr';
  if (s === 'millilitre' || s === 'millilitres' || s === 'milliliter' || s === 'ml') return 'ml';
  if (s === 'piece' || s === 'pieces' || s === 'pcs' || s === 'pc') return 'pcs';
  return s;
}

function convertToStandardUnit(quantity, fromUnit, toUnit) {
  const q = parseFloat(quantity) || 0;
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!from || !to || from === to) return q;

  // Weight
  if (from === 'g' && to === 'kg') return q / 1000;
  if (from === 'kg' && to === 'g') return q * 1000;

  // Volume
  if (from === 'ml' && to === 'ltr') return q / 1000;
  if (from === 'ltr' && to === 'ml') return q * 1000;

  return q;
}

// Get purchase history with search, supplier, status, and date filters
router.get('/purchases', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { search, supplier, startDate, endDate, status } = req.query;
    const where = {};

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { supplierGstin: { contains: search, mode: 'insensitive' } },
        { items: { some: { rawMaterialName: { contains: search, mode: 'insensitive' } } } }
      ];
    }

    if (supplier) {
      where.OR = [
        { supplierId: supplier },
        { supplierName: { contains: supplier, mode: 'insensitive' } }
      ];
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const purchases = await prisma.rawMaterialPurchase.findMany({
      where,
      include: {
        items: {
          include: {
            rawMaterial: {
              select: { id: true, name: true, unit: true, stockQuantity: true }
            }
          }
        },
        supplier: true,
        stockMovements: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate next reference invoice number
router.get('/purchases/next-invoice', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const [result] = await prisma.$queryRaw`
      SELECT COALESCE(
        MAX(NULLIF(SUBSTRING("invoiceNo" FROM '^PUR-([0-9]+)$'), '')::INTEGER),
        1000
      ) + 1 AS "nextNumber"
      FROM "RawMaterialPurchase"
    `;
    res.json({ invoiceNo: `PUR-${Number(result.nextNumber)}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single purchase details
router.get('/purchases/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await prisma.rawMaterialPurchase.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            rawMaterial: {
              select: { id: true, name: true, unit: true, stockQuantity: true }
            }
          }
        },
        supplier: true,
        stockMovements: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    res.json(purchase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Log multi-product raw material purchase (increments stock with unit conversions & stock movements)
router.post('/purchases', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { 
    invoiceNo, 
    supplierId,
    supplierName, 
    supplierGstin,
    date,
    subtotal,
    taxTotal,
    cgst,
    sgst,
    igst,
    discount,
    totalAmount,
    paymentMode,
    paymentStatus,
    attachmentUrl,
    attachmentName,
    attachmentType,
    notes,
    items 
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one purchase product is required' });
  }

  // Validate item entries
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const qty = parseFloat(item.quantity);
    const price = parseFloat(item.price);
    if (!item.rawMaterialId && !item.rawMaterialName?.trim()) {
      return res.status(400).json({ error: `Product at row #${i + 1} requires an ingredient name` });
    }
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: `Valid positive quantity required for product #${i + 1}` });
    }
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: `Valid rate per unit required for product #${i + 1}` });
    }
  }

  try {
    let finalInvoiceNo = (invoiceNo || '').trim();

    // Check if the provided invoice number already exists
    let invoiceExists = false;
    if (finalInvoiceNo) {
      const existing = await prisma.rawMaterialPurchase.findUnique({
        where: { invoiceNo: finalInvoiceNo },
        select: { id: true }
      });
      invoiceExists = !!existing;
    }

    // Auto-generate invoice number if missing or if a system PUR-xxxx invoice conflicted
    if (!finalInvoiceNo || (invoiceExists && /^PUR-\d+$/i.test(finalInvoiceNo))) {
      const [result] = await prisma.$queryRaw`
        SELECT COALESCE(
          MAX(NULLIF(SUBSTRING("invoiceNo" FROM '^PUR-([0-9]+)$'), '')::INTEGER),
          1000
        ) + 1 AS "nextNumber"
        FROM "RawMaterialPurchase"
      `;
      finalInvoiceNo = `PUR-${Number(result.nextNumber)}`;
    } else if (invoiceExists) {
      return res.status(409).json({
        error: `Invoice number "${finalInvoiceNo}" is already in use. Please enter a different invoice number.`
      });
    }

    const purchaseDate = date ? new Date(date) : new Date();

    // Determine supplier linkage
    let resolvedSupplierId = supplierId || null;
    let resolvedSupplierName = (supplierName || '').trim();
    let resolvedSupplierGst = (supplierGstin || '').trim();

    if (resolvedSupplierId) {
      const s = await prisma.supplier.findUnique({ where: { id: resolvedSupplierId } });
      if (s) {
        resolvedSupplierName = s.name;
        if (!resolvedSupplierGst && s.gstNo) resolvedSupplierGst = s.gstNo;
      }
    } else if (resolvedSupplierName) {
      const existingSupplier = await prisma.supplier.findFirst({
        where: { name: { equals: resolvedSupplierName, mode: 'insensitive' } }
      });
      if (existingSupplier) {
        resolvedSupplierId = existingSupplier.id;
        if (!resolvedSupplierGst && existingSupplier.gstNo) resolvedSupplierGst = existingSupplier.gstNo;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Process items and resolve ingredients
      const processedItems = [];
      const stockUpdates = [];

      for (const item of items) {
        let rawMaterial = null;

        if (item.rawMaterialId) {
          rawMaterial = await tx.rawMaterial.findUnique({
            where: { id: item.rawMaterialId }
          });
        }

        if (!rawMaterial && item.rawMaterialName?.trim()) {
          rawMaterial = await tx.rawMaterial.findFirst({
            where: { name: { equals: item.rawMaterialName.trim(), mode: 'insensitive' } }
          });
        }

        // Create new ingredient if not found
        if (!rawMaterial && item.rawMaterialName?.trim()) {
          const standardUnit = normalizeUnit(item.unit || 'kg');
          rawMaterial = await tx.rawMaterial.create({
            data: {
              name: item.rawMaterialName.trim(),
              unit: standardUnit,
              stockQuantity: 0,
              lowStockThreshold: 0
            }
          });
        }

        if (!rawMaterial) {
          throw new Error(`Unable to resolve ingredient "${item.rawMaterialName || item.rawMaterialId}"`);
        }

        const purchaseUnit = normalizeUnit(item.unit || rawMaterial.unit);
        const standardUnit = normalizeUnit(rawMaterial.unit);
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.price);
        const standardQty = convertToStandardUnit(qty, purchaseUnit, standardUnit);

        const itemSubtotal = parseFloat(item.subtotal) || (qty * price);
        const itemTaxPercent = parseFloat(item.taxPercent) || 0;
        const itemTaxAmount = parseFloat(item.taxAmount) || (itemSubtotal * itemTaxPercent / 100);
        const itemTotal = parseFloat(item.total) || (itemSubtotal + itemTaxAmount);

        const prevStock = rawMaterial.stockQuantity;
        const nextStock = prevStock + standardQty;

        processedItems.push({
          rawMaterialId: rawMaterial.id,
          rawMaterialName: rawMaterial.name,
          quantity: qty,
          unit: purchaseUnit,
          price: price,
          subtotal: itemSubtotal,
          taxPercent: itemTaxPercent,
          taxAmount: itemTaxAmount,
          total: itemTotal,
          standardQuantity: standardQty
        });

        stockUpdates.push({
          rawMaterialId: rawMaterial.id,
          standardQty,
          previousStock: prevStock,
          newStock: nextStock,
          notes: `Procured ${qty} ${purchaseUnit} @ ₹${price}/${purchaseUnit} (${standardQty} ${standardUnit})`
        });
      }

      // Calculate totals if not provided
      const calcSubtotal = processedItems.reduce((acc, it) => acc + it.subtotal, 0);
      const calcTaxTotal = processedItems.reduce((acc, it) => acc + it.taxAmount, 0);
      const calcGrandTotal = calcSubtotal + calcTaxTotal - (parseFloat(discount) || 0);

      // 2. Create Purchase Record
      const purchase = await tx.rawMaterialPurchase.create({
        data: {
          invoiceNo: finalInvoiceNo,
          supplierId: resolvedSupplierId,
          supplierName: resolvedSupplierName || 'General',
          supplierGstin: resolvedSupplierGst || null,
          date: purchaseDate,
          subtotal: parseFloat(subtotal) || calcSubtotal,
          taxTotal: parseFloat(taxTotal) || calcTaxTotal,
          cgst: parseFloat(cgst) || (calcTaxTotal / 2),
          sgst: parseFloat(sgst) || (calcTaxTotal / 2),
          igst: parseFloat(igst) || 0,
          discount: parseFloat(discount) || 0,
          totalAmount: parseFloat(totalAmount) || calcGrandTotal,
          paymentMode: paymentMode || 'CASH',
          paymentStatus: paymentStatus || 'PAID',
          status: 'COMPLETED',
          attachmentUrl: attachmentUrl || null,
          attachmentName: attachmentName || null,
          attachmentType: attachmentType || null,
          notes: notes || null,
          items: {
            create: processedItems
          }
        },
        include: {
          items: true
        }
      });

      // 3. Atomically update stock & log stock movements
      for (const update of stockUpdates) {
        await tx.rawMaterial.update({
          where: { id: update.rawMaterialId },
          data: {
            stockQuantity: { increment: update.standardQty }
          }
        });

        await tx.stockMovement.create({
          data: {
            rawMaterialId: update.rawMaterialId,
            purchaseId: purchase.id,
            type: 'PURCHASE',
            quantity: update.standardQty,
            unit: update.notes.split('(')[1]?.replace(')', '') || 'kg',
            previousStock: update.previousStock,
            newStock: update.newStock,
            reference: finalInvoiceNo,
            notes: update.notes,
            date: purchaseDate
          }
        });
      }

      return purchase;
    });

    res.json(result);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: `Invoice number is already in use. Please refresh and try again.` });
    }
    console.error('Error recording purchase:', error);
    res.status(500).json({ error: error.message });
  }
});

// Safe cancellation / reversal of purchase
router.post('/purchases/:id/cancel', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const purchase = await prisma.rawMaterialPurchase.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase record not found' });
    }

    if (purchase.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Purchase is already cancelled' });
    }

    const cancelledPurchase = await prisma.$transaction(async (tx) => {
      // 1. Mark status cancelled
      const updated = await tx.rawMaterialPurchase.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: (purchase.notes ? purchase.notes + ' | ' : '') + `Cancelled: ${reason || 'User cancelled'}`
        }
      });

      // 2. Safely decrement stock and record reversal movements
      for (const item of purchase.items) {
        const qtyToRevert = item.standardQuantity || item.quantity;
        const raw = await tx.rawMaterial.findUnique({ where: { id: item.rawMaterialId } });
        if (raw) {
          const prev = raw.stockQuantity;
          const next = prev - qtyToRevert;
          await tx.rawMaterial.update({
            where: { id: item.rawMaterialId },
            data: { stockQuantity: { decrement: qtyToRevert } }
          });

          await tx.stockMovement.create({
            data: {
              rawMaterialId: item.rawMaterialId,
              purchaseId: purchase.id,
              type: 'REVERSAL',
              quantity: -qtyToRevert,
              unit: raw.unit,
              previousStock: prev,
              newStock: next,
              reference: purchase.invoiceNo,
              notes: `Purchase cancellation reversal: ${reason || 'Manual reversal'}`,
              date: new Date()
            }
          });
        }
      }

      return updated;
    });

    res.json(cancelledPurchase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- WASTAGE LOGS ---

// Get wastage history
router.get('/wastage', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const logs = await prisma.wastageEntry.findMany({
      orderBy: {
        date: 'desc'
      }
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Log wastage (decrements stock)
router.post('/wastage', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { rawMaterialId, rawMaterialName, quantity, reason } = req.body;

  if (!rawMaterialId || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Raw material and valid quantity are required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.wastageEntry.create({
        data: {
          rawMaterialId,
          rawMaterialName,
          quantity: parseFloat(quantity),
          reason
        }
      });

      await tx.rawMaterial.update({
        where: { id: rawMaterialId },
        data: {
          stockQuantity: { decrement: parseFloat(quantity) }
        }
      });

      return log;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- RECIPE MATRIX ENDPOINTS ---

// Get all recipe matrix items
router.get('/recipe-matrix', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const recipes = await prisma.recipeMatrix.findMany({
      include: {
        finishedProduct: true,
        rawMaterial: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get products eligible for production (products that have a recipe mapped)
router.get('/recipe-matrix/eligible-products', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        is_active: true,
        recipeMatrix: { some: {} }
      },
      include: {
        recipeMatrix: {
          include: { rawMaterial: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save / Update recipe matrix for a finished product
router.post('/recipe-matrix', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { finishedProductId, items } = req.body;
  // items: Array of { rawMaterialId, quantityRequired, unit }

  if (!finishedProductId) {
    return res.status(400).json({ error: 'Finished product ID is required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete existing recipe matrix entries for this product
      await tx.recipeMatrix.deleteMany({
        where: { finishedProductId }
      });

      // 2. Create new recipe matrix entries if valid items provided
      const validItems = (items || []).filter(i => i.rawMaterialId && parseFloat(i.quantityRequired) > 0);
      if (validItems.length > 0) {
        await tx.recipeMatrix.createMany({
          data: validItems.map(i => ({
            finishedProductId,
            rawMaterialId: i.rawMaterialId,
            quantityRequired: parseFloat(i.quantityRequired),
            unit: i.unit || 'kg'
          }))
        });
      }

      // 3. Keep Product.recipe JSON field synchronized for backward compatibility
      const jsonRecipe = validItems.map(i => ({
        rawMaterialId: i.rawMaterialId,
        quantity: parseFloat(i.quantityRequired),
        unit: i.unit || 'kg'
      }));
      await tx.product.update({
        where: { id: finishedProductId },
        data: { recipe: jsonRecipe }
      });

      return tx.recipeMatrix.findMany({
        where: { finishedProductId },
        include: { rawMaterial: true, finishedProduct: true }
      });
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove single ingredient from a product recipe
router.delete('/recipe-matrix/:productId/:rawMaterialId', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { productId, rawMaterialId } = req.params;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.recipeMatrix.deleteMany({
        where: { finishedProductId: productId, rawMaterialId }
      });
      const prod = await tx.product.findUnique({
        where: { id: productId },
        select: { recipe: true }
      });
      if (Array.isArray(prod?.recipe)) {
        await tx.product.update({
          where: { id: productId },
          data: {
            recipe: prod.recipe.filter(r => r.rawMaterialId !== rawMaterialId)
          }
        });
      }
    });
    res.json({ message: 'Ingredient removed from recipe successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all ingredients from a product recipe
router.delete('/recipe-matrix/:productId', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { productId } = req.params;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.recipeMatrix.deleteMany({
        where: { finishedProductId: productId }
      });
      await tx.product.update({
        where: { id: productId },
        data: { recipe: [] }
      });
    });
    res.json({ message: 'Recipe cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- FINISHED PRODUCTS PRODUCTION ENDPOINTS ---

// Get production batch history
router.get('/production-history', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const history = await prisma.productionBatch.findMany({
      include: {
        finishedProduct: true,
        items: {
          include: { rawMaterial: true }
        }
      },
      orderBy: { producedAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Produce Finished Product (Consumes raw materials, increases product stock)
router.post('/produce', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  const { finishedProductId, quantity, customItems } = req.body;
  const qtyToProduce = parseFloat(quantity);

  if (!finishedProductId || isNaN(qtyToProduce) || qtyToProduce <= 0) {
    return res.status(400).json({ error: 'Valid finished product and production quantity (>0) are required' });
  }

  try {
    let recipeEntries = [];

    // 1. If customItems provided (Custom / On-the-fly Production), use custom ingredient entries
    if (Array.isArray(customItems) && customItems.length > 0) {
      const customRawIds = customItems.map(c => c.rawMaterialId).filter(Boolean);
      const customRaws = await prisma.rawMaterial.findMany({ where: { id: { in: customRawIds } } });
      const customRawsMap = {};
      customRaws.forEach(rm => { customRawsMap[rm.id] = rm; });

      recipeEntries = customItems.map(c => {
        const rm = customRawsMap[c.rawMaterialId];
        const totalConsumed = c.quantityConsumed !== undefined ? parseFloat(c.quantityConsumed) : (parseFloat(c.quantityRequired || 0) * qtyToProduce);
        const reqPerUnit = qtyToProduce > 0 ? (totalConsumed / qtyToProduce) : 0;
        return {
          rawMaterialId: c.rawMaterialId,
          rawMaterial: rm,
          quantityRequired: reqPerUnit,
          unit: c.unit || rm?.unit || 'kg'
        };
      }).filter(r => r.rawMaterial && r.quantityRequired > 0);
    } else {
      // Fallback 1a: Fetch recipe from RecipeMatrix
      recipeEntries = await prisma.recipeMatrix.findMany({
        where: { finishedProductId },
        include: { rawMaterial: true }
      });

      // Fallback 1b: Check Product.recipe JSON if RecipeMatrix has no entries yet
      if (recipeEntries.length === 0) {
        const product = await prisma.product.findUnique({ where: { id: finishedProductId } });
        if (product && Array.isArray(product.recipe) && product.recipe.length > 0) {
          const rawIds = product.recipe.map(r => r.rawMaterialId);
          const rawMaterialsMap = {};
          const raws = await prisma.rawMaterial.findMany({ where: { id: { in: rawIds } } });
          raws.forEach(rm => { rawMaterialsMap[rm.id] = rm; });

          recipeEntries = product.recipe.map(r => ({
            rawMaterialId: r.rawMaterialId,
            rawMaterial: rawMaterialsMap[r.rawMaterialId],
            quantityRequired: parseFloat(r.quantity),
            unit: r.unit || rawMaterialsMap[r.rawMaterialId]?.unit || 'kg'
          })).filter(r => r.rawMaterial);
        }
      }
    }

    if (recipeEntries.length === 0) {
      return res.status(400).json({ error: 'Finished products cannot be produced without valid ingredients/recipes' });
    }

    // 2. Validate stock availability for all raw material ingredients
    const rawIds = recipeEntries.map(r => r.rawMaterialId);
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: { id: { in: rawIds } }
    });

    const stockMap = {};
    rawMaterials.forEach(rm => { stockMap[rm.id] = rm; });

    const insufficient = [];
    const consumptionPlan = [];

    for (const entry of recipeEntries) {
      const rm = stockMap[entry.rawMaterialId];
      const required = entry.quantityRequired * qtyToProduce;
      const available = rm ? rm.stockQuantity : 0;

      if (!rm || available < required) {
        insufficient.push({
          ingredient: rm ? rm.name : 'Unknown Ingredient',
          available: available,
          required: required,
          unit: entry.unit || rm?.unit || 'kg'
        });
      }

      consumptionPlan.push({
        rawMaterialId: entry.rawMaterialId,
        rawMaterialName: rm ? rm.name : 'Ingredient',
        quantityConsumed: required
      });
    }

    if (insufficient.length > 0) {
      return res.status(400).json({
        error: 'Insufficient stock for production',
        insufficient
      });
    }

    // 3. Execute Production Transaction
    const result = await prisma.$transaction(async (tx) => {
      // a. Deduct raw materials stock
      for (const item of consumptionPlan) {
        await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: { stockQuantity: { decrement: item.quantityConsumed } }
        });

        // Audit log for raw material deduction
        await tx.inventoryLog.create({
          data: {
            productId: finishedProductId,
            type: 'PRODUCTION_CONSUMPTION',
            quantity: -item.quantityConsumed,
            reason: `Consumed in production batch for product ID ${finishedProductId}`
          }
        });
      }

      // b. Increase finished product stock
      const updatedProduct = await tx.product.update({
        where: { id: finishedProductId },
        data: { stockQuantity: { increment: qtyToProduce } }
      });

      // Audit log for finished product increase
      await tx.inventoryLog.create({
        data: {
          productId: finishedProductId,
          type: 'PRODUCTION_OUTPUT',
          quantity: qtyToProduce,
          reason: `Produced ${qtyToProduce} pcs via Finished Products Production`
        }
      });

      // c. Create Production Batch record
      const batchNo = `BATCH-${Date.now().toString().slice(-6)}`;
      const batch = await tx.productionBatch.create({
        data: {
          batchNo,
          finishedProductId,
          quantityProduced: qtyToProduce,
          createdBy: req.user?.name || 'Staff',
          items: {
            create: consumptionPlan.map(cp => ({
              rawMaterialId: cp.rawMaterialId,
              quantityConsumed: cp.quantityConsumed
            }))
          }
        },
        include: {
          finishedProduct: true,
          items: { include: { rawMaterial: true } }
        }
      });

      return { batch, updatedProduct };
    });

    res.json({
      message: 'Production completed successfully',
      batch: result.batch,
      updatedProduct: result.updatedProduct
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SHOP CLOSE & WASTED STOCK EXPENSE ENDPOINTS ---

// Preview Shop Close clearance (Finished products to clear & expected wasted expense)
router.get('/shop-close/preview', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const productsToClear = await prisma.product.findMany({
      where: { stockQuantity: { gt: 0 } },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        purchasePrice: true,
        sellingPrice: true,
        unit: true
      }
    });

    let totalStockValue = 0;
    const items = productsToClear.map(p => {
      const cost = p.purchasePrice || p.sellingPrice || 0;
      const itemValue = p.stockQuantity * cost;
      totalStockValue += itemValue;
      return {
        ...p,
        cost,
        itemValue
      };
    });

    res.json({
      productsToClear: items,
      totalCount: items.length,
      totalStockValue
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute Shop Close clearance
router.post('/shop-close', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch all finished products with positive stock
      const productsToClear = await tx.product.findMany({
        where: { stockQuantity: { gt: 0 } }
      });

      if (productsToClear.length === 0) {
        return {
          clearedCount: 0,
          totalWastedStockExpense: 0,
          expense: null,
          message: 'No finished product stock available to clear.'
        };
      }

      // 2. Calculate wasted stock expense details
      let totalWastedStockExpense = 0;
      const descriptionLines = [];

      for (const prod of productsToClear) {
        const cost = prod.purchasePrice || prod.sellingPrice || 0;
        const lineTotal = prod.stockQuantity * cost;
        totalWastedStockExpense += lineTotal;
        descriptionLines.push(`${prod.name} (${prod.stockQuantity} ${prod.unit || 'pcs'} @ ₹${cost.toFixed(2)}) = ₹${lineTotal.toFixed(2)}`);

        // Log inventory movement for each cleared product
        await tx.inventoryLog.create({
          data: {
            productId: prod.id,
            type: 'SHOP_CLOSE_CLEARANCE',
            quantity: -prod.stockQuantity,
            reason: `Shop Close stock clearance: ${prod.stockQuantity} pcs wasted`
          }
        });
      }

      // 3. Reset ALL finished products stock to 0 (Raw Materials remain completely untouched)
      await tx.product.updateMany({
        where: { stockQuantity: { gt: 0 } },
        data: { stockQuantity: 0 }
      });

      // 4. Create Wasted Stock Expense record
      let expenseRecord = null;
      if (totalWastedStockExpense > 0) {
        const fullDesc = `Shop Close Stock Clearance:\n` + descriptionLines.join('\n');
        expenseRecord = await tx.expense.create({
          data: {
            type: 'Wasted Stock',
            amount: totalWastedStockExpense,
            description: fullDesc,
            date: new Date()
          }
        });
      }

      return {
        clearedCount: productsToClear.length,
        totalWastedStockExpense,
        expense: expenseRecord,
        clearedProducts: productsToClear.map(p => ({ id: p.id, name: p.name, clearedQty: p.stockQuantity }))
      };
    });

    res.json({
      message: 'Shop Close completed successfully. Unsold finished products cleared to Wasted Stock.',
      ...result
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
