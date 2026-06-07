const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding/Adding User-requested Menu Items ---');

  // Let's find category IDs
  const mainCourseCategory = await prisma.category.findUnique({
    where: { name: 'Main Course' }
  });
  const startersCategory = await prisma.category.findUnique({
    where: { name: 'Starters' }
  });

  if (!mainCourseCategory || !startersCategory) {
    console.error('Error: Required categories "Main Course" or "Starters" not found.');
    process.exit(1);
  }

  const items = [
    {
      name: 'Beef sp',
      price: 130,
      categoryId: mainCourseCategory.id,
      foodType: 'NON-VEG',
      barcode: 'DEMO-BEEF-SP',
      kitchenDept: 'MAIN_KITCHEN',
      preparationTime: 15
    },
    {
      name: 'Kappa',
      price: 70,
      categoryId: startersCategory.id,
      foodType: 'VEG',
      barcode: 'DEMO-KAPPA',
      kitchenDept: 'MAIN_KITCHEN',
      preparationTime: 10
    },
    {
      name: 'Kappa biriyani',
      price: 130,
      categoryId: mainCourseCategory.id,
      foodType: 'NON-VEG',
      barcode: 'DEMO-KAPPA-BIRIYANI',
      kitchenDept: 'MAIN_KITCHEN',
      preparationTime: 15
    },
    {
      name: 'Payyam pori',
      price: 15,
      categoryId: startersCategory.id,
      foodType: 'VEG',
      barcode: 'DEMO-PAYYAM-PORI',
      kitchenDept: 'MAIN_KITCHEN',
      preparationTime: 5
    }
  ];

  for (const item of items) {
    const product = await prisma.product.upsert({
      where: { barcode: item.barcode },
      update: {
        name: item.name,
        sellingPrice: item.price,
        mrp: item.price,
        purchasePrice: item.price * 0.6, // rough estimate
        categoryId: item.categoryId,
        foodType: item.foodType,
        kitchenDept: item.kitchenDept,
        preparationTime: item.preparationTime,
        stockQuantity: 999, // Virtual stock for billing availability
        availability: true,
        is_active: true
      },
      create: {
        name: item.name,
        barcode: item.barcode,
        sellingPrice: item.price,
        mrp: item.price,
        purchasePrice: item.price * 0.6, // rough estimate
        categoryId: item.categoryId,
        foodType: item.foodType,
        kitchenDept: item.kitchenDept,
        preparationTime: item.preparationTime,
        stockQuantity: 999,
        unit: 'pcs',
        availability: true,
        is_active: true
      }
    });
    console.log(`Added/Updated product: ${product.name} [Barcode: ${product.barcode}] at ₹${product.sellingPrice}`);
  }

  console.log('--- Successfully completed! ---');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
