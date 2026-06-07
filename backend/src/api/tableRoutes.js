const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Get all tables (with section and active running order, if occupied)
router.get('/', auth(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN']), async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      include: {
        section: true
      },
      orderBy: {
        number: 'asc'
      }
    });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all table sections
router.get('/sections', auth(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER']), async (req, res) => {
  try {
    const sections = await prisma.tableSection.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a table section
router.post('/sections', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Section name is required' });

  try {
    const section = await prisma.tableSection.create({
      data: { name }
    });
    res.json(section);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a table section
router.delete('/sections/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { id } = req.params;
  try {
    // Delete section (Prisma will set sectionId to null in tables, or we can handle it)
    await prisma.tableSection.delete({
      where: { id }
    });
    res.json({ message: 'Section deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new table
router.post('/', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { number, capacity, sectionId } = req.body;
  if (!number || !capacity) {
    return res.status(400).json({ error: 'Table number and capacity are required' });
  }

  try {
    const table = await prisma.table.create({
      data: {
        number,
        capacity: Number(capacity),
        sectionId: sectionId || null,
        status: 'FREE'
      }
    });
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a table
router.put('/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { id } = req.params;
  const { number, capacity, sectionId, status, currentOrderId, runningOrderAmount } = req.body;

  try {
    const updateData = {};
    if (number !== undefined) updateData.number = number;
    if (capacity !== undefined) updateData.capacity = Number(capacity);
    if (sectionId !== undefined) updateData.sectionId = sectionId || null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'FREE') {
        updateData.currentOrderId = null;
        updateData.runningOrderAmount = 0;
        updateData.occupiedAt = null;
      } else if (status === 'OCCUPIED' && !updateData.occupiedAt) {
        updateData.occupiedAt = new Date();
      }
    }
    if (currentOrderId !== undefined) updateData.currentOrderId = currentOrderId;
    if (runningOrderAmount !== undefined) updateData.runningOrderAmount = Number(runningOrderAmount);

    const table = await prisma.table.update({
      where: { id },
      data: updateData
    });
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a table
router.delete('/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { id } = req.params;
  try {
    const table = await prisma.table.findUnique({ where: { id } });
    if (table && table.status === 'OCCUPIED') {
      return res.status(400).json({ error: 'Cannot delete an occupied table' });
    }

    await prisma.table.delete({ where: { id } });
    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer Table Order
router.post('/transfer', auth(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER']), async (req, res) => {
  const { sourceTableId, targetTableId } = req.body;
  if (!sourceTableId || !targetTableId) {
    return res.status(400).json({ error: 'Source and target tables are required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sourceTable = await tx.table.findUnique({ where: { id: sourceTableId } });
      const targetTable = await tx.table.findUnique({ where: { id: targetTableId } });

      if (!sourceTable || sourceTable.status !== 'OCCUPIED' || !sourceTable.currentOrderId) {
        throw new Error('Source table must be occupied and have a running order');
      }

      if (!targetTable || targetTable.status !== 'FREE') {
        throw new Error('Target table must be free to transfer order');
      }

      // Transfer order details to target table
      await tx.table.update({
        where: { id: targetTableId },
        data: {
          status: 'OCCUPIED',
          currentOrderId: sourceTable.currentOrderId,
          runningOrderAmount: sourceTable.runningOrderAmount,
          occupiedAt: sourceTable.occupiedAt
        }
      });

      // Update Order record itself (if any) with the target table details
      await tx.order.update({
        where: { id: sourceTable.currentOrderId },
        data: {
          tableId: targetTableId,
          tableName: targetTable.number
        }
      });

      // Free source table
      await tx.table.update({
        where: { id: sourceTableId },
        data: {
          status: 'FREE',
          currentOrderId: null,
          runningOrderAmount: 0,
          occupiedAt: null
        }
      });

      return { success: true, message: `Order transferred from Table ${sourceTable.number} to Table ${targetTable.number}` };
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Merge Tables (Combines source running order into target table's running order)
router.post('/merge', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  const { sourceTableId, targetTableId } = req.body;
  if (!sourceTableId || !targetTableId) {
    return res.status(400).json({ error: 'Source and target tables are required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sourceTable = await tx.table.findUnique({ where: { id: sourceTableId } });
      const targetTable = await tx.table.findUnique({ where: { id: targetTableId } });

      if (!sourceTable || sourceTable.status !== 'OCCUPIED' || !sourceTable.currentOrderId) {
        throw new Error('Source table must be occupied with a running order');
      }
      if (!targetTable || targetTable.status !== 'OCCUPIED' || !targetTable.currentOrderId) {
        throw new Error('Target table must be occupied with a running order to merge');
      }

      // Move source order items to target order
      const sourceItems = await tx.orderItem.findMany({
        where: { orderId: sourceTable.currentOrderId }
      });

      for (const item of sourceItems) {
        // Check if item already exists in target order
        const existing = await tx.orderItem.findFirst({
          where: {
            orderId: targetTable.currentOrderId,
            productId: item.productId,
            variant: item.variant
          }
        });

        if (existing) {
          // Increment quantity and total
          await tx.orderItem.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + item.quantity,
              total: existing.total + item.total,
              taxAmount: existing.taxAmount + item.taxAmount
            }
          });
        } else {
          // Create new order item under target order
          await tx.orderItem.create({
            data: {
              orderId: targetTable.currentOrderId,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              mrp: item.mrp,
              discount: item.discount,
              taxAmount: item.taxAmount,
              total: item.total,
              notes: item.notes,
              variant: item.variant,
              modifiers: item.modifiers
            }
          });
        }
      }

      // Delete source order items
      await tx.orderItem.deleteMany({
        where: { orderId: sourceTable.currentOrderId }
      });

      // Update KOT records linked to the source order to point to target order
      await tx.kot.updateMany({
        where: { orderId: sourceTable.currentOrderId },
        data: {
          orderId: targetTable.currentOrderId,
          tableId: targetTableId,
          tableName: targetTable.number
        }
      });

      // Fetch target order totals and update
      const allTargetItems = await tx.orderItem.findMany({
        where: { orderId: targetTable.currentOrderId }
      });

      const subtotal = allTargetItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const taxTotal = allTargetItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const discount = allTargetItems.reduce((sum, item) => sum + item.discount, 0);
      const grandTotal = subtotal + taxTotal - discount;

      await tx.order.update({
        where: { id: targetTable.currentOrderId },
        data: {
          subtotal,
          taxTotal,
          grandTotal,
          roundedTotal: Math.floor(grandTotal),
          balance: Math.floor(grandTotal)
        }
      });

      // Update target table amount
      await tx.table.update({
        where: { id: targetTableId },
        data: {
          runningOrderAmount: grandTotal
        }
      });

      // Delete source order
      await tx.order.delete({
        where: { id: sourceTable.currentOrderId }
      });

      // Free source table
      await tx.table.update({
        where: { id: sourceTableId },
        data: {
          status: 'FREE',
          currentOrderId: null,
          runningOrderAmount: 0,
          occupiedAt: null
        }
      });

      return { success: true, message: 'Tables merged successfully' };
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Split Order / Table (Splits selected items to a new table or takeaway order)
router.post('/split', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  const { sourceTableId, targetTableId, itemsToSplit } = req.body;
  // itemsToSplit: Array of { orderItemId: string, quantity: number }

  if (!sourceTableId || !itemsToSplit || itemsToSplit.length === 0) {
    return res.status(400).json({ error: 'Source table and items to split are required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sourceTable = await tx.table.findUnique({ where: { id: sourceTableId } });
      if (!sourceTable || sourceTable.status !== 'OCCUPIED' || !sourceTable.currentOrderId) {
        throw new Error('Source table must be occupied with a running order');
      }

      // Generate a new Order for target table / takeaway
      const sourceOrder = await tx.order.findUnique({
        where: { id: sourceTable.currentOrderId },
        include: { orderItems: true }
      });

      let targetOrderId;
      let targetTable;

      if (targetTableId) {
        // Dine-in target
        targetTable = await tx.table.findUnique({ where: { id: targetTableId } });
        if (!targetTable || targetTable.status !== 'FREE') {
          throw new Error('Target table must be free');
        }
      }

      // Generate invoice number for the split order
      const rawMax = await tx.$queryRaw`
        SELECT MAX(CAST("invoiceNo" AS INTEGER)) as "maxNum" 
        FROM "Order" 
        WHERE "invoiceNo" ~ '^[0-9]+$' AND "invoiceNo" NOT LIKE '9%'
      `;
      const maxNum = Number(rawMax[0]?.maxNum) || 99;
      const invoiceNo = (maxNum + 1).toString();

      // Create new order
      const newOrder = await tx.order.create({
        data: {
          invoiceNo,
          orderType: targetTable ? 'Dine-in' : 'Takeaway',
          paymentMode: 'CASH',
          status: 'PENDING',
          tableId: targetTableId || null,
          tableName: targetTable ? targetTable.number : null,
          subtotal: 0,
          taxTotal: 0,
          grandTotal: 0,
          roundedTotal: 0,
          balance: 0,
          creatorId: req.user?.id || null
        }
      });
      targetOrderId = newOrder.id;

      // Transfer split items
      for (const splitInfo of itemsToSplit) {
        const sourceItem = sourceOrder.orderItems.find(i => i.id === splitInfo.orderItemId);
        if (!sourceItem) throw new Error(`Item ${splitInfo.orderItemId} not found in order`);

        if (splitInfo.quantity > sourceItem.quantity) {
          throw new Error(`Cannot split more quantity than ordered for ${sourceItem.productId}`);
        }

        const pricePerUnit = sourceItem.price;
        const taxPerUnit = sourceItem.taxAmount / sourceItem.quantity;
        const totalPerUnit = sourceItem.total / sourceItem.quantity;

        // Add to new order
        await tx.orderItem.create({
          data: {
            orderId: targetOrderId,
            productId: sourceItem.productId,
            quantity: splitInfo.quantity,
            price: pricePerUnit,
            mrp: sourceItem.mrp,
            discount: sourceItem.discount * (splitInfo.quantity / sourceItem.quantity),
            taxAmount: taxPerUnit * splitInfo.quantity,
            total: totalPerUnit * splitInfo.quantity,
            notes: sourceItem.notes,
            variant: sourceItem.variant,
            modifiers: sourceItem.modifiers
          }
        });

        // Deduct from old order
        if (sourceItem.quantity === splitInfo.quantity) {
          await tx.orderItem.delete({ where: { id: sourceItem.id } });
        } else {
          await tx.orderItem.update({
            where: { id: sourceItem.id },
            data: {
              quantity: sourceItem.quantity - splitInfo.quantity,
              taxAmount: sourceItem.taxAmount - (taxPerUnit * splitInfo.quantity),
              total: sourceItem.total - (totalPerUnit * splitInfo.quantity)
            }
          });
        }
      }

      // Re-calculate totals for source order
      const remainingSourceItems = await tx.orderItem.findMany({
        where: { orderId: sourceTable.currentOrderId }
      });

      const srcSub = remainingSourceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const srcTax = remainingSourceItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const srcDiscount = remainingSourceItems.reduce((sum, item) => sum + item.discount, 0);
      const srcGrand = srcSub + srcTax - srcDiscount;

      await tx.order.update({
        where: { id: sourceTable.currentOrderId },
        data: {
          subtotal: srcSub,
          taxTotal: srcTax,
          grandTotal: srcGrand,
          roundedTotal: Math.floor(srcGrand),
          balance: Math.floor(srcGrand)
        }
      });

      // Update source table running amount
      await tx.table.update({
        where: { id: sourceTableId },
        data: {
          runningOrderAmount: srcGrand
        }
      });

      // Re-calculate totals for target order
      const targetItems = await tx.orderItem.findMany({
        where: { orderId: targetOrderId }
      });

      const tgtSub = targetItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tgtTax = targetItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const tgtDiscount = targetItems.reduce((sum, item) => sum + item.discount, 0);
      const tgtGrand = tgtSub + tgtTax - tgtDiscount;

      await tx.order.update({
        where: { id: targetOrderId },
        data: {
          subtotal: tgtSub,
          taxTotal: tgtTax,
          grandTotal: tgtGrand,
          roundedTotal: Math.floor(tgtGrand),
          balance: Math.floor(tgtGrand)
        }
      });

      // Link target table if dine-in
      if (targetTable) {
        await tx.table.update({
          where: { id: targetTableId },
          data: {
            status: 'OCCUPIED',
            currentOrderId: targetOrderId,
            runningOrderAmount: tgtGrand,
            occupiedAt: new Date()
          }
        });
      }

      return { success: true, message: 'Order split successfully', newOrderId: targetOrderId };
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
