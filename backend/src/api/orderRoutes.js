const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');
const whatsappUtil = require('../utils/whatsappUtil');
const pdfUtil = require('../utils/pdfUtil');

// Local Error Capture for Black Box
const logError = (context, err) => {
  console.error(`[Order API Debug] ${context}:`, err);
};

// GET order as PDF (Public for WhatsApp API - ABSOLUTE TOP PRIORITY)
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findFirst({
      where: { 
        OR: [
          { id: id },
          { invoiceNo: id }
        ]
      },
      include: { 
        orderItems: { include: { product: true } }, 
        customer: true,
        payments: true
      }
    });
    
    if (!order) return res.status(404).send('Invoice not found');
    
    // Explicit headers for binary delivery
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.invoiceNo}.pdf`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    pdfUtil.generateInvoicePDF(order, res);
  } catch (error) {
    console.error('PDF Error:', error);
    res.status(500).send('Error generating PDF');
  }
});

// --- START CUSTOMER WHATSAPP ROUTES ---
router.get('/test-conn', (req, res) => res.json({ status: 'ok', msg: 'Order API is reachable' }));

// Share order via WhatsApp (Manual trigger from UI)
router.post('/share-whatsapp', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { orderId, phone } = req.body;
    console.log(`[WhatsApp Share Request] Order: ${orderId}, Phone: ${phone}`);
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: { product: true }
        }
      }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // We MUST await this on Vercel to prevent process termination
    const waResult = await whatsappUtil.sendReceipt(order, phone, req.headers.host);

    return res.json({ success: true, message: 'WhatsApp message sent', whatsappStatus: waResult });
  } catch (error) {
    console.error('WhatsApp Share Error:', error);
    return res.status(500).json({ error: error.message });
  }
});
// --- END CUSTOMER WHATSAPP ROUTES ---

// Get order by ID or InvoiceNo (Dual-Lookup Safety)
router.get('/:id', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { id } = req.params;
    let order = await prisma.order.findFirst({
      where: { 
        OR: [
          { id: id },
          { invoiceNo: id }
        ]
      },
      include: { 
        orderItems: { include: { product: true } }, 
        customer: true, 
        payments: true 
      }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new order
router.post('/', auth(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER']), async (req, res) => {
  console.log(`[Order API] Starting creation with ${req.body.orderItems?.length} items`);
  const startTime = Date.now();

  try {
    const { 
      id, invoiceNo: clientInvoiceNo, customerId, orderItems, subtotal, 
      discount, manualDiscount, taxTotal, grandTotal, roundedTotal, savings, 
      amountPaid, balance, paymentMode, orderType, loyaltyPointsRedeemed = 0,
      waiterName, tableName, tableId, notes, serviceCharge = 0, parcelCharge = 0, 
      deliveryCharge = 0, shiftId, kotCount = 0, status
    } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    // 0. IDEMPOTENCY CHECK: If ID already exists, just return the existing order
    if (id) {
      const existing = await prisma.order.findUnique({ 
        where: { id },
        include: { orderItems: { include: { product: true } }, payments: true }
      });
      if (existing) {
        console.log(`[Order API] Idempotency Hit: Order ${id} already exists. Returning existing.`);
        return res.json(existing);
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      // 1. PRE-FETCH ALL PRODUCTS IN ONE GO (HUGE Performance Gain)
      const productIds = [...new Set(orderItems.map(item => item.productId || item.id))];
      const productsFromDb = await tx.product.findMany({
        where: { id: { in: productIds } }
      });
      const productMap = new Map(productsFromDb.map(p => [p.id, p]));

      // 2. Determine Invoice Number (Trust Client first, Fallback to Server Seq)
      let invoiceNo = clientInvoiceNo;
      
      const existingNum = await tx.order.findUnique({ where: { invoiceNo: String(clientInvoiceNo) } });
      if (!clientInvoiceNo || existingNum) {
          // If client provided no number or it's already taken, calculate next safe one
          const rawMax = await tx.$queryRaw`
            SELECT MAX(CAST("invoiceNo" AS INTEGER)) as "maxNum" 
            FROM "Order" 
            WHERE "invoiceNo" ~ '^[0-9]+$' AND "invoiceNo" NOT LIKE '9%'
          `;
          const maxNum = Number(rawMax[0]?.maxNum) || 99;
          invoiceNo = (maxNum + 1).toString();
      }

      // 3. Validation
      for (const item of orderItems) {
        const pid = item.productId || item.id;
        const p = productMap.get(pid);
        if (!p) throw new Error(`Product ID ${pid} not found in database.`);
      }

      // 4. Create Order + Items + Payment in ONE nested call
      const earnRate = 100;
      const loyaltyPointsEarned = Math.floor(grandTotal / earnRate);
      const isPaid = (status === 'COMPLETED' || amountPaid >= grandTotal || balance <= 0);

      const orderBaseData = {
        id: id || undefined, // Respect the Client's Optimistic ID
        invoiceNo,
        customerId,
        subtotal,
        discount,
        taxTotal,
        grandTotal,
        roundedTotal: roundedTotal || Math.floor(grandTotal),
        savings: savings || 0,
        amountPaid: Number(amountPaid) || 0,
        balance: Number(balance) || 0,
        paymentMode,
        orderType: orderType || 'Walk-in',
        loyaltyPointsEarned,
        loyaltyPointsRedeemed,
        status: status || (isPaid ? 'COMPLETED' : 'PENDING'),
        creatorId: req.user?.id || null,
        waiterName: waiterName || null,
        tableName: tableName || null,
        tableId: tableId || null,
        notes: notes || null,
        serviceCharge: Number(serviceCharge) || 0,
        parcelCharge: Number(parcelCharge) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        shiftId: shiftId || null,
        kotCount: Number(kotCount) || 0,
        orderItems: {
          create: orderItems.map((item) => {
            const pid = item.productId || item.id;
            const p = productMap.get(pid);
            const price = item.price || item.sellingPrice || p.sellingPrice;
            const mrp = item.mrp || p.mrp || price;
            const gst = parseFloat(item.gstRate ?? p.gstRate ?? 18);
            
            return {
              productId: pid,
              quantity: item.quantity,
              price: price,
              mrp: mrp,
              discount: item.discount || 0,
              taxAmount: (price * (gst / 100)) * item.quantity,
              total: (price * item.quantity) + ((price * (gst / 100)) * item.quantity),
              notes: item.notes || null,
              variant: item.variant || null,
              modifiers: item.modifiers || null
            };
          })
        }
      };

      // Create payment record if payment was actually made
      if (amountPaid > 0) {
        orderBaseData.payments = {
          create: {
            method: paymentMode,
            amount: Number(amountPaid) || 0,
            status: 'SUCCESS'
          }
        };
      }

      const newOrder = await tx.order.create({
        data: orderBaseData,
        include: { orderItems: { include: { product: true } }, payments: true }
      });

      // 5. Stock Updates & Recipe deductions
      for (const item of orderItems) {
        const pid = item.productId || item.id;
        const qty = Number(item.quantity) || 0;
        const p = productMap.get(pid);

        // Decrement Product Stock
        await tx.$executeRaw`
          UPDATE "Product" 
          SET "stockQuantity" = "stockQuantity" - ${qty} 
          WHERE id = ${pid}
        `;

        // Create Inventory Log
        await tx.inventoryLog.create({
          data: {
            productId: pid,
            type: 'OUT',
            quantity: qty,
            reason: `Order ${invoiceNo}`
          }
        });

        // Recipe Deductions (Raw materials)
        if (p && p.recipe && Array.isArray(p.recipe)) {
          for (const ingredient of p.recipe) {
            const rawId = ingredient.rawMaterialId;
            const ingredientQty = Number(ingredient.quantity) || 0;
            const totalDeduct = ingredientQty * qty;
            if (rawId && totalDeduct > 0) {
              await tx.rawMaterial.update({
                where: { id: rawId },
                data: {
                  stockQuantity: { decrement: totalDeduct }
                }
              });
            }
          }
        }
      }

      // 6. Manage Dining Table Status
      if (tableId && orderType === 'Dine-in') {
        if (isPaid) {
          // Free table since it is paid
          await tx.table.update({
            where: { id: tableId },
            data: {
              status: 'FREE',
              currentOrderId: null,
              runningOrderAmount: 0,
              occupiedAt: null
            }
          });
        } else {
          // Table occupied with active running order
          await tx.table.update({
            where: { id: tableId },
            data: {
              status: 'OCCUPIED',
              currentOrderId: newOrder.id,
              runningOrderAmount: grandTotal,
              occupiedAt: new Date()
            }
          });
        }
      }

      // 7. Record Staff Activity
      if (req.user?.id) {
        await tx.userActivity.create({
          data: {
            userId: req.user.id,
            type: 'SALE'
          }
        });
      }

      // 8. Update Customer Loyalty & Credit Balances
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            loyaltyPoints: { increment: loyaltyPointsEarned - (loyaltyPointsRedeemed || 0) },
            totalSpent: { increment: Number(grandTotal) },
            creditBalance: { increment: Number(balance) || 0 },
            lastPurchaseDate: new Date()
          }
        });
      }

      // 9. Auto-log Manual Discount as Expense
      if (manualDiscount && manualDiscount > 0) {
        let discountCat = await tx.expenseCategory.findUnique({
          where: { name: 'Discount' }
        });
        if (!discountCat) {
          discountCat = await tx.expenseCategory.create({
            data: { name: 'Discount' }
          });
        }
        await tx.expense.create({
          data: {
            type: 'Discount',
            amount: Number(manualDiscount),
            description: `Checkout discount for Invoice ${invoiceNo}`
          }
        });
      }

      // 10. Socket Events
      const io = req.app.get('io');
      if (io) {
        io.emit('INVENTORY_UPDATE', { items: orderItems });
        io.emit('ORDER_CREATED', newOrder);
      }

      return newOrder;
    }, { timeout: 15000 });

    console.log(`[Order API] Success! Processed in ${Date.now() - startTime}ms`);
    res.json(order);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[Order API] FAILED after ${elapsed}ms:`, error);
    res.status(500).json({ 
      error: error.message || 'Internal Server Error',
      details: error.code || 'TRANSACTION_FAILED'
    });
  }
});

