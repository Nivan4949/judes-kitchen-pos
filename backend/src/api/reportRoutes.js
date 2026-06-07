const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');
const whatsappUtil = require('../utils/whatsappUtil');

// Global error registry for remote debugging (BLACK BOX)
let errorLog = [];
function logError(context, err) {
  errorLog.unshift({ time: new Date().toISOString(), context, message: err?.message || 'Unknown', stack: err?.stack });
  if (errorLog.length > 50) errorLog.pop();
  console.error(`[BLACK BOX] ${context}:`, err);
}
module.exports.logError = logError; // Export for orderRoutes.js

// Helper to handle date filters with Timezone awareness
const getDateRange = (filter, startDate, endDate, timezoneOffset = 0) => {
  // timezoneOffset is in minutes (e.g. -330 for IST)
  const now = new Date();
  
  // Calculate start and end in client's local time
  let start = new Date(now.getTime() - (timezoneOffset * 60000));
  start.setUTCHours(0, 0, 0, 0);
  let end = new Date(now.getTime() - (timezoneOffset * 60000));
  end.setUTCHours(23, 59, 59, 999);

  if (filter === 'Today') {
    // Already set to local today
  } else if (filter === 'Week') {
    start.setUTCDate(start.getUTCDate() - 7);
  } else if (filter === 'Month') {
    start.setUTCDate(start.getUTCDate() - 30);
  } else if (filter === 'Custom' && startDate && endDate) {
    start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
  } else {
    start = new Date('2020-01-01');
  }

  // Convert back to UTC for Prisma/Database query
  const queryStart = new Date(start.getTime() + (timezoneOffset * 60000));
  const queryEnd = new Date(end.getTime() + (timezoneOffset * 60000));

  return { gte: queryStart, lte: queryEnd };
};

// 0. Dashboard Summary for Admin
router.get('/summary', async (req, res) => {
  try {
    const totalRevenue = await prisma.order.aggregate({
      _sum: { grandTotal: true }
    });
    const totalOrders = await prisma.order.count();
    const lowStockAlerts = await prisma.product.count({
      where: { stockQuantity: { lt: 10 } }
    });
    const activeTerminals = await prisma.device.count({
      where: { authorized: true }
    });
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { 
        orderItems: { include: { product: true } },
        payments: true 
      }
    });

    // Top Selling Categories for Distribution
    const categorySales = await prisma.orderItem.findMany({
      include: { product: { include: { category: true } } }
    });

    const distributionMap = {};
    categorySales.forEach(item => {
      const catName = item.product?.category?.name || 'Uncategorized';
      distributionMap[catName] = (distributionMap[catName] || 0) + item.total;
    });

    const distribution = Object.entries(distributionMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    res.json({
      totalRevenue: Number(totalRevenue._sum?.grandTotal || 0),
      totalOrders,
      lowStockAlerts,
      activeTerminals,
      recentOrders,
      distribution,
      lastSync: recentOrders[0]?.createdAt || new Date()
    });
  } catch (error) {
    console.warn('Dashboard summary fallback triggered:', error.message);
    try {
      const rawRev = await prisma.$queryRaw`SELECT SUM("grandTotal") as total FROM "Order"`;
      const rawCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Order"`;
      const rawLow = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Product" WHERE "stockQuantity" < 10`;
      const rawRecent = await prisma.$queryRaw`
        SELECT CAST(o.id AS TEXT) as id, o."invoiceNo", o."grandTotal", o."createdAt", c.name as "customerName"
        FROM "Order" o
        LEFT JOIN "Customer" c ON o."customerId" = c.id
        ORDER BY o."createdAt" DESC LIMIT 10
      `;
      
      res.json({
        totalRevenue: Number(rawRev[0]?.total || 0),
        totalOrders: Number(rawCount[0]?.count || 0),
        lowStockAlerts: Number(rawLow[0]?.count || 0),
        recentOrders: rawRecent.map(r => ({
           id: r.id, invoiceNo: r.invoiceNo, grandTotal: r.grandTotal, createdAt: r.createdAt,
           customer: { name: r.customerName || 'Walk-in' }
        })),
        distribution: [],
        lastSync: new Date()
      });
    } catch (err) {
      res.status(500).json({ error: 'Critical dashboard failure' });
    }
  }
});

