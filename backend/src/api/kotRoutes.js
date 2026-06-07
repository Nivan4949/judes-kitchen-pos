const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Get active KOTs for Kitchen Display Screen (KDS)
router.get('/active', auth(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN']), async (req, res) => {
  try {
    const kots = await prisma.kOT.findMany({
      where: {
        status: { in: ['PENDING', 'PREPARING', 'READY'] }
      },
      include: {
        items: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    res.json(kots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all KOTs
router.get('/', auth(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN']), async (req, res) => {
  try {
    const kots = await prisma.kOT.findMany({
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

// Create KOT (Generates KOT for new or modified items)
router.post('/', auth(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER']), async (req, res) => {
  const { orderId, tableId, tableName, waiterName, orderType, items, cancellationReasons } = req.body;
  // items: Array of { productId, name, quantity, notes, variant, modifiers }

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'KOT must contain items' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Calculate KOT Number
      const today = new Date();
      today.setHours(0,0,0,0);
      const kotCountToday = await tx.kOT.count({
        where: {
          createdAt: { gte: today }
        }
      });
      const kotNo = `KOT-${(kotCountToday + 1).toString().padStart(3, '0')}`;

      // 2. Repeat Order Logic: Find previous KOT items for this orderId (if it exists)
      let itemsToSubmit = [];
      let cancelledItems = [];

      if (orderId) {
        const existingKots = await tx.kOT.findMany({
          where: { orderId },
          include: { items: true }
        });

        // Sum quantities of each product previously sent to kitchen
        const sentQtyMap = {}; // key: productId + '-' + (variant || '')
        existingKots.forEach(kot => {
          kot.items.forEach(item => {
            if (item.status !== 'CANCELLED') {
              const key = `${item.productId}-${item.variant || ''}`;
              sentQtyMap[key] = (sentQtyMap[key] || 0) + item.quantity;
            }
          });
        });

        // Check if there are additions or cancellations
        items.forEach(item => {
          const key = `${item.productId}-${item.variant || ''}`;
          const previouslySent = sentQtyMap[key] || 0;
          const diff = item.quantity - previouslySent;

          if (diff > 0) {
            // New item or additional quantity
            itemsToSubmit.push({
              productId: item.productId,
              name: item.name,
              quantity: diff,
              notes: item.notes || null,
              variant: item.variant || null,
              modifiers: item.modifiers || null
            });
          }
          // Remove from map to check for fully deleted items later
          delete sentQtyMap[key];
        });

        // Any items remaining in sentQtyMap are cancelled/reduced!
        Object.entries(sentQtyMap).forEach(([key, sentQty]) => {
          if (sentQty > 0) {
            // Find item details from request items or database
            const [pId, variant] = key.split('-');
            const reqItem = items.find(i => i.productId === pId && (i.variant || '') === variant);
            
            const reason = (cancellationReasons && cancellationReasons[key]) || 'ITEM CANCELLED';

            // If item still in cart but reduced:
            if (reqItem) {
              const diff = sentQty - reqItem.quantity;
              if (diff > 0) {
                cancelledItems.push({
                  productId: pId,
                  name: reqItem.name,
                  quantity: diff,
                  notes: reason,
                  variant: variant || null
                });
              }
            } else {
              // Completely removed from cart
              cancelledItems.push({
                productId: pId,
                name: 'Item Removed',
                quantity: sentQty,
                notes: reason,
                variant: variant || null
              });
            }
          }
        });
      } else {
        // First KOT for this order - send everything
        itemsToSubmit = items.map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          notes: item.notes || null,
          variant: item.variant || null,
          modifiers: item.modifiers || null
        }));
      }

      // If nothing changed, do not create KOT
      if (itemsToSubmit.length === 0 && cancelledItems.length === 0) {
        return { message: 'No new changes to send to kitchen', empty: true };
      }

      // Create KOT records
      let kotRecord = null;
      if (itemsToSubmit.length > 0) {
        kotRecord = await tx.kOT.create({
          data: {
            kotNo,
            orderId: orderId || null,
            tableId: tableId || null,
            tableName: tableName || null,
            waiterName: waiterName || null,
            orderType: orderType || 'Takeaway',
            status: 'PENDING',
            items: {
              create: itemsToSubmit
            }
          },
          include: {
            items: true
          }
        });
      }

      let cancelKotRecord = null;
      if (cancelledItems.length > 0) {
        const cancelKotNo = `${kotNo}-CAN`;
        cancelKotRecord = await tx.kOT.create({
          data: {
            kotNo: cancelKotNo,
            orderId: orderId || null,
            tableId: tableId || null,
            tableName: tableName || null,
            waiterName: waiterName || null,
            orderType: orderType || 'Takeaway',
            status: 'CANCELLED',
            items: {
              create: cancelledItems.map(item => ({
                ...item,
                status: 'CANCELLED'
              }))
            }
          },
          include: {
            items: true
          }
        });
      }

      // Update active table occupied state & amount if dine-in
      if (tableId && orderId) {
        const orderAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        await tx.table.update({
          where: { id: tableId },
          data: {
            runningOrderAmount: orderAmount,
            status: 'OCCUPIED'
          }
        });
      }

      // Trigger Socket event for Kitchen Display Screen
      const io = req.app.get('io');
      if (io) {
        if (kotRecord) io.emit('NEW_KOT', kotRecord);
        if (cancelKotRecord) io.emit('CANCELLED_KOT', cancelKotRecord);
      }

      return { kot: kotRecord, cancelKot: cancelKotRecord };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update KOT status (Pending -> Preparing -> Ready -> Served)
router.patch('/:id/status', auth(['ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const kot = await prisma.kOT.update({
      where: { id },
      data: { status },
      include: { items: true }
    });

    // Also update KOT Items status if KOT is marked ready/served/cancelled
    await prisma.kOTItem.updateMany({
      where: { kotId: id },
      data: { status }
    });

    // Trigger KDS Socket update
    const io = req.app.get('io');
    if (io) {
      io.emit('KOT_STATUS_UPDATED', kot);
    }

    res.json(kot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update single item status in a KOT
router.patch('/:kotId/items/:itemId/status', auth(['ADMIN', 'MANAGER', 'KITCHEN']), async (req, res) => {
  const { kotId, itemId } = req.params;
  const { status } = req.body;

  try {
    const item = await prisma.kOTItem.update({
      where: { id: itemId },
      data: { status }
    });

    // Check if all items in KOT are ready/served, then update parent KOT status
    const siblingItems = await prisma.kOTItem.findMany({
      where: { kotId }
    });

    const allStatuses = siblingItems.map(i => i.status);
    let newKotStatus = 'PENDING';
    if (allStatuses.every(s => s === 'SERVED')) newKotStatus = 'SERVED';
    else if (allStatuses.every(s => s === 'READY' || s === 'SERVED')) newKotStatus = 'READY';
    else if (allStatuses.some(s => s === 'PREPARING' || s === 'READY')) newKotStatus = 'PREPARING';

    const updatedKot = await prisma.kOT.update({
      where: { id: kotId },
      data: { status: newKotStatus },
      include: { items: true }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('KOT_STATUS_UPDATED', updatedKot);
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reprint KOT
router.post('/:id/reprint', auth(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER']), async (req, res) => {
  const { id } = req.params;
  try {
    const kot = await prisma.kOT.update({
      where: { id },
      data: {
        reprintCount: { increment: 1 }
      },
      include: {
        items: true
      }
    });
    res.json(kot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
