const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Get count of purchases
router.get('/count', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const count = await prisma.purchase.count();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unique supplier names for suggestions
router.get('/suppliers/suggestions', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany({
      select: { supplierName: true },
      distinct: ['supplierName'],
    });
    const suppliers = purchases.map(p => p.supplierName).filter(Boolean);
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new purchase (Stock In)
router.post('/', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { 
      supplierId,
      supplierName, 
      purchaseItems, 
      paymentMode, 
      paymentStatus,
      date 
    } = req.body;

    const subtotal = Number(req.body.subtotal) || 0;
    const taxTotal = Number(req.body.taxTotal) || 0;
    const totalDiscount = Number(req.body.totalDiscount) || 0;
    const grandTotal = Number(req.body.grandTotal) || 0;
    const amountPaid = Number(req.body.amountPaid) || 0;
    const balanceDue = Number(req.body.balanceDue) || 0;

    // Generate Simple Sequential Purchase Invoice Number
    const purchaseCount = await prisma.purchase.count();
    const invoiceNo = `${1001 + purchaseCount}`;

    const purchase = await prisma.$transaction(async (tx) => {
      // 1. Create the purchase record
      const newPurchase = await tx.purchase.create({
        data: {
          invoiceNo,
          supplierId,
          supplierName,
          subtotal,
          taxTotal,
          totalDiscount: totalDiscount || 0,
          grandTotal,
          amountPaid: amountPaid || 0,
          balanceDue: balanceDue || 0,
          paymentMode: paymentMode || 'CASH',
          paymentStatus: paymentStatus || 'PAID',
          date: date ? new Date(date) : new Date(),
          status: 'COMPLETED',
          purchaseItems: {
            create: purchaseItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount || 0,
              discountPercent: item.discountPercent || 0,
              taxAmount: item.taxAmount || 0,
              total: item.total
            }))
          },
          payments: amountPaid > 0 ? {
            create: {
              amount: amountPaid,
              method: paymentMode || 'CASH',
              date: date ? new Date(date) : new Date()
            }
          } : undefined
        }
      });

      // 2. Parallel Inventory Updates
      const inventoryUpdates = purchaseItems.map(item => [
        tx.product.update({
          where: { id: item.productId },
          data: { 
            stockQuantity: { increment: item.quantity },
            purchasePrice: item.price // Update master inventory price
          }
        }),
        tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            reason: `Purchase ${invoiceNo}`
          }
        })
      ]).flat();

      await Promise.all(inventoryUpdates);

      // 3. Emit real-time events for other terminals
      const io = req.app.get('io');
      if (io) {
          io.emit('INVENTORY_UPDATE', { items: purchaseItems.map(pi => ({ id: pi.productId, quantity: pi.quantity })) });
      }

      return newPurchase;
    });

    res.json(purchase);
  } catch (error) {
    console.error('Purchase Error:', error);
    res.status(500).json({ error: error.message });
  }
});
// Add payment to an existing purchase
router.post('/:id/payments', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const amount = Number(req.body.amount);
    const { method, transactionId, date } = req.body;

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }
    const updatedPurchase = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ 
        where: { id },
        include: { payments: true }
      });

      if (!purchase) throw new Error('Purchase not found');
      if (amount > purchase.balanceDue) throw new Error('Payment exceeds balance due');

      const newPaid = purchase.amountPaid + amount;
      const newBalance = purchase.grandTotal - newPaid;

      // Create payment record
      await tx.purchasePayment.create({
        data: {
          purchaseId: id,
          amount,
          method: method || 'CASH',
          transactionId,
          date: date ? new Date(date) : new Date()
        }
      });

      // Update purchase totals
      return await tx.purchase.update({
        where: { id },
        data: {
          amountPaid: newPaid,
          balanceDue: newBalance,
          paymentStatus: newBalance <= 0 ? 'PAID' : 'PARTIAL'
        }
      });
    });

    res.json(updatedPurchase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get purchase by ID
router.get('/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: req.params.id },
      include: { purchaseItems: { include: { product: true } } }
    });
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update purchase bill (with inventory reconciliation)
router.put('/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      supplierId,
      supplierName, 
      purchaseItems: newItems, 
      subtotal, 
      taxTotal, 
      totalDiscount,
      grandTotal, 
      amountPaid, 
      balanceDue, 
      paymentMode, 
      paymentStatus,
      date 
    } = req.body;

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      const oldPurchase = await tx.purchase.findUnique({
        where: { id },
        include: { purchaseItems: true }
      });

      if (!oldPurchase) throw new Error('Purchase not found');

      // 1. Validate and Filter items
      const validNewItems = newItems.filter(item => item.productId || item.id);
      
      // 2. Perform Inventory Updates Sequentially for stability
      // Reverse old items (Decrement)
      for (const item of oldPurchase.purchaseItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } }
        });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            quantity: item.quantity,
            reason: `Edit Reverse: ${oldPurchase.invoiceNo}`
          }
        });
      }

      // Apply new items (Increment)
      for (const item of validNewItems) {
        const pid = item.productId || item.id;
        await tx.product.update({
          where: { id: pid },
          data: { 
            stockQuantity: { increment: item.quantity },
            purchasePrice: item.price // Update master inventory price on edit
          }
        });
        await tx.inventoryLog.create({
          data: {
            productId: pid,
            type: 'IN',
            quantity: item.quantity,
            reason: `Edit Apply: ${oldPurchase.invoiceNo}`
          }
        });
      }

      // 3. Delete old items and record the update
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

      return await tx.purchase.update({
        where: { id },
        data: {
          supplierId,
          supplierName,
          subtotal,
          taxTotal,
          totalDiscount: totalDiscount || 0,
          grandTotal,
          amountPaid: amountPaid || 0,
          balanceDue: balanceDue || 0,
          paymentMode: paymentMode || 'CASH',
          paymentStatus: paymentStatus || 'PAID',
          date: date ? new Date(date) : undefined,
          purchaseItems: {
            create: newItems.map(item => ({
              productId: item.productId || item.id,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount || 0,
              discountPercent: item.discountPercent || 0,
              taxAmount: item.taxAmount || 0,
              total: item.total
            }))
          }
        },
        include: { purchaseItems: { include: { product: true } } }
      });
    }, { timeout: 30000 });

    res.json(updatedPurchase);
  } catch (error) {
    console.error('Update Purchase Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
