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

module.exports = router;

