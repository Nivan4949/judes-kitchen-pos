const prisma = require('./src/config/prisma');

async function testFetch() {
  try {
    console.log('Testing supplier fetch...');
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' }
    });
    console.log('Successfully fetched suppliers:', suppliers.length);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFetch();
