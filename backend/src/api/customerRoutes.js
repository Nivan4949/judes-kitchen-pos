const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Get all customers
router.get('/', async (req, res) => {
  try {
    const { search, activeOnly } = req.query;
    const customers = await prisma.customer.findMany({
      where: {
        AND: [
          search ? {
            OR: [
              { name: { contains: search || '' } },
              { phone: { contains: search || '' } },
              { email: { contains: search || '' } }
            ]
          } : {},
          activeOnly === 'true' ? { is_active: true } : {}
        ]
      },
      orderBy: { name: 'asc' }
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id }
    });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create customer
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, creditBalance, loyaltyPoints } = req.body;
    const customer = await prisma.customer.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        creditBalance: Number(creditBalance) || 0,
        loyaltyPoints: Number(loyaltyPoints) || 0
      }
    });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, creditBalance, loyaltyPoints, is_active } = req.body;
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        email: email || null,
        creditBalance: Number(creditBalance) || 0,
        loyaltyPoints: Number(loyaltyPoints) || 0,
        is_active
      }
    });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle customer active status
router.put('/inactive/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    if (is_active === undefined) return res.status(400).json({ message: 'is_active is required' });
    
    const customer = await prisma.customer.update({
      where: { id },
      data: { is_active }
    });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Loyalty Update (Earn Points from outside billing, or manual adjustment)
router.post('/loyalty/update', async (req, res) => {
  try {
    const { customerId, pointsToAdd, totalSpentToAdd } = req.body;
    
    if (!customerId) return res.status(400).json({ message: 'Customer ID is required' });

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        loyaltyPoints: { increment: pointsToAdd || 0 },
        totalSpent: { increment: totalSpentToAdd || 0 },
        lastPurchaseDate: new Date()
      }
    });
    
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Loyalty Redeem (Manual redeem outside of billing)
router.post('/loyalty/redeem', async (req, res) => {
  try {
    const { customerId, pointsToRedeem } = req.body;
    
    if (!customerId || !pointsToRedeem) {
      return res.status(400).json({ message: 'Customer ID and points to redeem are required' });
    }

    // Verify customer has enough points
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    if (customer.loyaltyPoints < pointsToRedeem) {
      return res.status(400).json({ message: 'Insufficient loyalty points' });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        loyaltyPoints: { decrement: pointsToRedeem }
      }
    });
    
    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.customer.delete({
      where: { id }
    });
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
