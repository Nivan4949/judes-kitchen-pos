const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Get active shift for a cashier
router.get('/active', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const activeShift = await prisma.shift.findFirst({
      where: {
        cashierId: req.user.id,
        status: 'OPEN'
      }
    });
    
    if (!activeShift) {
      return res.json({ active: false });
    }

    // Calculate live totals for the active shift
    const stats = await getShiftStats(activeShift.cashierId, activeShift.openingTime);
    res.json({
      active: true,
      shift: {
        ...activeShift,
        ...stats
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all shift closing reports (Admin/Manager only)
router.get('/history', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      orderBy: {
        openingTime: 'desc'
      }
    });
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Open a new shift
router.post('/open', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  const { openingCash } = req.body;
  if (openingCash === undefined || openingCash < 0) {
    return res.status(400).json({ error: 'Valid opening cash is required' });
  }

  try {
    // Check if shift is already open for this user
    const existing = await prisma.shift.findFirst({
      where: {
        cashierId: req.user.id,
        status: 'OPEN'
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'A shift is already open for this user.' });
    }

    const newShift = await prisma.shift.create({
      data: {
        cashierId: req.user.id,
        cashierName: req.user.name,
        openingCash: parseFloat(openingCash),
        status: 'OPEN'
      }
    });

    res.json(newShift);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close active shift
router.post('/close', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  const { actualClosingCash, notes } = req.body;

  if (actualClosingCash === undefined || actualClosingCash < 0) {
    return res.status(400).json({ error: 'Actual closing cash is required' });
  }

  try {
    const activeShift = await prisma.shift.findFirst({
      where: {
        cashierId: req.user.id,
        status: 'OPEN'
      }
    });

    if (!activeShift) {
      return res.status(404).json({ error: 'No active shift found to close' });
    }

    const stats = await getShiftStats(activeShift.cashierId, activeShift.openingTime);
    const expectedClosingCash = activeShift.openingCash + stats.cashSales - stats.expenses - stats.refunds;
    const differenceAmount = parseFloat(actualClosingCash) - expectedClosingCash;

    const closedShift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        status: 'CLOSED',
        closingTime: new Date(),
        cashSales: stats.cashSales,
        upiSales: stats.upiSales,
        cardSales: stats.cardSales,
        creditSales: stats.creditSales,
        expenses: stats.expenses,
        refunds: stats.refunds,
        discounts: stats.discounts,
        expectedClosingCash,
        actualClosingCash: parseFloat(actualClosingCash),
        differenceAmount,
        notes: notes || null
      }
    });

    res.json(closedShift);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to calculate sales, expenses, discounts, and refunds for a shift time window
async function getShiftStats(cashierId, openingTime) {
  // 1. Get orders created by this cashier during shift
  const orders = await prisma.order.findMany({
    where: {
      creatorId: cashierId,
      createdAt: { gte: openingTime }
    },
    include: {
      payments: true
    }
  });

  let cashSales = 0;
  let upiSales = 0;
  let cardSales = 0;
  let creditSales = 0;
  let discounts = 0;

  orders.forEach(order => {
    discounts += order.discount || 0;
    creditSales += order.balance || 0;

    order.payments.forEach(payment => {
      if (payment.status === 'SUCCESS') {
        const method = payment.method.toUpperCase();
        if (method === 'CASH') cashSales += payment.amount;
        else if (method === 'UPI') upiSales += payment.amount;
        else if (method === 'CARD') cardSales += payment.amount;
      }
    });
  });

  // 2. Get expenses recorded after shift opening (usually paid from drawer cash)
  const expensesList = await prisma.expense.findMany({
    where: {
      createdAt: { gte: openingTime }
    }
  });
  const expenses = expensesList.reduce((sum, e) => sum + e.amount, 0);

  // 3. Get refunds (e.g. sales returns with cash refund)
  const refundsList = await prisma.salesReturn.findMany({
    where: {
      createdAt: { gte: openingTime }
    }
  });
  const refunds = refundsList.reduce((sum, r) => sum + r.totalAmount, 0);

  return {
    cashSales,
    upiSales,
    cardSales,
    creditSales,
    expenses,
    refunds,
    discounts
  };
}

module.exports = router;
