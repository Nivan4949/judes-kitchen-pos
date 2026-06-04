const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Create new purchase return (Debit Note)
router.post('/', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { 
      purchaseId, 
      supplierId,
      supplierName, 
      returnItems, 
      subtotal, 
      taxTotal, 
      totalAmount, 
      reason 
    } = req.body;

    // Generate Simple Sequential Return Number
    const returnCount = await prisma.purchaseReturn.count();
    const returnNo = `${1001 + returnCount}`;

    const purchaseReturn = await prisma.$transaction(async (tx) => {
      // 1. Create the Purchase Return with items
      const newReturn = await tx.purchaseReturn.create({
        data: {
          returnNo,
          purchaseId: purchaseId || null,
          supplierId: supplierId || null,
          supplierName: supplierName || null,
          subtotal,
          taxTotal,
          totalAmount,
          reason,
          status: 'COMPLETED',
          returnItems: {
            create: returnItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              taxAmount: item.taxAmount || 0,
              total: item.total
            }))
          }
        },
        include: { returnItems: true }
      });

      // 2. Parallel Inventory Updates
      const inventoryUpdates = returnItems.map(item => [
        tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } }
        }),
        tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            quantity: item.quantity,
            reason: `Purchase Return ${returnNo}`
          }
        })
      ]).flat();

      await Promise.all(inventoryUpdates);

      return newReturn;
    }, { timeout: 15000 });

    res.json(purchaseReturn);
  } catch (error) {
    console.error('Purchase Return Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all purchase returns with filtering
router.get('/', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { startDate, endDate, filter } = req.query;
    let where = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else if (filter === 'Today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.createdAt = { gte: today };
    }

    const returns = await prisma.purchaseReturn.findMany({
      where,
      include: {
        purchase: true,
        returnItems: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate summaries
    const summary = {
      totalReturns: returns.reduce((sum, r) => sum + r.totalAmount, 0),
      count: returns.length,
      totalTax: returns.reduce((sum, r) => sum + r.taxTotal, 0)
    };

    res.json({ details: returns, summary });
  } catch (error) {
    console.error('Fetch Purchase Returns Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single return details
router.get('/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const purchaseReturn = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        purchase: true,
        returnItems: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!purchaseReturn) {
      return res.status(404).json({ error: 'Purchase return not found' });
    }
    
    res.json(purchaseReturn);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
