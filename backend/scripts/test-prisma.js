const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const categories = await prisma.category.findMany();
    console.log('Categories:', categories);
    console.log('Prisma is working!');
  } catch (error) {
    console.error('Prisma failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