// Update existing order (Full edit with inventory reversal)
router.put('/:id', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { 
      orderItems: newItems, subtotal, discount, taxTotal, grandTotal, 
      amountPaid, balance, paymentMode, customerId, status,
      waiterName, tableName, tableId, notes, serviceCharge = 0,
      parcelCharge = 0, deliveryCharge = 0, shiftId, kotCount = 0
    } = req.body;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Fetch old order with items
      const oldOrder = await tx.order.findUnique({
        where: { id },
        include: { orderItems: true, customer: true }
      });
      if (!oldOrder) throw new Error('Order not found');

      // 2. Pre-fetch ALL products involved (Old and New)
      const allProductIds = [...new Set([
        ...oldOrder.orderItems.map(i => i.productId),
        ...newItems.map(i => i.productId || i.id)
      ])];
      const productsFromDb = await tx.product.findMany({
        where: { id: { in: allProductIds } }
      });
      const productMap = new Map(productsFromDb.map(p => [p.id, p]));

      // 3. REVERSE: Old Loyalty and Spending
      if (oldOrder.customerId) {
        await tx.customer.update({
          where: { id: oldOrder.customerId },
          data: {
            loyaltyPoints: { decrement: oldOrder.loyaltyPointsEarned - (oldOrder.loyaltyPointsRedeemed || 0) },
            totalSpent: { decrement: oldOrder.grandTotal },
            creditBalance: { decrement: oldOrder.balance || 0 }
          }
        });
      }

      // 4. Perform Inventory Updates Sequentially for stability
      // Reverse old items (Increment stock back)
      for (const item of oldOrder.orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } }
        });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            reason: `Edit Reverse: ${oldOrder.invoiceNo}`
          }
        });

        // Reverse raw material recipe stock
        const p = productMap.get(item.productId);
        if (p && p.recipe && Array.isArray(p.recipe)) {
          for (const ingredient of p.recipe) {
            const rawId = ingredient.rawMaterialId;
            const ingredientQty = Number(ingredient.quantity) || 0;
            const totalReverse = ingredientQty * item.quantity;
            if (rawId && totalReverse > 0) {
              await tx.rawMaterial.update({
                where: { id: rawId },
                data: { stockQuantity: { increment: totalReverse } }
              });
            }
          }
        }
      }

      // 5. APPLY: Delete old mapping and prepare new
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.payment.deleteMany({ where: { orderId: id } });

      const earnRate = 100;
      const newLoyaltyPointsEarned = Math.floor(grandTotal / earnRate);
      const isPaid = (status === 'COMPLETED' || amountPaid >= grandTotal || balance <= 0);

      // Re-apply new items
      for (const item of newItems) {
        const pid = item.productId || item.id;
        if (!pid) continue; // Skip empty lines
        const p = productMap.get(pid);
        if (!p) throw new Error(`Product ${pid} not found`);

        await tx.product.update({
          where: { id: pid },
          data: { stockQuantity: { decrement: item.quantity } }
        });
        await tx.inventoryLog.create({
          data: {
            productId: pid,
            type: 'OUT',
            quantity: item.quantity,
            reason: `Edit Apply: ${oldOrder.invoiceNo}`
          }
        });

        // Deduct raw material recipe stock
        if (p.recipe && Array.isArray(p.recipe)) {
          for (const ingredient of p.recipe) {
            const rawId = ingredient.rawMaterialId;
            const ingredientQty = Number(ingredient.quantity) || 0;
            const totalDeduct = ingredientQty * item.quantity;
            if (rawId && totalDeduct > 0) {
              await tx.rawMaterial.update({
                where: { id: rawId },
                data: { stockQuantity: { decrement: totalDeduct } }
              });
            }
          }
        }
      }

      // 6. Final Record Update
      const finalOrder = await tx.order.update({
        where: { id },
        data: {
          customerId,
          subtotal,
          discount,
          taxTotal,
          grandTotal,
          amountPaid: Number(amountPaid) || 0,
          balance: Number(balance) || 0,
          paymentMode,
          loyaltyPointsEarned: newLoyaltyPointsEarned,
          status: status || (isPaid ? 'COMPLETED' : 'PENDING'),
          waiterName: waiterName || null,
          tableName: tableName || null,
          tableId: tableId || null,
          notes: notes || null,
          serviceCharge: Number(serviceCharge) || 0,
          parcelCharge: Number(parcelCharge) || 0,
          deliveryCharge: Number(deliveryCharge) || 0,
          shiftId: shiftId || null,
          kotCount: Number(kotCount) || 0,
          orderItems: {
            create: newItems.map((item) => {
              const pid = item.productId || item.id;
              const p = productMap.get(pid);
              const price = item.price || item.sellingPrice || p.sellingPrice;
              const gst = parseFloat(item.gstRate ?? p.gstRate ?? 18);
              return {
                productId: pid,
                quantity: item.quantity,
                price: price,
                discount: item.discount || 0,
                taxAmount: (price * (gst / 100)) * item.quantity,
                total: (price * item.quantity) + ((price * (gst / 100)) * item.quantity),
                notes: item.notes || null,
                variant: item.variant || null,
                modifiers: item.modifiers || null
              };
            })
          },
          payments: {
            create: {
              method: paymentMode,
              amount: Number(amountPaid) || 0,
              status: 'SUCCESS'
            }
          }
        },
        include: { orderItems: { include: { product: true } }, payments: true }
      });

      // 7. Manage Dining Table Status
      if (tableId && oldOrder.orderType === 'Dine-in') {
        if (isPaid) {
          // Free table since it is paid
          await tx.table.update({
            where: { id: tableId },
            data: {
              status: 'FREE',
              currentOrderId: null,
              runningOrderAmount: 0,
              occupiedAt: null
            }
          });
        } else {
          // Table remains occupied, update active bill amount
          await tx.table.update({
            where: { id: tableId },
            data: {
              runningOrderAmount: grandTotal
            }
          });
        }
      }

      // 7. Update new customer loyalty
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            loyaltyPoints: { increment: newLoyaltyPointsEarned },
            totalSpent: { increment: Number(grandTotal) },
            creditBalance: { increment: Number(balance) || 0 }
          }
        });
      }

      // 8. Emit events
      const io = req.app.get('io');
      if (io) {
          io.emit('INVENTORY_UPDATE', { items: newItems });
          io.emit('ORDER_UPDATED', finalOrder);
      }

      return finalOrder;
    }, { timeout: 30000 });

    console.log(`[Order API] Edit Success in ${Date.now() - startTime}ms`);
    res.json(updatedOrder);
  } catch (error) {
    console.error('[Order API] Edit FAILED:', error);
    res.status(500).json({ error: error.message });
  }
});

