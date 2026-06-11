const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

async function runTest() {
  const product = await prisma.product.findFirst();
  const table = await prisma.table.findFirst();
  const user = await prisma.user.findFirst();

  if (!product || !table || !user) {
    console.error('Prerequisites missing');
    return;
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'freshnaad_pos_enterprise_secret_2026',
    { expiresIn: '1d' }
  );

  const api = axios.create({
    baseURL: 'https://judes-kitchen-pos-frontend.vercel.app/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  // First, create an order sequentially so it exists.
  const orderId = 'test-put-order-' + Date.now();
  const orderPayload = {
    id: orderId,
    invoiceNo: 'INV-' + Date.now(),
    customerId: null,
    orderItems: [{
      productId: product.id,
      name: product.name,
      quantity: 1,
      price: product.sellingPrice,
      taxAmount: 0,
      total: product.sellingPrice
    }],
    subtotal: product.sellingPrice,
    taxTotal: 0,
    grandTotal: product.sellingPrice,
    paymentMode: 'CASH',
    orderType: 'Dine-in',
    tableName: table.number,
    tableId: table.id,
    waiterName: user.name,
    status: 'PENDING'
  };

  try {
    console.log('Creating initial order...');
    await api.post('/orders', orderPayload);
    console.log('Initial order created.');

    // Now simulate the concurrent PUT and POST KOT
    const kotItems = [{
      productId: product.id,
      name: product.name,
      quantity: 2,
      price: product.sellingPrice,
      notes: null,
      variant: null,
      modifiers: []
    }];

    const updatePayload = { ...orderPayload };
    updatePayload.orderItems[0].quantity = 2;
    updatePayload.subtotal = product.sellingPrice * 2;
    updatePayload.grandTotal = product.sellingPrice * 2;

    console.log('Starting concurrent PUT and POST...');
    const putPromise = api.put(`/orders/${orderId}`, updatePayload).catch(e => e.response);
    const kotPromise = api.post('/kots', {
      orderId: orderId,
      tableId: table.id,
      tableName: table.number,
      waiterName: user.name,
      orderType: 'Dine-in',
      items: kotItems
    }).catch(e => e.response);

    const [putRes, kotRes] = await Promise.all([putPromise, kotPromise]);

    console.log(`PUT /orders status: ${putRes.status}`, putRes.data?.error || '');
    console.log(`POST /kots status: ${kotRes.status}`, kotRes.data?.error || '');
  } catch (err) {
    console.error('Test error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
