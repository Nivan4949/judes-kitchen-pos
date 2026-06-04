const prisma = require('../src/config/prisma');

async function main() {
  try {
    const categories = await prisma.category.findMany();
    console.log('Categories from internal config:', categories);
    console.log('Prisma config is working!');
  } catch (error) {
    console.error('Prisma internal config failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
