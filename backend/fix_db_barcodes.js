const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const result = await prisma.product.updateMany({
    where: { barcode: '' },
    data: { barcode: null }
  });
  console.log(`Updated ${result.count} products from "" to NULL`);
}

fix().catch(console.error).finally(() => prisma.$disconnect());
