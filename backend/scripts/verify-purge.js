const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCounts() {
  const models = [
    'Order', 'Purchase', 'Expense', 'Product', 'Customer', 'Category', 
    'User', 'License', 'Device', 'OrderItem', 'Payment', 'SalesReturn'
  ];
  
  console.log('--- Final Database Audit ---');
  for (const model of models) {
    try {
      const count = await prisma[model.charAt(0).toLowerCase() + model.slice(1)].count();
      console.log(`${model}: ${count}`);
    } catch (e) {
      console.log(`${model}: Error`);
    }
  }
  await prisma.$disconnect();
}

checkCounts();
