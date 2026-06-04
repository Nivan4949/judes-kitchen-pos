const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Clearing Test Products...');
    await prisma.product.deleteMany({
      where: { name: { startsWith: 'Test Product' } }
    });

    console.log('Creating Product A (barcode: null)...');
    await prisma.product.create({
      data: {
        name: 'Test Product A',
        barcode: null,
        purchasePrice: 10,
        sellingPrice: 15,
        stockQuantity: 10
      }
    });
    console.log('✅ Product A created');

    console.log('Creating Product B (barcode: null)...');
    await prisma.product.create({
      data: {
        name: 'Test Product B',
        barcode: null,
        purchasePrice: 20,
        sellingPrice: 25,
        stockQuantity: 20
      }
    });
    console.log('✅ Product B created (Direct Prisma NULL test PASSED)');

  } catch (error) {
    console.error('❌ Direct Prisma NULL test FAILED:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
