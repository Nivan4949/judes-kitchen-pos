const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Get all suppliers
router.get('/', async (req, res) => {
  try {
    const { search, activeOnly } = req.query;
    const suppliers = await prisma.supplier.findMany({
      where: {
        AND: [
          search ? {
            OR: [
              { name: { contains: search || '', mode: 'insensitive' } },
              { phone: { contains: search || '' } },
              { gstNo: { contains: search || '', mode: 'insensitive' } }
            ]
          } : {},
          activeOnly === 'true' ? { is_active: true } : {}
        ]
      },
      orderBy: { name: 'asc' }
    });
    res.json(suppliers);
  } catch (error) {
    console.error('Error in GET /api/suppliers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create supplier
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, gstNo, address, openingBalance } = req.body;
    const supplier = await prisma.supplier.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        gstNo: gstNo || null,
        address: address || null,
        openingBalance: Number(openingBalance) || 0
      }
    });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /ledger
router.get('/:id/ledger', async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          include: { payments: true },
          orderBy: { date: 'asc' }
        },
        purchaseReturns: {
          orderBy: { date: 'asc' }
        }
      }
    });

    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

    // Construct Ledger
    let transactions = [];
    
    // 1. Opening Balance (Credit)
    transactions.push({
      date: supplier.createdAt,
      type: 'OPENING_BALANCE',
      description: 'Initial balance at onboard',
      debit: 0,
      credit: supplier.openingBalance
    });

    // 2. Purchases (Stock In) -> Increases what we owe (Credit)
    supplier.purchases.forEach(p => {
      transactions.push({
        date: p.date,
        type: 'PURCHASE',
        reference: p.invoiceNo,
        description: `Purchase Invoice: ${p.invoiceNo}`,
        debit: 0,
        credit: p.grandTotal,
        id: p.id
      });

      // Payments made against this purchase -> Decreases what we owe (Debit)
      p.payments.forEach(pay => {
         transactions.push({
            date: pay.date,
            type: 'PAYMENT',
            reference: p.invoiceNo,
            description: `Payment for ${p.invoiceNo} (${pay.method})`,
            debit: pay.amount,
            credit: 0,
            id: pay.id
         });
      });
    });

    // 3. Purchase Returns -> Decreases what we owe (Debit)
    supplier.purchaseReturns.forEach(pr => {
      transactions.push({
        date: pr.date,
        type: 'RETURN',
        reference: pr.returnNo,
        description: `Purchase Return: ${pr.returnNo}`,
        debit: pr.totalAmount,
        credit: 0,
        id: pr.id
      });
    });

    // Sort by date and calculate running balance
    transactions.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });

    let runningBalance = 0;
    const ledger = transactions.map(t => {
      runningBalance += (t.credit - t.debit);
      return { ...t, balance: runningBalance };
    });

    res.json({
      supplier: { id: supplier.id, name: supplier.name },
      summary: {
        openingBalance: supplier.openingBalance,
        currentBalance: runningBalance
      },
      ledger: ledger.reverse() // Newest first for UI
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /history
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const history = await prisma.purchase.findMany({
      where: { supplierId: id },
      include: {
        purchaseItems: {
          include: { product: true }
        }
      },
      orderBy: { date: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { date: 'desc' },
          take: 5
        }
      }
    });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update supplier
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, gstNo, address, openingBalance, is_active } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        email: email || null,
        gstNo: gstNo || null,
        address: address || null,
        openingBalance: Number(openingBalance) || 0,
        is_active
      }
    });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle inactive status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (is_active === undefined) return res.status(400).json({ message: 'is_active is required' });
    
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { is_active }
    });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete supplier (soft delete or hard delete if no relations)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check for existing purchases
    const purchasesCount = await prisma.purchase.count({ where: { supplierId: id } });
    if (purchasesCount > 0) {
       return res.status(400).json({ error: 'Cannot delete supplier with existing purchases. Please disable them instead.' });
    }

    await prisma.supplier.delete({
      where: { id }
    });
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
