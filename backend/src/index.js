const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

// Prisma Connection Pooling Fix: Ensure stable serverless DB access on Vercel
// Requires ?pgbouncer=true&statement_cache_size=0 in DATABASE_URL

const productRoutes = require('./api/productRoutes');
const orderRoutes = require('./api/orderRoutes');
const customerRoutes = require('./api/customerRoutes');
const reportRoutes = require('./api/reportRoutes');
const expenseRoutes = require('./api/expenseRoutes');
const authRoutes = require('./api/authRoutes');
const categoryRoutes = require('./api/categoryRoutes');
const expenseCategoryRoutes = require('./api/expenseCategoryRoutes');
const app = express();
const PORT = process.env.PORT || 5000;

const prisma = require('./config/prisma');

async function autoSeedDatabase() {
  try {
    console.log('Running auto-seeding database check...');
    
    // Ensure default settings exist
    await prisma.restaurantSettings.upsert({
      where: { id: 'settings' },
      update: {
        name: "JUDE'S KITCHEN",
        address: "DHOTTAPPANKULAM,SULTHAN BATHERY,WAYANAD",
        phone: "+91 89431 21110",
        gstin: ""
      },
      create: {
        id: 'settings',
        name: "JUDE'S KITCHEN",
        address: "DHOTTAPPANKULAM,SULTHAN BATHERY,WAYANAD",
        phone: "+91 89431 21110",
        gstin: "",
        currency: "INR",
        gstRate: 5.0,
        parcelCharge: 10.0,
        deliveryCharge: 30.0,
        printerSize: "80mm",
        maxDiscountPercent: 10.0
      }
    });

    // Ensure categories exist
    const categories = ['Main Course', 'Pizza & Italian', 'Starters', 'Beverages'];
    const catMap = {};
    for (const catName of categories) {
      const category = await prisma.category.upsert({
        where: { name: catName },
        update: {},
        create: { name: catName }
      });
      catMap[catName] = category.id;
    }

    // Ensure our 4 custom menu items exist
    const items = [
      {
        name: 'Beef sp',
        price: 130,
        categoryId: catMap['Main Course'],
        foodType: 'NON-VEG',
        barcode: 'DEMO-BEEF-SP',
        kitchenDept: 'MAIN_KITCHEN',
        preparationTime: 15
      },
      {
        name: 'Kappa',
        price: 70,
        categoryId: catMap['Starters'],
        foodType: 'VEG',
        barcode: 'DEMO-KAPPA',
        kitchenDept: 'MAIN_KITCHEN',
        preparationTime: 10
      },
      {
        name: 'Kappa biriyani',
        price: 130,
        categoryId: catMap['Main Course'],
        foodType: 'NON-VEG',
        barcode: 'DEMO-KAPPA-BIRIYANI',
        kitchenDept: 'MAIN_KITCHEN',
        preparationTime: 15
      },
      {
        name: 'Payyam pori',
        price: 15,
        categoryId: catMap['Starters'],
        foodType: 'VEG',
        barcode: 'DEMO-PAYYAM-PORI',
        kitchenDept: 'MAIN_KITCHEN',
        preparationTime: 5
      }
    ];

    for (const item of items) {
      await prisma.product.upsert({
        where: { barcode: item.barcode },
        update: {
          name: item.name,
          sellingPrice: item.price,
          mrp: item.price,
          purchasePrice: item.price * 0.6,
          categoryId: item.categoryId,
          foodType: item.foodType,
          kitchenDept: item.kitchenDept,
          preparationTime: item.preparationTime,
          stockQuantity: 999,
          availability: true,
          is_active: true
        },
        create: {
          name: item.name,
          barcode: item.barcode,
          sellingPrice: item.price,
          mrp: item.price,
          purchasePrice: item.price * 0.6,
          categoryId: item.categoryId,
          foodType: item.foodType,
          kitchenDept: item.kitchenDept,
          preparationTime: item.preparationTime,
          stockQuantity: 999,
          unit: 'pcs',
          availability: true,
          is_active: true
        }
      });
    }

    // Ensure default table sections and tables exist if empty
    const sectionCount = await prisma.tableSection.count();
    if (sectionCount === 0) {
      const sectionsData = [
        {
          name: 'Main Hall (Non-AC)',
          tables: [
            { number: 'T01', capacity: 4 },
            { number: 'T02', capacity: 4 },
            { number: 'T03', capacity: 2 },
            { number: 'T04', capacity: 6 }
          ]
        },
        {
          name: 'AC Cabin',
          tables: [
            { number: 'A01', capacity: 4 },
            { number: 'A02', capacity: 4 },
            { number: 'A03', capacity: 8 }
          ]
        },
        {
          name: 'Rooftop Garden',
          tables: [
            { number: 'R01', capacity: 4 },
            { number: 'R02', capacity: 4 },
            { number: 'R03', capacity: 2 }
          ]
        }
      ];

      for (const sData of sectionsData) {
        const section = await prisma.tableSection.upsert({
          where: { name: sData.name },
          update: {},
          create: { name: sData.name }
        });
        for (const tData of sData.tables) {
          await prisma.table.upsert({
            where: { number: tData.number },
            update: {
              capacity: tData.capacity,
              sectionId: section.id
            },
            create: {
              number: tData.number,
              capacity: tData.capacity,
              sectionId: section.id,
              status: 'FREE'
            }
          });
        }
      }
    }

    console.log('Auto-seeding completed successfully.');
  } catch (error) {
    console.error('Error during auto-seeding:', error);
  }
}

