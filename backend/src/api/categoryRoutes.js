const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create category (Admin/Manager only)
router.post('/', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const category = await prisma.category.create({
      data: { name }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update category (Admin/Manager only)
router.put('/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const category = await prisma.category.update({
      where: { id },
      data: { name }
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete category (Admin only)
router.delete('/:id', auth(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    // Disconnect products before deleting category
    await prisma.product.updateMany({
      where: { categoryId: id },
      data: { categoryId: null }
    });
    
    await prisma.category.delete({
      where: { id }
    });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
