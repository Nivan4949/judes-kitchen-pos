const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');
const apService = require('../services/apService');

// Get Summary of all payables
router.get('/summary', auth(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            where: { is_active: true },
            select: {
                id: true,
                name: true,
                phone: true,
                openingBalance: true,
                purchases: {
                    select: {
                        grandTotal: true,
                        amountPaid: true
                    }
                },
                purchaseReturns: {
                    select: {
                        totalAmount: true
                    }
                },
                payments: {
                    select: {
                        amount: true
                    }
                }
            }
        });

        // Calculate net payable for each supplier
        const summaries = suppliers.map(s => {
            const totalPurchases = s.purchases.reduce((acc, p) => acc + p.grandTotal, 0);
            const totalPaidTowardsPurchases = s.purchases.reduce((acc, p) => acc + p.amountPaid, 0);
            const totalDirectPayments = s.payments.reduce((acc, p) => acc + p.amount, 0);
            const totalReturns = s.purchaseReturns.reduce((acc, r) => acc + r.totalAmount, 0);
            
            // Total Payments = Paid on bills + Advances
            const totalPaid = totalPaidTowardsPurchases + totalDirectPayments;
            
            // Payable = Opening + Purchases - Returns - Total Paid
            const balance = s.openingBalance + totalPurchases - totalReturns - totalPaid;
            
            return {
                id: s.id,
                name: s.name,
                phone: s.phone,
                balance: Number(balance.toFixed(2)),
                status: balance > 0 ? 'DUE' : (balance < 0 ? 'ADVANCE' : 'CLEARED')
            };
        });

        const totalDebt = summaries.reduce((acc, s) => acc + (s.balance > 0 ? s.balance : 0), 0);

        res.json({ summaries, totalDebt: Number(totalDebt.toFixed(2)) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Ledger for a specific supplier
router.get('/ledger/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const ledger = await apService.getSupplierLedger(req.params.id);
        res.json(ledger);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create PURCHASE transaction
router.post('/purchase', auth(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const io = req.app.get('io');
        const purchase = await apService.processPurchase(req.body, io);
        res.json(purchase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create PAYMENT_OUT transaction (General Settlement)
router.post('/payment-out', auth(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const result = await apService.processPaymentOut(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete PURCHASE transaction
router.delete('/purchase/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const io = req.app.get('io');
        const deleted = await apService.deletePurchase(req.params.id, io);
        res.json(deleted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete PAYMENT_OUT transaction
router.delete('/payment/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const deleted = await apService.deletePaymentOut(req.params.id);
        res.json(deleted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
