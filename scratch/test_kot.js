const axios = require('axios');

// We will fetch a product to get a valid productId
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  // Get a valid product and table
  const product = await prisma.product.findFirst();
  const table = await prisma.table.findFirst();
  const user = await prisma.user.findFirst();

  if (!product || !table || !user) {
    console.error('Prerequisites not met: need at least 1 product, 1 table, and 1 cashier user.');
    return;
  }

  // Generate JWT token for user
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'freshnaad_pos_enterprise_secret_2026',
    { expiresIn: '1d' }
  );

  const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('Using product:', product.name, 'ID:', product.id);
  console.log('Using table:', table.number, 'ID:', table.id);

  const orderId = 'test-order-' + Date.now();
  console.log('Optimistic orderId:', orderId);

  const orderPayload = {
    id: orderId,
    invoiceNo: (Date.now() % 10000).toString(),
    orderItems: [{
      productId: product.id,
      quantity: 1,
      price: product.sellingPrice,
      mrp: product.mrp || product.sellingPrice,
      gstRate: product.gstRate || 18,
      discount: 0,
      total: product.sellingPrice,
      notes: null,
      variant: null,
      modifiers: []
    }],
    subtotal: product.sellingPrice,
    discount: 0,
    taxTotal: 0,
    grandTotal: product.sellingPrice,
    roundedTotal: product.sellingPrice,
    savings: 0,
    amountPaid: 0,
    balance: product.sellingPrice,
    paymentMode: 'CASH',
    orderType: 'Dine-in',
    waiterName: 'TEST WAITER',
    tableName: table.number,
    tableId: table.id,
    notes: null,
    parcelCharge: 0,
    deliveryCharge: 0,
    shiftId: null,
    status: 'PENDING'
  };

  const kotItems = [{
    productId: product.id,
    name: product.name,
    quantity: 1,
    price: product.sellingPrice,
    notes: null,
    variant: null,
    modifiers: []
  }];

  console.log('\nStarting concurrent calls...');
  
  // Start order save
  const orderPromise = api.post('/orders', orderPayload)
    .then(res => {
      console.log('Order save returned 200 OK! ID:', res.data.id);
      return res.data;
    })
    .catch(err => {
      console.error('Order save failed! Status:', err.response?.status, 'Error:', err.response?.data);
      throw err;
    });

  // Start KOT generation
  const kotPromise = api.post('/kots', {
    orderId: orderId,
    tableId: table.id,
    tableName: table.number,
    waiterName: 'TEST WAITER',
    orderType: 'Dine-in',
    items: kotItems,
    cancellationReasons: {}
  })
    .then(res => {
      console.log('KOT save returned 200 OK! ID:', res.data.kot?.id);
      return res.data;
    })
    .catch(err => {
      console.error('KOT save failed! Status:', err.response?.status, 'Error:', err.response?.data);
      throw err;
    });

  try {
    await Promise.all([orderPromise, kotPromise]);
    console.log('\nBoth requests resolved successfully concurrently!');
  } catch (err) {
    console.error('\nConcurrency test failed.');
  }
}

runTest().catch(err => console.error(err)).finally(() => prisma.$disconnect());
