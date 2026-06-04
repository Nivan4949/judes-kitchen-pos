const prisma = require('./src/config/prisma');

async function test() {
  try {
    console.log('Testing empty string for unique phone...');
    const s1 = await prisma.supplier.create({
      data: {
        name: 'Empty Phone Supplier 1',
        phone: '', 
        openingBalance: 0
      }
    });
    console.log('Created S1 successfully');

    const s2 = await prisma.supplier.create({
      data: {
        name: 'Empty Phone Supplier 2',
        phone: '', 
        openingBalance: 0
      }
    });
    console.log('Created S2 successfully');
  } catch (error) {
    console.error('Expected Error (Unique Constraint):', error.code, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
