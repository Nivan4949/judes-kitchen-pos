const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Get all purchase orders
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, supplierId, status } = req.query;
    
    const whereClause = {};
    if (startDate && endDate) {
      whereClause.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }
    if (supplierId) whereClause.supplierId = supplierId;
    if (status) whereClause.status = status;

    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    const pos = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        supplier: true,
        poItems: {
          include: { product: true }
        }
      },
      orderBy: { date: 'desc' },
      take: limit
    });
    
    res.json(pos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Purchase Order
router.post('/', async (req, res) => {
  try {
    const { 
      supplierId, 
      supplierName, 
      subtotal, 
      taxTotal, 
      totalDiscount, 
      grandTotal, 
      expectedDate,
      poItems 
    } = req.body;

    // Generate PO Number
    const count = await prisma.purchaseOrder.count() + 1;
    const poNumber = `${1000 + count}`;

    const newPO = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        supplierName,
        subtotal,
        taxTotal,
        totalDiscount,
        grandTotal,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        status: 'PENDING',
        poItems: {
          create: poItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount || 0,
            discountPercent: item.discountPercent || 0,
            taxAmount: item.taxAmount || 0,
            total: item.total
          }))
        }
      },
      include: { poItems: true, supplier: true }
    });

    res.status(201).json(newPO);
  } catch (error) {
    console.error('Error creating PO:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update Status (Cancel or Convert)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete PO (Only if PENDING)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return res.status(404).json({ error: 'Not found' });
    if (po.status !== 'PENDING') return res.status(400).json({ error: 'Can only delete PENDING orders' });

    // Delete items first
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    await prisma.purchaseOrder.delete({ where: { id } });
    
    res.json({ message: 'PO deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
