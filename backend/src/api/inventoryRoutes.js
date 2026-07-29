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
    const items = await prisma.rawMaterial.findMany({
      orderBy: { name: 'asc' }
    });
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

  try {
    const item = await prisma.rawMaterial.create({
      data: {
        name,
        unit,
        stockQuantity: parseFloat(stockQuantity) || 0,
        lowStockThreshold: parseFloat(lowStockThreshold) || 0
      }
    });
    res.json(item);
  } catch (error) {
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
    await prisma.rawMaterial.delete({
      where: { id }
    });
    res.json({ message: 'Raw material deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PURCHASE LOGS ---

// Get purchase history
router.get('/purchases', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const purchases = await prisma.rawMaterialPurchase.findMany({
      include: {
        items: true
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

// Log raw material purchase (increments stock)
router.post('/purchases', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { invoiceNo, supplierName, totalAmount, items } = req.body;
  // items: Array of { rawMaterialId, rawMaterialName, quantity, price, total }

  if (!invoiceNo || !items || items.length === 0) {
    return res.status(400).json({ error: 'Invoice number and purchase items are required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Purchase Entry
      const purchase = await tx.rawMaterialPurchase.create({
        data: {
          invoiceNo,
          supplierName,
          totalAmount: parseFloat(totalAmount) || 0,
          items: {
            create: items.map(i => ({
              rawMaterialId: i.rawMaterialId,
              rawMaterialName: i.rawMaterialName,
              quantity: parseFloat(i.quantity),
              price: parseFloat(i.price),
              total: parseFloat(i.total)
            }))
          }
        },
        include: {
          items: true
        }
      });

      // 2. Update stock for each raw material
      for (const item of items) {
        await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: {
            stockQuantity: { increment: parseFloat(item.quantity) }
          }
        });
      }

      return purchase;
    });

    res.json(result);
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
  const { finishedProductId, quantity } = req.body;
  const qtyToProduce = parseFloat(quantity);

  if (!finishedProductId || isNaN(qtyToProduce) || qtyToProduce <= 0) {
    return res.status(400).json({ error: 'Valid finished product and production quantity (>0) are required' });
  }

  try {
    // 1. Fetch recipe from RecipeMatrix
    let recipeEntries = await prisma.recipeMatrix.findMany({
      where: { finishedProductId },
      include: { rawMaterial: true }
    });

    // Fallback: check Product.recipe JSON if RecipeMatrix has no entries yet
    if (recipeEntries.length === 0) {
      const product = await prisma.product.findUnique({ where: { id: finishedProductId } });
      if (product && Array.isArray(product.recipe) && product.recipe.length > 0) {
        // Hydrate raw materials
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

    if (recipeEntries.length === 0) {
      return res.status(400).json({ error: 'Finished products cannot be produced without recipes' });
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


