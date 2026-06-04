const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// List devices for a user/admin
router.get('/', auth(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const where = req.user.role === 'ADMIN' ? {} : { licenseId: req.user.licenseId };
        const devices = await prisma.device.findMany({ 
            where,
            include: { user: { select: { name: true, email: true } } }
        });
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Authorize/Deauthorize a device (Admin only)
router.put('/:id/authorize', auth(['ADMIN']), async (req, res) => {
    const { authorized } = req.body;
    const { id } = req.params;
    try {
        const device = await prisma.device.update({
            where: { id },
            data: { authorized }
        });
        res.json({ message: `Device ${authorized ? 'authorized' : 'deauthorized'} successfully`, device });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a device
router.delete('/:id', auth(['ADMIN']), async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.device.delete({ where: { id } });
        res.json({ message: 'Device removed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
