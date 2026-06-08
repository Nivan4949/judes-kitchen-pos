const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Get restaurant settings (Returns default if not found)
router.get('/', auth(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN']), async (req, res) => {
  try {
    let settings = await prisma.restaurantSettings.findUnique({
      where: { id: 'settings' }
    });

    if (!settings) {
      settings = await prisma.restaurantSettings.create({
        data: {
          id: 'settings',
          name: "JUDE'S KITCHEN",
          address: 'Kodassery, Malappuram',
          phone: '8606391315',
          gstin: '',
          currency: 'INR',
          gstRate: 5.0,
          parcelCharge: 0,
          deliveryCharge: 0,
          printerSize: '80mm'
        }
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
router.put('/', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  const { name, logo, address, phone, gstin, currency, gstRate, parcelCharge, deliveryCharge, printerSize } = req.body;

  try {
    const settings = await prisma.restaurantSettings.upsert({
      where: { id: 'settings' },
      update: {
        name,
        logo,
        address,
        phone,
        gstin,
        currency,
        gstRate: gstRate !== undefined ? parseFloat(gstRate) : undefined,
        parcelCharge: parcelCharge !== undefined ? parseFloat(parcelCharge) : undefined,
        deliveryCharge: deliveryCharge !== undefined ? parseFloat(deliveryCharge) : undefined,
        printerSize
      },
      create: {
        id: 'settings',
        name: name || "JUDE'S KITCHEN",
        logo,
        address: address || 'Kodassery, Malappuram',
        phone: phone || '8606391315',
        gstin,
        currency: currency || 'INR',
        gstRate: gstRate !== undefined ? parseFloat(gstRate) : 5.0,
        parcelCharge: parcelCharge !== undefined ? parseFloat(parcelCharge) : 0,
        deliveryCharge: deliveryCharge !== undefined ? parseFloat(deliveryCharge) : 0,
        printerSize: printerSize || '80mm'
      }
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
