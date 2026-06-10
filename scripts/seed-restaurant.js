const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- 🚀 SEEDING RESTAURANT POS DATA ---');

  // 1. Seed Restaurant Settings
  console.log('1. Seeding Restaurant Settings...');
  const settings = await prisma.restaurantSettings.upsert({
    where: { id: 'settings' },
    update: {
      name: "JUDE'S KITCHEN",
      address: "DHOTTAPPANKULAM,SULTHAN BATHERY,WAYANAD",
      phone: "+91 89431 21110",
      gstin: "",
      currency: "INR",
      gstRate: 5.0,
      parcelCharge: 10.0,
      deliveryCharge: 30.0,
      printerSize: "80mm"
    },
    create: {
      id: 'settings',
      name: "JUDE'S KITCHEN",
      address: "DHOTTAPPANKULAM,SULTHAN BATHERY,WAYANAD",
      phone: "+91 89431 21110",
      gstin: "",
      currency: "INR",
      gstRate: 5.0,
      parcelCharge: 10.0,
      deliveryCharge: 30.0,
      printerSize: "80mm"
    }
  });
  console.log('Settings seeded:', settings.name);

  // 2. Seed Table Sections and Tables
  console.log('\n2. Seeding Table Sections & Tables...');
  const sectionsData = [
    {
      name: 'Main Hall (Non-AC)',
      tables: [
        { number: 'T01', capacity: 4 },
        { number: 'T02', capacity: 4 },
        { number: 'T03', capacity: 2 },
        { number: 'T04', capacity: 6 }
      ]
    },
    {
      name: 'AC Cabin',
      tables: [
        { number: 'A01', capacity: 4 },
        { number: 'A02', capacity: 4 },
        { number: 'A03', capacity: 8 }
      ]
    },
    {
      name: 'Rooftop Garden',
      tables: [
        { number: 'R01', capacity: 4 },
        { number: 'R02', capacity: 4 },
        { number: 'R03', capacity: 2 }
      ]
    }
  ];

  for (const sData of sectionsData) {
    const section = await prisma.tableSection.upsert({
      where: { name: sData.name },
      update: {},
      create: { name: sData.name }
    });
    
    console.log(`Seeded section: ${section.name}`);

    for (const tData of sData.tables) {
      await prisma.table.upsert({
        where: { number: tData.number },
        update: {
          capacity: tData.capacity,
          sectionId: section.id
        },
        create: {
          number: tData.number,
          capacity: tData.capacity,
          sectionId: section.id,
          status: 'FREE'
        }
      });
      console.log(`  Seeded Table: ${tData.number} (Cap: ${tData.capacity})`);
    }
  }

  // 3. Seed Raw Materials
  console.log('\n3. Seeding Raw Materials...');
  const rawMaterials = [
    { name: 'Boneless Chicken', unit: 'kg', stockQuantity: 25.5, lowStockThreshold: 5.0 },
    { name: 'Mozzarella Cheese', unit: 'kg', stockQuantity: 15.0, lowStockThreshold: 3.0 },
    { name: 'Wheat Flour', unit: 'kg', stockQuantity: 50.0, lowStockThreshold: 10.0 },
    { name: 'Refined Oil', unit: 'litre', stockQuantity: 20.0, lowStockThreshold: 4.0 },
    { name: 'Fresh Paneer', unit: 'kg', stockQuantity: 10.0, lowStockThreshold: 2.0 }
  ];

  const materialMap = {};
  for (const rm of rawMaterials) {
    const material = await prisma.rawMaterial.upsert({
      where: { name: rm.name },
      update: {
        stockQuantity: rm.stockQuantity,
        lowStockThreshold: rm.lowStockThreshold
      },
      create: rm
    });
    materialMap[material.name] = material.id;
    console.log(`Seeded Raw Material: ${material.name} (${material.stockQuantity} ${material.unit})`);
  }

  // 4. Seed Categories & Products with variants, modifiers and recipe links
  console.log('\n4. Seeding Menu Categories & Restaurant Items...');
  
  const categories = ['Main Course', 'Pizza & Italian', 'Starters', 'Beverages'];
  const catMap = {};
  for (const catName of categories) {
    const category = await prisma.category.upsert({
      where: { name: catName },
      update: {},
      create: { name: catName }
    });
    catMap[catName] = category.id;
  }

  // Define products with recipe links using materialMap ids
  const chickenRecipe = [
    { rawMaterialId: materialMap['Boneless Chicken'], quantity: 0.25 }, // 250g Chicken per serving
    { rawMaterialId: materialMap['Refined Oil'], quantity: 0.05 }     // 50ml Oil
  ];

  const pizzaRecipe = [
    { rawMaterialId: materialMap['Mozzarella Cheese'], quantity: 0.15 }, // 150g cheese
    { rawMaterialId: materialMap['Wheat Flour'], quantity: 0.20 }        // 200g flour
  ];

  const paneerRecipe = [
    { rawMaterialId: materialMap['Fresh Paneer'], quantity: 0.20 },     // 200g Paneer
    { rawMaterialId: materialMap['Refined Oil'], quantity: 0.02 }        // 20ml Oil
  ];

  const productsData = [
    {
      name: 'Butter Chicken',
      purchasePrice: 120.0,
      sellingPrice: 280.0,
      mrp: 300.0,
      categoryId: catMap['Main Course'],
      foodType: 'NON-VEG',
      kitchenDept: 'MAIN_KITCHEN',
      preparationTime: 20,
      variants: [
        { name: 'Half Portion', price: 180.0 },
        { name: 'Full Portion', price: 320.0 }
      ],
      addons: [],
      recipe: chickenRecipe
    },
    {
      name: 'Margherita Pizza',
      purchasePrice: 80.0,
      sellingPrice: 220.0,
      mrp: 250.0,
      categoryId: catMap['Pizza & Italian'],
      foodType: 'VEG',
      kitchenDept: 'PIZZA_OVEN',
      preparationTime: 15,
      variants: [
        { name: 'Regular 7"', price: 199.0 },
        { name: 'Medium 10"', price: 349.0 }
      ],
      addons: [
        { name: 'Extra Cheese', price: 40.0 },
        { name: 'Add Black Olives', price: 25.0 }
      ],
      recipe: pizzaRecipe
    },
    {
      name: 'Paneer Tikka',
      purchasePrice: 90.0,
      sellingPrice: 210.0,
      mrp: 230.0,
      categoryId: catMap['Starters'],
      foodType: 'VEG',
      kitchenDept: 'TANDOOR',
      preparationTime: 12,
      variants: [],
      addons: [
        { name: 'Extra Mint Chutney', price: 10.0 }
      ],
      recipe: paneerRecipe
    },
    {
      name: 'Masala Chai',
      purchasePrice: 5.0,
      sellingPrice: 25.0,
      mrp: 25.0,
      categoryId: catMap['Beverages'],
      foodType: 'VEG',
      kitchenDept: 'BEVERAGE_BAR',
      preparationTime: 5,
      variants: [],
      addons: []
    }
  ];

  for (const pData of productsData) {
    const product = await prisma.product.upsert({
      where: { barcode: `DEMO-${pData.name.replace(/\s+/g, '-').toUpperCase()}` },
      update: {
        categoryId: pData.categoryId,
        purchasePrice: pData.purchasePrice,
        sellingPrice: pData.sellingPrice,
        mrp: pData.mrp,
        foodType: pData.foodType,
        kitchenDept: pData.kitchenDept,
        preparationTime: pData.preparationTime,
        variants: pData.variants,
        addons: pData.addons,
        recipe: pData.recipe || null,
        stockQuantity: 999 // Virtual stock for demo menu items
      },
      create: {
        name: pData.name,
        barcode: `DEMO-${pData.name.replace(/\s+/g, '-').toUpperCase()}`,
        categoryId: pData.categoryId,
        purchasePrice: pData.purchasePrice,
        sellingPrice: pData.sellingPrice,
        mrp: pData.mrp,
        foodType: pData.foodType,
        kitchenDept: pData.kitchenDept,
        preparationTime: pData.preparationTime,
        variants: pData.variants,
        addons: pData.addons,
        recipe: pData.recipe || null,
        stockQuantity: 999,
        unit: 'pcs'
      }
    });
    console.log(`Seeded Menu Product: ${product.name} (Type: ${product.foodType})`);
  }

  console.log('\n--- ✅ RESTAURANT SEEDING COMPLETED SUCCESSFULLY! ---');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('\n--- ❌ SEEDING FAILED ---');
  console.error(err);
  process.exit(1);
});
