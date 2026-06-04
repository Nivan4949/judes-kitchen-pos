const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Bulk sync endpoints
router.post('/orders', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  const { orders } = req.body;
  const results = { synced: [], failed: [] };

  for (const orderData of orders) {
    try {
      // Idempotency check using serverId (client-side UUID)
      const existing = await prisma.order.findUnique({
        where: { serverId: orderData.id }
      });

      if (existing) {
        results.synced.push({ id: orderData.id, invoiceNo: existing.invoiceNo });
        continue;
      }

      const syncOrder = await prisma.$transaction(async (tx) => {
        // Calculate loyalty points earned (1 point per ₹100 of grandTotal)
        const earnRate = 100;
        const loyaltyPointsEarned = Math.floor(orderData.grandTotal / earnRate);
        const loyaltyPointsRedeemed = orderData.loyaltyPointsRedeemed || 0;

        // Determine unique invoice number (Trust client first, then safe server fallback)
        let invoiceNo = orderData.invoiceNo;
        const existingNum = await tx.order.findUnique({ where: { invoiceNo: String(orderData.invoiceNo) } });
        if (existingNum) {
          const rawMax = await tx.$queryRaw`
            SELECT MAX(CAST("invoiceNo" AS INTEGER)) as "maxNum" 
            FROM "Order" 
            WHERE "invoiceNo" ~ '^[0-9]+$' AND "invoiceNo" NOT LIKE '9%'
          `;
          const maxNum = Number(rawMax[0]?.maxNum) || 99;
          invoiceNo = (maxNum + 1).toString();
        }

        const order = await tx.order.create({
          data: {
            invoiceNo: invoiceNo,
            serverId: orderData.id,
            customerId: orderData.customerId,
            subtotal: orderData.subtotal,
            taxTotal: orderData.taxTotal,
            grandTotal: orderData.grandTotal,
            roundedTotal: orderData.roundedTotal || Math.floor(orderData.grandTotal),
            amountPaid: Number(orderData.amountPaid) || 0,
            balance: Number(orderData.balance) || 0,
            paymentMode: orderData.paymentMode,
            loyaltyPointsEarned,
            loyaltyPointsRedeemed,
            status: 'COMPLETED',
            isSynced: true,
            creatorId: orderData.creatorId || req.user.id,
            createdAt: new Date(orderData.createdAt || Date.now()),
            orderItems: {
              create: orderData.orderItems.map(item => ({
                productId: item.productId || item.id,
                quantity: item.quantity,
                price: item.price || item.sellingPrice,
                taxAmount: ((item.price || item.sellingPrice) * ((item.gstRate || 0) / 100)) * item.quantity,
                total: ((item.price || item.sellingPrice) * item.quantity) + (((item.price || item.sellingPrice) * ((item.gstRate || 0) / 100)) * item.quantity)
              }))
            },
            payments: {
              create: {
                method: orderData.paymentMode,
                amount: Number(orderData.amountPaid) || 0,
                status: 'SUCCESS'
              }
            }
          }
        });

        // Deduct inventory and log it
        for (const item of orderData.orderItems) {
          const pid = item.productId || item.id;
          await tx.product.update({
            where: { id: pid },
            data: { stockQuantity: { decrement: item.quantity } }
          });
          
          await tx.inventoryLog.create({
            data: {
              productId: pid,
              type: 'OUT',
              quantity: item.quantity,
              reason: `Offline Order ${invoiceNo}`
            }
          });
        }

        // Update customer loyalty points and total spent
        if (orderData.customerId) {
          await tx.customer.update({
            where: { id: orderData.customerId },
            data: {
              loyaltyPoints: {
                increment: loyaltyPointsEarned,
                decrement: loyaltyPointsRedeemed
              },
              totalSpent: {
                increment: orderData.grandTotal
              },
              creditBalance: {
                increment: Number(orderData.balance) || 0
              },
              lastPurchaseDate: new Date(orderData.createdAt || Date.now())
            }
          });
        }

        return order;
      });

      results.synced.push({ id: orderData.id, invoiceNo: syncOrder.invoiceNo });
      
      // Broadcast to other terminals
      const io = req.app.get('io');
      if (io) {
        io.emit('ORDER_SYNCED', { invoiceNo: syncOrder.invoiceNo });
      }

    } catch (error) {
      console.error('Sync Order Failed:', error);
      results.failed.push({ id: orderData.id, error: error.message });
    }
  }

  res.json(results);
});

module.exports = router;