autoSeedDatabase();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));

const syncRoutes = require('./api/syncRoutes');
const inventoryRoutes = require('./api/inventoryRoutes');
const purchaseRoutes = require('./api/purchaseRoutes');
const supplierRoutes = require('./api/supplierRoutes');
const purchaseOrderRoutes = require('./api/purchaseOrderRoutes');

// Routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/expense-categories', expenseCategoryRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales-returns', require('./api/salesReturnRoutes'));
app.use('/api/purchase-returns', require('./api/purchaseReturnRoutes'));
app.use('/api/licenses', require('./api/licenseRoutes'));
app.use('/api/devices', require('./api/deviceRoutes'));
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/ap', require('./api/apRoutes'));
app.use('/api/tables', require('./api/tableRoutes'));
app.use('/api/kots', require('./api/kotRoutes'));
app.use('/api/shifts', require('./api/shiftRoutes'));
app.use('/api/restaurant-settings', require('./api/settingsRoutes'));

// Health Checks
app.get('/health', (req, res) => {
  const dbUrl = process.env.DATABASE_URL || '';
  const maskedDbUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  res.json({ 
    status: 'ok', 
    message: 'POS Billing System API is running on Vercel',
    dbUrl: maskedDbUrl
  });
});

app.get('/api/health', (req, res) => {
  const dbUrl = process.env.DATABASE_URL || '';
  const maskedDbUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  res.json({ 
    status: 'ok', 
    message: 'API with prefix is active',
    dbUrl: maskedDbUrl
  });
});

// Manual/Vercel Cron Backup Trigger
app.get('/api/backup/trigger', (req, res) => {
  const { exec } = require('child_process');
  const path = require('path');
  const backupScript = path.join(__dirname, '../scripts/backup.js');
  
  exec(`node "${backupScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Backup trigger failed: ${error.message}`);
      return res.status(500).json({ status: 'error', message: 'Backup failed', details: error.message });
    }
    res.json({ status: 'ok', message: 'Backup triggered successfully', output: stdout });
  });
});

// Socket.io & Local Cron initialization (Conditional for Local Dev)
let io;
if (!process.env.VERCEL) {
  const http = require('http');
  const { Server } = require('socket.io');
  const server = http.createServer(app);
  io = new Server(server, {
    cors: { origin: '*' }
  });
  app.set('io', io);

  io.on('connection', (socket) => {
    console.log('Terminal connected:', socket.id);
    socket.on('disconnect', () => console.log('Terminal disconnected'));
  });

  // Start Server Locally
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Enterprise POS is LIVE on Port ${PORT}`);
    console.log(`Local Access: http://localhost:${PORT}`);
    console.log(`Global Strategy: Serving Unified Production Build`);
    
    // Initialize Automated Local Backups
    try {
      const cron = require('node-cron');
      const { exec } = require('child_process');
      const path = require('path');
      const backupScript = path.join(__dirname, '../scripts/backup.js');
      
      // Schedule backup to run Daily at 1:00 AM
      cron.schedule('0 1 * * *', () => {
        console.log(`[${new Date().toISOString()}] Cron trigger: Starting automated backup...`);
        exec(`node "${backupScript}"`, (error, stdout, stderr) => {
          if (error) {
            console.error(`Automated backup failed: ${error.message}`);
          } else {
            console.log(`Automated backup completed:\n${stdout}`);
          }
        });
      });
      console.log(`Automated Backups Scheduler initialized (Daily at 1:00 AM)`);
    } catch (err) {
      console.log('Automated Backups Scheduler failed to start:', err.message);
    }
  });
} else {
  // In Vercel, we just export the app
  console.log('Vercel Serverless: App instance exported. Use vercel.json cron to hit /api/backup/trigger');
}

module.exports = app;
