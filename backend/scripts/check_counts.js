require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const orders = await prisma.order.count();
    const products = await prisma.product.count();
    const purchases = await prisma.purchase.count();
    console.log('--- DATABASE CHECK ---');
    console.log('Total Orders:', orders);
    console.log('Total Purchases:', purchases);
    console.log('Total Products:', products);
  } catch (err) {
    console.error('Check failed:', err.message);
  } finally {
    const { exec } = require('child_process');
    // Force disconnect safely
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