// 1. Sale Report
router.get('/sales', async (req, res) => {
  try {
    const { filter, startDate, endDate, timezoneOffset } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate, parseInt(timezoneOffset || 0));
    
    let sales = [];
    try {
      sales = await prisma.order.findMany({
        where: { createdAt: dateRange },
        include: { customer: true, payments: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (err) {
      console.warn('Prisma sales query failed, falling back to raw SQL:', err.message);
      // Fallback to basic columns that existed prior to creatorId update
      sales = await prisma.$queryRaw`
        SELECT 
          CAST(o.id AS TEXT) as id, CAST(o."serverId" AS TEXT) as "serverId", o."invoiceNo", CAST(o."customerId" AS TEXT) as "customerId", o."grandTotal", o."taxTotal", o."paymentMode", o."createdAt",
          c.name as "customerName"
        FROM "Order" o
        LEFT JOIN "Customer" c ON o."customerId" = c.id
        WHERE o."createdAt" >= ${dateRange.gte} AND o."createdAt" <= ${dateRange.lte}
        ORDER BY o."createdAt" DESC
      `;
      // Normalize raw results to match Prisma object structure for frontend
      sales = sales.map(s => ({
        ...s,
        customer: s.customerName ? { id: s.customerId, name: s.customerName } : null
      }));
    }
    
    const summary = {
      totalSales: sales.reduce((sum, order) => sum + (Number(order.grandTotal) || 0), 0),
      totalTax: sales.reduce((sum, order) => sum + (Number(order.taxTotal) || 0), 0),
      billCount: sales.length,
      cashReceived: sales.filter(o => o.paymentMode === 'CASH').reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0),
      upiReceived: sales.filter(o => o.paymentMode === 'UPI').reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0),
      cardReceived: sales.filter(o => o.paymentMode === 'CARD').reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0)
    };
    res.json({ summary, details: sales });
  } catch (error) { 
    console.error('Final Sales Report Error:', error);
    res.status(500).json({ error: error.message }); 
  }
});

// 1.05 Credit Sales Report (Outstanding Payments)
router.get('/credit-sales', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate);
    
    let credits = [];
    try {
      credits = await prisma.order.findMany({
        where: { 
          createdAt: dateRange,
          balance: { gt: 0 }
        },
        include: { customer: true, payments: true }
      });
    } catch (err) {
      console.warn('Credit sales fallback:', err.message);
      credits = await prisma.$queryRaw`
        SELECT 
          CAST(o.id AS TEXT) as id, o."invoiceNo", CAST(o."customerId" AS TEXT) as "customerId", 
          o."grandTotal", o."amountPaid", o.balance, o."createdAt",
          c.name as "customerName"
        FROM "Order" o
        LEFT JOIN "Customer" c ON o."customerId" = c.id
        WHERE o.balance > 0 AND o."createdAt" >= ${dateRange.gte} AND o."createdAt" <= ${dateRange.lte}
      `;
      credits = credits.map(c => ({
        ...c,
        customer: c.customerName ? { id: c.customerId, name: c.customerName } : null
      }));
    }
    
    const summary = {
      totalOutstanding: credits.reduce((sum, order) => sum + (Number(order.balance) || 0), 0),
      totalBilled: credits.reduce((sum, order) => sum + (Number(order.grandTotal) || 0), 0),
      totalPaid: credits.reduce((sum, order) => sum + (Number(order.amountPaid) || 0), 0),
      billCount: credits.length
    };
    
    res.json({ summary, details: credits });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 1.1 Payment Mode Summary