// Settle Credit Payment for an order
router.patch('/:id/settle-credit', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { id } = req.params;
  const { settleAmount, method } = req.body;

  if (!settleAmount || settleAmount <= 0) {
    return res.status(400).json({ error: 'Valid settlement amount is required.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get the order and lock it
      const order = await tx.order.findUnique({
        where: { id },
        include: { customer: true }
      });

      if (!order) throw new Error('Order not found.');
      if (order.balance <= 0) throw new Error('Order is already fully paid.');
      
      const paymentAmount = Math.min(Number(settleAmount), order.balance);

      // 2. Update Order
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          amountPaid: { increment: paymentAmount },
          balance: { decrement: paymentAmount }
        }
      });

      // 3. Create Payment Record
      await tx.payment.create({
        data: {
          orderId: id,
          method: method || 'CASH',
          amount: paymentAmount,
          status: 'SUCCESS'
        }
      });

      // 4. Update Customer Credit Balance
      if (order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            creditBalance: { decrement: paymentAmount }
          }
        });
      }

      return updatedOrder;
    });

    res.json(result);
  } catch (error) {
    console.error('Settlement Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete existing order completely (with inventory reversal)
router.delete('/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    console.log(`[Order API] Starting deletion for: ${id}`);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch old order
      const oldOrder = await tx.order.findFirst({
        where: { 
          OR: [
            { id: id },
            { invoiceNo: id }
          ]
        },
        include: { 
          orderItems: true, 
          customer: true,
          salesReturns: {
            include: { returnItems: true }
          }
        }
      });

      if (!oldOrder) return { status: 404, error: 'Order not found' };

      const orderId = oldOrder.id;
      const invoiceNo = oldOrder.invoiceNo;
      console.log(`[Order API] Step 1: Found Order ${invoiceNo}`);

      // 2. REVERSE: Sales Returns
      if (oldOrder.salesReturns && oldOrder.salesReturns.length > 0) {
        console.log(`[Order API] Step 2: Reversing ${oldOrder.salesReturns.length} returns`);
        const returnOps = [];
        for (const ret of oldOrder.salesReturns) {
          for (const rItem of ret.returnItems) {
            returnOps.push(tx.product.update({
              where: { id: rItem.productId },
              data: { stockQuantity: { decrement: rItem.quantity } }
            }));
          }
          if (oldOrder.customerId) {
            returnOps.push(tx.customer.update({
              where: { id: oldOrder.customerId },
              data: { creditBalance: { decrement: ret.totalAmount } }
            }));
          }
          returnOps.push(tx.salesReturnItem.deleteMany({ where: { salesReturnId: ret.id } }));
          returnOps.push(tx.salesReturn.delete({ where: { id: ret.id } }));
        }
        await Promise.all(returnOps);
      }

      // 3. REVERSE: Customer Loyalty
      if (oldOrder.customerId && oldOrder.customer) {
        console.log(`[Order API] Step 3: Reversing Loyalty`);
        const pointsToReverse = (oldOrder.loyaltyPointsEarned || 0) - (oldOrder.loyaltyPointsRedeemed || 0);
        const customerUpdateData = {
          totalSpent: { decrement: oldOrder.grandTotal },
          creditBalance: { decrement: oldOrder.balance || 0 }
        };
        if (pointsToReverse > 0) {
          customerUpdateData.loyaltyPoints = { decrement: Math.min(oldOrder.customer.loyaltyPoints, pointsToReverse) };
        } else if (pointsToReverse < 0) {
          customerUpdateData.loyaltyPoints = { increment: Math.abs(pointsToReverse) };
        }
        await tx.customer.update({ where: { id: oldOrder.customerId }, data: customerUpdateData });
      }

      // 4. REVERSE: Order Items Stock & Recipes
      console.log(`[Order API] Step 4: Reversing Stock & Recipes`);
      
      const productIds = oldOrder.orderItems.map(i => i.productId);
      const productsFromDb = await tx.product.findMany({
        where: { id: { in: productIds } }
      });
      const productMap = new Map(productsFromDb.map(p => [p.id, p]));

      const itemOps = oldOrder.orderItems.map(item => {
        if (!item.productId) return null;
        return [
          tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } }
          }),
          tx.inventoryLog.create({
            data: {
              productId: item.productId,
              type: 'IN',
              quantity: item.quantity,
              reason: `Delete Reverse: ${invoiceNo}`
            }
          })
        ];
      }).flat().filter(Boolean);
      await Promise.all(itemOps);

      // Reverse raw material recipe stocks
      for (const item of oldOrder.orderItems) {
        const p = productMap.get(item.productId);
        if (p && p.recipe && Array.isArray(p.recipe)) {
          for (const ingredient of p.recipe) {
            const rawId = ingredient.rawMaterialId;
            const ingredientQty = Number(ingredient.quantity) || 0;
            const totalReverse = ingredientQty * item.quantity;
            if (rawId && totalReverse > 0) {
              await tx.rawMaterial.update({
                where: { id: rawId },
                data: { stockQuantity: { increment: totalReverse } }
              });
            }
          }
        }
      }

      // Free dining table if dine-in
      if (oldOrder.tableId && oldOrder.orderType === 'Dine-in') {
        await tx.table.update({
          where: { id: oldOrder.tableId },
          data: {
            status: 'FREE',
            currentOrderId: null,
            runningOrderAmount: 0,
            occupiedAt: null
          }
        });
      }

      // 5. CLEANUP: Expenses
      console.log(`[Order API] Step 5: Cleaning Expenses`);
      await tx.expense.deleteMany({
        where: {
          description: { contains: `Invoice ${invoiceNo}` },
          type: 'Discount'
        }
      });

      // 6. DELETE: Final
      console.log(`[Order API] Step 6: Final Deletion`);
      await tx.orderItem.deleteMany({ where: { orderId: orderId } });
      await tx.payment.deleteMany({ where: { orderId: orderId } });
      await tx.order.delete({ where: { id: orderId } });

      return { status: 200, orderItems: oldOrder.orderItems, orderId, invoiceNo };
    }, { timeout: 30000 });

    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.error });
    }

    // 7. Emit events
    try {
      const io = req.app.get('io');
      if (io) {
          io.emit('INVENTORY_UPDATE', { items: result.orderItems });
          io.emit('ORDER_DELETED', { id: result.orderId, invoiceNo: result.invoiceNo });
      }
    } catch (ioErr) {
      console.error('[Order API] Socket Error:', ioErr);
    }

    console.log(`[Order API] Delete Success for ${id}`);
    res.json({ success: true, message: 'Order and associated data deleted successfully' });
  } catch (error) {
    console.error(`[Order API] Delete FAILED for ${id}:`, error);
    res.status(500).json({ 
      error: error.message || 'Failed to delete order',
      code: error.code || 'UNKNOWN_ERROR',
      details: error.stack
    });
  }
});

module.exports = router;
