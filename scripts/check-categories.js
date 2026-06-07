const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      category: {
        name: {
          in: ['Main Course', 'Starters', 'Beverages', 'SNACK', 'Pizza & Italian']
        }
      }
    },
    select: {
      name: true,
      barcode: true,
      sellingPrice: true,
      category: { select: { name: true } }
    }
  });

  console.log('--- Products in Main Categories ---');
  products.forEach(p => {
    console.log(`- ${p.name} (${p.category?.name}): ₹${p.sellingPrice} [Barcode: ${p.barcode}]`);
  });

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
