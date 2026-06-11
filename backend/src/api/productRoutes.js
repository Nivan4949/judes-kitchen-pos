const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Get all products with search and category filter
router.get('/', async (req, res) => {
  try {
    const { search, categoryId, activeOnly } = req.query;
    const products = await prisma.product.findMany({
      where: {
        AND: [
          search ? {
            OR: [
              { name: { contains: search } },
              { barcode: { contains: search } }
            ]
          } : {},
          categoryId ? { categoryId } : {},
          activeOnly === 'true' ? { is_active: true } : {}
        ]
      },
      include: {
        category: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create product
router.post('/', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const {
      name, barcode, categoryId, brand, purchasePrice, 
      sellingPrice, mrp, gstRate, stockQuantity, unit, supplier, 
      image, is_active,
      foodType, availability, variants, addons, preparationTime, kitchenDept, recipe
    } = req.body;

    let finalBarcode = barcode;
    if (!finalBarcode || finalBarcode.trim() === '') {
      finalBarcode = 'PRD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    }

    const product = await prisma.product.create({
      data: {
        name,
        barcode: finalBarcode,
        brand,
        purchasePrice: parseFloat(purchasePrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        mrp: parseFloat(mrp) || 0,
        gstRate: parseFloat(gstRate ?? 18),
        stockQuantity: parseFloat(stockQuantity) || 0,
        unit: unit || 'pcs',
        supplier,
        image,
        is_active: is_active ?? true,
        categoryId: categoryId || null,
        foodType: foodType || 'VEG',
        availability: availability !== undefined ? Boolean(availability) : true,
        variants: variants || null,
        addons: addons || null,
        preparationTime: preparationTime !== undefined ? parseInt(preparationTime) : 15,
        kitchenDept: kitchenDept || 'MAIN_KITCHEN',
        recipe: recipe || null
      }
    });
    res.json(product);
  } catch (error) {
    console.error('Prisma Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update product
router.put('/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, barcode, categoryId, brand, purchasePrice, 
      sellingPrice, mrp, gstRate, stockQuantity, unit, supplier, 
      image, is_active,
      foodType, availability, variants, addons, preparationTime, kitchenDept, recipe
    } = req.body;

    const updateData = {
      name,
      brand,
      purchasePrice: parseFloat(purchasePrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      mrp: parseFloat(mrp) || 0,
      gstRate: parseFloat(gstRate ?? 18),
      stockQuantity: parseFloat(stockQuantity) || 0,
      unit,
      supplier,
      image,
      is_active: is_active ?? true,
      categoryId: categoryId || null,
      foodType: foodType !== undefined ? foodType : undefined,
      availability: availability !== undefined ? Boolean(availability) : undefined,
      variants: variants !== undefined ? variants : undefined,
      addons: addons !== undefined ? addons : undefined,
      preparationTime: preparationTime !== undefined ? parseInt(preparationTime) : undefined,
      kitchenDept: kitchenDept !== undefined ? kitchenDept : undefined,
      recipe: recipe !== undefined ? recipe : undefined
    };

    // Handle barcode specifically
    if (barcode !== undefined) {
      updateData.barcode = (barcode === '' || barcode === null) ? null : barcode;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Patch product (Partial update, e.g. for status toggle)
router.patch('/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};
    
    // Copy only defined fields from body
    const fields = [
      'name', 'barcode', 'categoryId', 'brand', 'purchasePrice', 
      'sellingPrice', 'mrp', 'gstRate', 'stockQuantity', 'unit', 
      'supplier', 'image', 'is_active', 'foodType', 'availability', 
      'variants', 'addons', 'preparationTime', 'kitchenDept', 'recipe'
    ];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (['purchasePrice', 'sellingPrice', 'mrp', 'gstRate', 'stockQuantity'].includes(field)) {
          updateData[field] = parseFloat(req.body[field]) || 0;
        } else if (field === 'preparationTime') {
          updateData[field] = parseInt(req.body[field]) || 0;
        } else if (field === 'availability' || field === 'is_active') {
          updateData[field] = Boolean(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    const product = await prisma.product.update({
      where: { id },
      data: updateData
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete product (Smart Delete: Soft-delete if history exists)
router.delete('/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    
    try {
      // Try Hard Delete
      await prisma.product.delete({ where: { id } });
      res.json({ message: 'Product fully deleted from system.' });
    } catch (dbError) {
      // If error P2003 (Foreign Key Constraint), then Archive
      if (dbError.code === 'P2003') {
        await prisma.product.update({ 
          where: { id }, 
          data: { is_active: false } 
        });
        res.json({ message: 'Product archived (set to inactive) instead of deleted, because it has transaction history.' });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle product active status
router.put('/inactive/:id', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    if (is_active === undefined) return res.status(400).json({ message: 'is_active is required' });
    
    const product = await prisma.product.update({
      where: { id },
      data: { is_active }
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Barcode
router.post('/generate-barcode', auth(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const uniqueBarcode = 'PRD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    res.json({ barcode: uniqueBarcode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scan Barcode
router.post('/scan-barcode', async (req, res) => {
  try {
    const { barcode } = req.body;
    if (!barcode) return res.status(400).json({ message: 'Barcode is required' });
    
    const product = await prisma.product.findUnique({
      where: { barcode },
      include: { category: true }
    });
    
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (!product.is_active) return res.status(400).json({ message: 'Product is inactive' });
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get product by barcode
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const product = await prisma.product.findUnique({
      where: { barcode },
      include: { category: true }
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get low stock products
router.get('/low-stock', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    const products = await prisma.product.findMany({
      where: {
        stockQuantity: { lt: threshold },
        is_active: true
      },
      include: { category: true },
      orderBy: { stockQuantity: 'asc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get last purchase price for a product
router.get('/last-purchase-price/:productId', auth(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const { productId } = req.params;
    // Fetch last few purchase items to find the latest date in JS (safer than nested orderBy in some envs)
    const items = await prisma.purchaseItem.findMany({
      where: { productId },
      take: 10,
      include: { 
        purchase: { 
          select: { date: true, supplierName: true } 
        } 
      },
      orderBy: { id: 'desc' } // Secondary sort by creation
    });
    
    if (!items || items.length === 0) return res.json({ price: 0 });

    // Sort by actual purchase date
    const latest = items.sort((a, b) => new Date(b.purchase.date).getTime() - new Date(a.purchase.date).getTime())[0];
    res.json(latest || { price: 0 });
  } catch (error) {
    console.error('Last Price Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
