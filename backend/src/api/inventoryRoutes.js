const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Simple in-memory lock (for production use Redis or DB-based lock)
const locks = new Map();

router.post('/lock/:productId', (req, res) => {
    const { productId } = req.params;
    const { terminalId } = req.body;

    const existingLock = locks.get(productId);
    if (existingLock && existingLock.terminalId !== terminalId && Date.now() - existingLock.timestamp < 30000) {
        return res.status(423).json({ message: 'Product is being billed on another terminal' });
    }

    locks.set(productId, { terminalId, timestamp: Date.now() });
    res.json({ status: 'locked' });
});

router.post('/unlock/:productId', (req, res) => {
    const { productId } = req.params;
    const { terminalId } = req.body;

    const existingLock = locks.get(productId);
    if (existingLock && existingLock.terminalId === terminalId) {
        locks.delete(productId);
    }
    res.json({ status: 'unlocked' });
});

module.exports = router;
