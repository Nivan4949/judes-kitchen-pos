const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Get all expense categories
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    res.status(500).json({ message: 'Server error fetching expense categories' });
  }
});

// Create a new expense category
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const newCategory = await prisma.expenseCategory.create({
      data: { name: name.trim() }
    });
    
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error creating expense category:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'An expense category with this name already exists' });
    }
    res.status(500).json({ message: 'Server error creating expense category' });
  }
});

// Delete an expense category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.expenseCategory.delete({
      where: { id }
    });
    res.json({ message: 'Expense category deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense category:', error);
    res.status(500).json({ message: 'Server error deleting expense category' });
  }
});

// Update an expense category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const updatedCategory = await prisma.expenseCategory.update({
      where: { id },
      data: { name: name.trim() }
    });

    res.json(updatedCategory);
  } catch (error) {
    console.error('Error updating expense category:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'An expense category with this name already exists' });
    }
    res.status(500).json({ message: 'Server error updating expense category' });
  }
});

module.exports = router;
