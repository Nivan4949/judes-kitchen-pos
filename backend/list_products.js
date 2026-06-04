const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list() {
  const products = await prisma.product.findMany();
  console.log(`Total Products: ${products.length}`);
  products.forEach(p => {
    console.log(`- ID: ${p.id}, Name: "${p.name}", Barcode: ${p.barcode === null ? 'NULL' : '"' + p.barcode + '"'}`);
  });
}

list().catch(console.error).finally(() => prisma.$disconnect());
