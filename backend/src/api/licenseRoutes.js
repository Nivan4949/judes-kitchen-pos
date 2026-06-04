const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');
const crypto = require('crypto');

// Generate a new license key (Admin only)
router.post('/generate', auth(['ADMIN']), async (req, res) => {
    const { maxDevices, expiryMonths } = req.body;
    try {
        const key = crypto.randomBytes(8).toString('hex').toUpperCase(); // Example: A1B2C3D4E5F6G7H8
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + (expiryMonths || 12));

        const license = await prisma.license.create({
            data: {
                key,
                maxDevices: maxDevices || 1,
                expiryDate,
                status: 'ACTIVE'
            }
        });

        res.json({ message: 'License key generated successfully', license });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate license status
router.post('/validate', async (req, res) => {
    const { key } = req.body;
    try {
        const license = await prisma.license.findUnique({ 
            where: { key },
            include: { _count: { select: { devices: true } } }
        });

        if (!license) {
            return res.status(404).json({ valid: false, message: 'License not found' });
        }

        const isExpired = new Date(license.expiryDate) < new Date();
        const isActive = license.status === 'ACTIVE' && !isExpired;

        res.json({
            valid: isActive,
            status: license.status,
            isExpired,
            expiryDate: license.expiryDate,
            devicesUsed: license._count.devices,
            maxDevices: license.maxDevices
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