router.get('/payment-summary', async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate);
    
    const orders = await prisma.order.findMany({
      where: { createdAt: dateRange },
      select: { paymentMode: true, grandTotal: true }
    });

    const summary = orders.reduce((acc, order) => {
      const mode = order.paymentMode || 'OTHER';
      acc[mode] = (acc[mode] || 0) + order.grandTotal;
      return acc;
    }, {});

    res.json(summary);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 2. Purchase Report
router.get('/purchase', async (req, res) => {
  try {
    const { filter, startDate, endDate, timezoneOffset } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate, parseInt(timezoneOffset || 0));
    
    let purchases = [];
    try {
      purchases = await prisma.purchase.findMany({
        where: { createdAt: dateRange }
      });
    } catch (err) {
      console.warn('Purchase report fallback:', err.message);
      purchases = await prisma.$queryRaw`
        SELECT CAST(id AS TEXT) as id, "invoiceNo", "supplierName", "grandTotal", "taxTotal", "createdAt"
        FROM "Purchase"
        WHERE "createdAt" >= ${dateRange.gte} AND "createdAt" <= ${dateRange.lte}
      `;
    }
    
    const summary = {
      totalPurchases: purchases.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0),
      totalTax: purchases.reduce((sum, p) => sum + (Number(p.taxTotal) || 0), 0),
      billCount: purchases.length,
    };
    
    res.json({ summary, details: purchases });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 3. Profit & Loss
router.get('/profit-loss', async (req, res) => {
  try {
    const { filter, startDate, endDate, timezoneOffset } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate, parseInt(timezoneOffset || 0));
    
    let totalSales, orderItems, expenses, totalExpense = 0;
    
    try {
      totalSales = await prisma.order.aggregate({
        where: { createdAt: dateRange },
        _sum: { subtotal: true }
      });
      orderItems = await prisma.orderItem.findMany({
        where: { order: { createdAt: dateRange } },
        include: { product: true }
      });
      expenses = await prisma.expense.aggregate({
        where: { createdAt: dateRange },
        _sum: { amount: true }
      });
      totalExpense = expenses._sum.amount || 0;
    } catch (err) {
      console.warn('Profit/Loss fallback:', err.message);
      // Raw fallback for aggregates
      const rawSales = await prisma.$queryRaw`SELECT SUM(subtotal) as total FROM "Order" WHERE "createdAt" >= ${dateRange.gte} AND "createdAt" <= ${dateRange.lte}`;
      totalSales = { _sum: { subtotal: Number(rawSales[0]?.total) || 0 } };
      
      orderItems = await prisma.$queryRaw`
        SELECT oi.quantity, p."purchasePrice"
        FROM "OrderItem" oi
        JOIN "Product" p ON oi."productId" = p.id
        JOIN "Order" o ON oi."orderId" = o.id
        WHERE o."createdAt" >= ${dateRange.gte} AND o."createdAt" <= ${dateRange.lte}
      `;
      
      const rawExp = await prisma.$queryRaw`SELECT SUM(amount) as total FROM "Expense" WHERE "createdAt" >= ${dateRange.gte} AND "createdAt" <= ${dateRange.lte}`;
      totalExpense = Number(rawExp[0]?.total) || 0;
    }

    const cogs = orderItems.reduce((sum, item) => sum + (Number(item.product?.purchasePrice || item.purchasePrice || 0) * item.quantity), 0);
    const grossProfit = (Number(totalSales._sum.subtotal) || 0) - cogs;
    const netProfit = grossProfit - totalExpense;
    
    res.json({
      salesAmount: Number(totalSales._sum.subtotal) || 0,
      cogs,
      grossProfit,
      expenses: totalExpense,
      netProfit
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 4. Day Book & 5. All Transactions (Combined Logically)
router.get('/daybook', async (req, res) => {
  try {
    const { filter, startDate, endDate, timezoneOffset } = req.query;
    const dateFilter = filter || 'Today'; // Respect all filter types (Today, Week, Month, All, Custom)
    const dateRange = getDateRange(dateFilter, startDate, endDate, parseInt(timezoneOffset || 0));

    // 1. Fetch Sales (Bills) - For the transaction list reference
    let sales = [];
    try {
      sales = await prisma.order.findMany({ 
        where: { createdAt: dateRange },
        include: { customer: true }
      });
    } catch (err) {
      console.warn('Daybook sales fallback:', err.message);
      sales = await prisma.$queryRaw`
        SELECT 
          CAST(o.id AS TEXT) as id, CAST(o."serverId" AS TEXT) as "serverId", o."grandTotal", o."invoiceNo", CAST(o."customerId" AS TEXT) as "customerId", o."createdAt",
          c.name as "customerName"
        FROM "Order" o
        LEFT JOIN "Customer" c ON o."customerId" = c.id
        WHERE o."createdAt" >= ${dateRange.gte} AND o."createdAt" <= ${dateRange.lte}
      `;
      sales = sales.map(s => ({
        ...s,
        customer: s.customerName ? { id: s.customerId, name: s.customerName } : null
      }));
    }

    // 2. Fetch Actual Sales Payments (Source of Truth for Cash In)
    const payments = await prisma.payment.findMany({
      where: { createdAt: dateRange, status: 'SUCCESS' },
      include: { order: { include: { customer: true } } }
    }).catch(() => []);

    // 3. Fetch Sales Returns (Credit Notes)
    const salesReturns = await prisma.salesReturn.findMany({
      where: { createdAt: dateRange },
      include: { customer: true, order: true }
    }).catch(() => []);

    // 4. Fetch Expenses
    let expenses = [];
    try {
      expenses = await prisma.expense.findMany({ where: { createdAt: dateRange } });
    } catch (err) {
      console.warn('Daybook expenses fallback:', err.message);
      expenses = await prisma.$queryRaw`SELECT CAST(id AS TEXT) as id, amount, description, "createdAt", type FROM "Expense" WHERE "createdAt" >= ${dateRange.gte} AND "createdAt" <= ${dateRange.lte}`;
    }
    
    // 5. Fetch Purchase Events
    const purchases = await prisma.purchase.findMany({ where: { date: dateRange } }).catch(() => []);

    // 6. Fetch Individual Purchase Payments (Source of Truth for Purchase Cash Out)
    const purchasePayments = await prisma.purchasePayment.findMany({ 
      where: { date: dateRange },
      include: { purchase: true }
    }).catch(() => []);
    
    const transactions = [
      // Sales Payments
      ...payments.map(p => ({ 
        id: p.id, 
        type: 'SALE_PAYMENT', 
        amount: p.amount, 
        date: p.createdAt, 
        details: `Bill: ${p.order.invoiceNo} (${p.method})`,
        customerId: p.order.customerId 
      })),

      // Sales Returns (Cash Out / Credit Issued)
      ...salesReturns.map(sr => ({
        id: sr.id,
        type: 'SALES_RETURN',
        amount: -sr.totalAmount,
        date: sr.createdAt,
        details: `[STORE CREDIT] Return: ${sr.returnNo}${sr.order ? ' (Bill: ' + sr.order.invoiceNo + ')' : ''}`,
        customerId: sr.customerId
      })),
      
      // Purchases (Reference event)
      ...purchases.map(p => ({
        id: p.id,
        type: 'PURCHASE',
        amount: 0, 
        date: p.date || p.createdAt,
        details: `Inv: ${p.invoiceNo}${p.paymentStatus === 'PENDING' ? ' (PENDING)' : p.paymentStatus === 'PARTIAL' ? ' (PARTIAL)' : ''}`
      })),

      // Purchase Payments (Actual Cash Out)
      ...purchasePayments.map(pp => ({ 
        id: pp.id, 
        type: 'PURCHASE_PAYMENT', 
        amount: -pp.amount, 
        date: pp.date, 
        details: `Inv: ${pp.purchase?.invoiceNo || 'N/A'} (Payment)`,
        supplierId: pp.supplierId
      })),

      // General Expenses
      ...expenses.map(e => ({ 
        id: e.id, 
        type: 'EXPENSE', 
        amount: -e.amount, 
        date: e.createdAt, 
        details: (e.type === 'Discount' ? '[NON-CASH] ' : '') + (e.type || e.description) 
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const cashIn = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const cashOut = purchasePayments.reduce((sum, pp) => sum + (Number(pp.amount) || 0), 0) + 
                    expenses.filter(e => e.type !== 'Discount').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
                    // Note: Sales Returns (Credit Notes) are excluded from Cash Out as they are store credit
    
    res.json({
      transactions,
      cashIn: Number(cashIn) || 0,
      cashOut: Number(cashOut) || 0,
      netBalance: Number(cashIn - cashOut) || 0
    });
  } catch (error) {
    console.error('Daybook Error:', error);
    res.json({ transactions: [], cashIn: 0, cashOut: 0, netBalance: 0, error: error.message });
  }
});

// 6. Cashflow (Simplified to In/Out matching daybook)
router.get('/cashflow', async (req, res) => {
  // Alias to DayBook logic but formatted for high level cashflow
  const queryString = new URLSearchParams(req.query).toString();
  res.redirect(`/api/reports/daybook?${queryString}`);
});

// 7. Balance Sheet (Summary snapshot)
router.get('/balance-sheet', async (req, res) => {
  try {
    const products = await prisma.product.findMany();
    const inventoryValue = products.reduce((sum, p) => sum + (p.stockQuantity * p.purchasePrice), 0);
    
    const customers = await prisma.customer.findMany();
    const receivables = customers.reduce((sum, c) => sum + c.creditBalance, 0);
    
    res.json({
      assets: {
        inventoryValue,
        receivables,
        totalAssets: inventoryValue + receivables
      },
      liabilities: {} // Simplified for POS
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 8. Party Reports (All Parties)
router.get('/parties', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { totalSpent: 'desc' }
    });
    res.json(customers);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/party-statement/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Try Prisma first
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { orders: { orderBy: { createdAt: 'desc' }, take: 20 } }
    });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    console.warn('Party statement fallback:', error.message);
    try {
      const { id } = req.params;
      const rawCust = await prisma.$queryRaw`SELECT * FROM "Customer" WHERE id = ${id}`;
      if (rawCust.length === 0) return res.status(404).json({ message: 'Not found' });
      
      const rawOrders = await prisma.$queryRaw`
        SELECT CAST(id AS TEXT) as id, "invoiceNo", "grandTotal", "balance", "createdAt" 
        FROM "Order" WHERE "customerId" = ${id} 
        ORDER BY "createdAt" DESC LIMIT 20
      `;
      
      res.json({
        ...rawCust[0],
        orders: rawOrders
      });
    } catch (fallbackErr) {
      res.status(500).json({ error: 'Failed to retrieve profile' });
    }
  }
});

// 9.1 All Suppliers
router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        purchases: { select: { grandTotal: true, balanceDue: true, createdAt: true } },
        purchaseReturns: { select: { totalAmount: true } }
      }
    });

    const report = suppliers.map(s => {
      const totalPurchased = s.purchases.reduce((sum, p) => sum + p.grandTotal, 0);
      const totalReturned = s.purchaseReturns.reduce((sum, r) => sum + r.totalAmount, 0);
      const totalBalance = s.purchases.reduce((sum, p) => sum + p.balanceDue, 0);
      const lastPurchase = s.purchases.length > 0 ? s.purchases[0].createdAt : s.createdAt;

      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        totalPurchases: totalPurchased,
        totalReturned,
        totalBalance: totalBalance - totalReturned, // Simplified balance
        lastPurchase
      };
    });

    res.json(report);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 9.2 Supplier Ledger (Enhanced)
router.get('/supplier-ledger', async (req, res) => {
  try {
    const { supplierId, supplierName } = req.query;
    if (!supplierId && !supplierName) return res.status(400).json({ error: 'Supplier ID or Name required' });

    let supplier;
    if (supplierId) {
      supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        include: {
          purchases: { include: { payments: true } },
          purchaseReturns: true
        }
      });
    } else {
      supplier = await prisma.supplier.findFirst({
        where: { name: supplierName },
        include: {
          purchases: { include: { payments: true } },
          purchaseReturns: true
        }
      });
    }

    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    // Construct unified transaction list
    let transactions = [];
    
    // 1. Opening Balance
    transactions.push({
      date: supplier.createdAt,
      type: 'OPENING',
      description: 'Opening Balance',
      amount: supplier.openingBalance,
      reference: 'Initial'
    });

    // 2. Purchases
    supplier.purchases.forEach(p => {
      transactions.push({
        date: p.date,
        type: 'PURCHASE',
        description: `Invoice: ${p.invoiceNo}`,
        amount: p.grandTotal,
        reference: p.invoiceNo
      });

      // 3. Individual Payments
      p.payments?.forEach(pay => {
        transactions.push({
          date: pay.date,
          type: 'PAYMENT',
          description: `Payment via ${pay.method}`,
          amount: -pay.amount,
          reference: p.invoiceNo
        });
      });
    });

    // 4. Returns
    supplier.purchaseReturns.forEach(r => {
      transactions.push({
        date: r.date,
        type: 'RETURN',
        description: `Return: ${r.returnNo}`,
        amount: -r.totalAmount,
        reference: r.returnNo
      });
    });

    // Sort and calculate balance
    transactions.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let runningBalance = 0;
    const ledger = transactions.map(t => {
      // For the unified Purchases table in Reports.tsx, we need p.balanceDue etc.
      // But we will also send the full ledger for future UI enhancements.
      runningBalance += t.amount;
      return { 
        ...t, 
        runningBalance,
        // Frontend compatibility for line 706/707
        grandTotal: Math.abs(t.amount),
        balanceDue: runningBalance,
        paymentStatus: t.amount > 0 ? (runningBalance > 0 ? 'PARTIAL' : 'PAID') : 'PAID'
      };
    });

    res.json({
      name: supplier.name,
      totalBalance: runningBalance,
      totalPurchases: supplier.purchases.reduce((s, p) => s + p.grandTotal, 0),
      totalPaid: supplier.purchases.reduce((s, p) => s + p.amountPaid, 0),
      purchases: ledger.reverse(), // Map it as 'purchases' for the frontend table
      supplier: { id: supplier.id, name: supplier.name, openingBalance: supplier.openingBalance }
    });
  } catch (error) { 
    console.error('Ledger Error:', error);
    res.status(500).json({ error: error.message }); 
  }
});

// 10. Party Wise Profit & Loss
router.get('/party-profit', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: { customer: true, orderItems: { include: { product: true } } }
    });
    
    const profitByParty = orders.reduce((acc, order) => {
      if (!order.customer) return acc;
      const cid = order.customer.id;
      if (!acc[cid]) acc[cid] = { id: cid, name: order.customer.name, totalSales: 0, cogs: 0, profit: 0, points: order.customer.loyaltyPoints };
      
      const sales = order.subtotal;
      const cogs = order.orderItems.reduce((sum, item) => sum + ((item.product?.purchasePrice || 0) * item.quantity), 0);
      
      acc[cid].totalSales += sales;
      acc[cid].cogs += cogs;
      acc[cid].profit += (sales - cogs);
      return acc;
    }, {});
    
    res.json(Object.values(profitByParty));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 11. Stock Summary Report
router.get('/stock-summary', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { is_active: true }
    });
    
    const summary = {
      totalItems: products.length,
      totalStockValue: products.reduce((sum, p) => sum + (p.stockQuantity * p.purchasePrice), 0),
      totalRetailValue: products.reduce((sum, p) => sum + (p.stockQuantity * p.sellingPrice), 0),
    };
    
    res.json({ summary, details: products });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 12. Item Wise Profit & Loss
