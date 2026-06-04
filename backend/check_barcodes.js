const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const products = await prisma.product.findMany({
    where: { barcode: '' }
  });
  console.log('Products with empty barcode string:', products.length);
  products.forEach(p => console.log(`- ${p.name} (id: ${p.id})`));
}

check().catch(console.error).finally(() => prisma.$disconnect());
