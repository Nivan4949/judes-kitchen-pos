const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');
const whatsappUtil = require('../utils/whatsappUtil');
const pdfUtil = require('../utils/pdfUtil');
const { getDateRange } = require('../utils/dateUtil');

// GET sales return as PDF (Public for WhatsApp API - ABSOLUTE TOP PRIORITY)
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const salesReturn = await prisma.salesReturn.findUnique({
      where: { id },
      include: { 
        returnItems: { include: { product: true } }, 
        customer: true 
      }
    });

    if (!salesReturn) return res.status(404).send('Credit Note not found');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=CreditNote-${salesReturn.returnNo}.pdf`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    pdfUtil.generateReturnPDF(salesReturn, res);
  } catch (error) {
    console.error('PDF Error:', error);
    res.status(500).send('Error generating PDF');
  }
});

// Create new sales return (Credit Note)
router.post('/', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { 
      orderId, 
      customerId, 
      returnItems, 
      subtotal, 
      taxTotal, 
      totalAmount, 
      reason 
    } = req.body;

    // Generate Simple Sequential Return Number
    const returnCount = await prisma.salesReturn.count();
    const returnNo = `${1001 + returnCount}`;

    const salesReturn = await prisma.$transaction(async (tx) => {
      // 1. Create the Sales Return with items
      const newReturn = await tx.salesReturn.create({
        data: {
          returnNo,
          orderId: orderId || null,
          customerId: customerId || null,
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
          data: { stockQuantity: { increment: item.quantity } }
        }),
        tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            reason: `Sales Return ${returnNo}`
          }
        })
      ]).flat();

      // 3. Update customer credit balance if customerId is present
      if (customerId) {
        inventoryUpdates.push(
          tx.customer.update({
            where: { id: customerId },
            data: { creditBalance: { increment: totalAmount } }
          })
        );
      }

      await Promise.all(inventoryUpdates);

      return newReturn;
    }, { timeout: 15000 });

    // 4. Automated WhatsApp Messaging (Credit Note)
    if (salesReturn && salesReturn.customerId) {
        try {
            const customer = await prisma.customer.findUnique({ where: { id: salesReturn.customerId } });
            if (customer && customer.phone) {
                const waResult = await whatsappUtil.sendReturnReceipt(salesReturn, customer.phone);
                salesReturn.whatsappStatus = waResult;
            }
        } catch (err) {
            console.error('WhatsApp Automation (Return) Error:', err);
        }
    }

    res.json(salesReturn);
  } catch (error) {
    console.error('Sales Return Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all sales returns with filtering
router.get('/', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { startDate, endDate, filter, timezoneOffset } = req.query;
    let where = {};

    if (filter || (startDate && endDate)) {
      where.createdAt = getDateRange(filter, startDate, endDate, parseInt(timezoneOffset || 0));
    }

    const returns = await prisma.salesReturn.findMany({
      where,
      include: {
        customer: true,
        order: true,
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
    console.error('Fetch Returns Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single return details
router.get('/:id', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { id } = req.params;
    const salesReturn = await prisma.salesReturn.findUnique({
      where: { id },
      include: {
        customer: true,
        order: true,
        returnItems: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!salesReturn) {
      return res.status(404).json({ error: 'Sales return not found' });
    }
    
    res.json(salesReturn);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