router.get('/item-profit', async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate);

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: dateRange
        }
      },
      include: { product: true }
    });
    
    const itemProfit = orderItems.reduce((acc, item) => {
      if (!item.product) return acc;
      const name = item.product.name;
      if (!acc[name]) acc[name] = { qtySold: 0, revenue: 0, cost: 0, profit: 0 };
      
      const rev = item.price * item.quantity;
      const cost = item.product.purchasePrice * item.quantity;
      
      acc[name].qtySold += item.quantity;
      acc[name].revenue += rev;
      acc[name].cost += cost;
      acc[name].profit += (rev - cost);
      return acc;
    }, {});
    
    res.json(Object.entries(itemProfit).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.profit - a.profit));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 13. Expense Reports 
router.get('/expenses', async (req, res) => {
  try {
    const { filter, startDate, endDate } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate);
    
    const expenses = await prisma.expense.findMany({
      where: { createdAt: dateRange },
      orderBy: { createdAt: 'desc' }
    });
    
    const totalByCat = expenses.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + e.amount;
      return acc;
    }, {});
    
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    res.json({ total, categorySummary: totalByCat, details: expenses });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 14. All Transactions alias
router.get('/transactions', async (req, res) => {
  const queryString = new URLSearchParams(req.query).toString();
  res.redirect(`/api/reports/daybook?${queryString}`);
});

