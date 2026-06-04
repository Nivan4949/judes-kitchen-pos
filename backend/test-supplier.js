const prisma = require('./src/config/prisma');

async function test() {
  try {
    const s = await prisma.supplier.create({
      data: {
        name: 'Test Supplier ' + Date.now(),
        phone: null, // Test if null works for unique constraint
        openingBalance: 0
      }
    });
    console.log('Successfully created supplier:', s);
  } catch (error) {
    console.error('Error creating supplier:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
