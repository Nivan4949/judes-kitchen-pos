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