// 15. Stock Detail
router.get('/stock-detail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { inventoryLogs: { orderBy: { createdAt: 'desc' } } }
    });
    if (!product) return res.status(404).json({ message: 'Not found' });
    res.json(product);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Test WhatsApp Configuration & Diagnostics
router.post('/test-whatsapp', auth(['ADMIN']), async (req, res) => {
  const startTime = Date.now();
  try {
    const { phone, message } = req.body;
    
    // 1. Gather Diagnostic Data
    const apiURL = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;
    const host = req.headers.host;
    const protocol = req.protocol || 'https';
    const appUrlOverride = process.env.APP_URL;

    const report = {
      timestamp: new Date().toISOString(),
      config: {
        apiUrlPresent: !!apiURL,
        apiKeyPresent: !!apiKey,
        detectedHost: host,
        appUrlOverride: appUrlOverride || 'NOT_SET',
        publicAccessibility: !host.includes('localhost') && !host.includes('127.0.0.1')
      },
      tests: []
    };

    if (!apiURL || !apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Configuration Missing',
        report 
      });
    }

    // 2. Connectivity Test (Simple Message)
    const cleanPhone = (phone || '9100000000').replace(/\D/g, '').slice(-10);
    const formattedPhone = `91${cleanPhone}`;
    
    console.log(`[WhatsApp Test] Sending test message to ${formattedPhone}...`);
    
    const params = new URLSearchParams();
    params.append('token', apiKey);
    params.append('to', formattedPhone);
    params.append('body', message || `POS Pro WhatsApp Connection Test: SUCCESS\nTime: ${new Date().toLocaleString()}`);

    const testEndpoint = apiURL.includes('ultramsg.com') 
        ? (apiURL.endsWith('/') ? `${apiURL}messages/chat` : `${apiURL}/messages/chat`)
        : apiURL;

    const axios = require('axios');
    const response = await axios.post(testEndpoint, params, { 
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000 
    });

    res.json({ 
        success: true, 
        duration: `${Date.now() - startTime}ms`,
        report,
        providerResponse: response.data 
    });
  } catch (error) {
    res.status(500).json({ 
        success: false, 
        duration: `${Date.now() - startTime}ms`,
        error: error.message, 
        details: error.response?.data || 'No response data from provider'
    });
  }
});

