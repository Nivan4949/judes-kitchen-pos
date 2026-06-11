const axios = require('axios');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

async function testProd() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst();
  
  if (!user) {
    console.error("No user found");
    return;
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    'freshnaad_pos_enterprise_secret_2026',
    { expiresIn: '1d' }
  );

  const prodApi = axios.create({
    baseURL: 'https://judes-kitchen-pos-frontend.vercel.app/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  const product = await prisma.product.findFirst();
  const table = await prisma.table.findFirst();

  try {
    console.log("Hitting production /kots API...");
    const res = await prodApi.post('/kots', {
      orderId: 'test-order-prod-500',
      tableId: table.id,
      tableName: table.number,
      waiterName: user.name,
      orderType: 'Dine-in',
      items: [{
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.sellingPrice,
        notes: null,
        variant: null,
        modifiers: []
      }]
    });
    console.log("Success!", res.data);
  } catch (err) {
    console.error("Production Error:", err.response?.status, err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testProd();
