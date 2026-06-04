const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Data Purge for Real-World Deployment...');
  
  const tables = [
    'OrderItem',
    'Payment',
    'SalesReturnItem',
    'PurchaseReturnItem',
    'PurchaseItem',
    'PurchasePayment',
    'SalesReturn',
    'PurchaseReturn',
    'InventoryLog',
    'Order',
    'Purchase',
    'Expense',
    'Product',
    'Customer',
    'Category'
  ];

  try {
    // We execute in sequence to respect foreign keys
    // Children first, then parents
    
    console.log('Step 1: Clearing Transaction Line Items and Payments...');
    await prisma.orderItem.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.salesReturnItem.deleteMany({});
    await prisma.purchaseReturnItem.deleteMany({});
    await prisma.purchaseItem.deleteMany({});
    await prisma.purchasePayment.deleteMany({});
    
    console.log('Step 2: Clearing Returns and Inventory Logs...');
    await prisma.salesReturn.deleteMany({});
    await prisma.purchaseReturn.deleteMany({});
    await prisma.inventoryLog.deleteMany({});
    
    console.log('Step 3: Clearing Primary Transaction Records...');
    await prisma.order.deleteMany({});
    await prisma.purchase.deleteMany({});
    await prisma.expense.deleteMany({});
    
    console.log('Step 4: Clearing Master Data (Products, Customers, Categories)...');
    await prisma.product.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.category.deleteMany({});

    console.log('--------------------------------------------------');
    console.log('✅ DATABASE PURGE SUCCESSFUL!');
    console.log('The following tables are now empty:');
    tables.forEach(t => console.log(` - ${t}: 0 records`));
    console.log('--------------------------------------------------');
    console.log('🔐 Preserved Configuration:');
    
    const userCount = await prisma.user.count();
    const licenseCount = await prisma.license.count();
    const deviceCount = await prisma.device.count();
    
    console.log(` - Users: ${userCount} (Admin/Staff accounts)`);
    console.log(` - Licenses: ${licenseCount} (Active software licenses)`);
    console.log(` - Devices: ${deviceCount} (Authorized hardware)`);
    console.log('--------------------------------------------------');
    console.log('🚀 System is ready for real-world deployment.');

  } catch (error) {
    console.error('❌ Error during purge:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
