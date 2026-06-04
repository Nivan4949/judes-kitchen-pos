require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('--- FULL FACTORY RESET STARTED ---');
  
  try {
    // 1. Transactional Items (Children)
    const level1 = [
      'orderItem', 'payment', 'salesReturnItem', 'purchaseReturnItem', 
      'purchaseOrderItem', 'purchasePayment', 'purchaseItem', 'inventoryLog'
    ];

    // 2. Main Transactions
    const level2 = [
      'salesReturn', 'order', 'purchaseReturn', 'purchaseOrder', 'purchase'
    ];

    // 3. Masters (Parents)
    const level3 = [
      'product', 'customer', 'supplier', 'expense'
    ];

    // 4. Structure
    const level4 = [
      'category'
    ];

    const allLevels = [level1, level2, level3, level4];

    for (const level of allLevels) {
      for (const model of level) {
        if (prisma[model]) {
          console.log(`Clearing ${model}...`);
          const result = await prisma[model].deleteMany();
          console.log(`-> Deleted ${result.count} records from ${model}.`);
        }
      }
    }

    console.log('--- SUCCESS: FACTORY RESET COMPLETE ---');
  } catch (error) {
    console.error('ERROR during reset:', error.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