// Staff Activity & Performance Report
router.get('/staff-activity', auth(['ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        username: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    const staffStats = await Promise.all(users.map(async (user) => {
      // Attribute orders to this user, plus legacy orders (null creator) to the Admin
      const whereClause = {
        OR: [
          { creatorId: user.id },
          ...(user.role === 'ADMIN' ? [{ creatorId: { equals: null } }] : [])
        ]
      };

      const stats = await prisma.order.aggregate({
        where: whereClause,
        _sum: { grandTotal: true },
        _count: true
      }).catch(err => {
        console.warn('Staff activity aggregation failed (possibly missing schema):', err.message);
        return { _count: 0, _sum: { grandTotal: 0 } };
      });

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        salesCount: stats._count || 0,
        revenue: stats._sum.grandTotal || 0,
        recentActivities: user.activities || []
      };
    }));

    res.json(staffStats);
  } catch (error) {
    console.error('Staff Activity Report Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 11. Debug Logs (Black Box)
router.get('/debug-logs', auth(['ADMIN']), (req, res) => {
  res.json(errorLog);
});

// RESTAURANT SPECIFIC REPORT ENDPOINTS

// Waiter Performance Report
router.get('/waiter-sales', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { filter, startDate, endDate, timezoneOffset } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate, parseInt(timezoneOffset || 0));

    const orders = await prisma.order.findMany({
      where: {
        createdAt: dateRange,
        waiterName: { not: null }
      },
      select: {
        waiterName: true,
        grandTotal: true
      }
    });

    const waiterMap = {};
    orders.forEach(o => {
      const name = o.waiterName || 'Unknown';
      if (!waiterMap[name]) {
        waiterMap[name] = { name, totalSales: 0, orderCount: 0 };
      }
      waiterMap[name].totalSales += o.grandTotal;
      waiterMap[name].orderCount += 1;
    });

    res.json(Object.values(waiterMap).sort((a,b) => b.totalSales - a.totalSales));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Table Sales Report
router.get('/table-sales', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { filter, startDate, endDate, timezoneOffset } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate, parseInt(timezoneOffset || 0));

    const orders = await prisma.order.findMany({
      where: {
        createdAt: dateRange,
        tableName: { not: null }
      },
      select: {
        tableName: true,
        grandTotal: true
      }
    });

    const tableMap = {};
    orders.forEach(o => {
      const number = o.tableName || 'Unknown';
      if (!tableMap[number]) {
        tableMap[number] = { number, totalSales: 0, orderCount: 0 };
      }
      tableMap[number].totalSales += o.grandTotal;
      tableMap[number].orderCount += 1;
    });

    res.json(Object.values(tableMap).sort((a,b) => b.totalSales - a.totalSales));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// KOT Report
router.get('/kot-reports', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { filter, startDate, endDate, timezoneOffset } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate, parseInt(timezoneOffset || 0));

    const kots = await prisma.kOT.findMany({
      where: {
        createdAt: dateRange
      },
      include: {
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(kots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancelled Items & KOT items Report
router.get('/cancelled-items', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { filter, startDate, endDate, timezoneOffset } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate, parseInt(timezoneOffset || 0));

    const cancelledKotItems = await prisma.kOTItem.findMany({
      where: {
        status: 'CANCELLED',
        createdAt: dateRange
      },
      include: {
        kot: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(cancelledKotItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Discount Details Report
router.get('/discounts-report', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { filter, startDate, endDate, timezoneOffset } = req.query;
    const dateRange = getDateRange(filter, startDate, endDate, parseInt(timezoneOffset || 0));

    const orders = await prisma.order.findMany({
      where: {
        createdAt: dateRange,
        discount: { gt: 0 }
      },
      select: {
        invoiceNo: true,
        discount: true,
        grandTotal: true,
        createdAt: true,
        creator: { select: { name: true } }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
