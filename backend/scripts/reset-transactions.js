const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Transactional Data Purge...');

  try {
    console.log('Step 1: Clearing Transaction Line Items and Payments...');
    // Delete child records first
    await prisma.orderItem.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.salesReturnItem.deleteMany({});
    await prisma.purchaseReturnItem.deleteMany({});
    if (prisma.purchaseOrderItem) await prisma.purchaseOrderItem.deleteMany({});
    await prisma.purchaseItem.deleteMany({});
    await prisma.purchasePayment.deleteMany({});
    
    console.log('Step 2: Clearing Returns and Inventory Logs...');
    await prisma.salesReturn.deleteMany({});
    await prisma.purchaseReturn.deleteMany({});
    await prisma.inventoryLog.deleteMany({});
    
    console.log('Step 3: Clearing Primary Transaction Records...');
    await prisma.order.deleteMany({});
    if (prisma.purchaseOrder) await prisma.purchaseOrder.deleteMany({});
    await prisma.purchase.deleteMany({});
    await prisma.expense.deleteMany({});
    if (prisma.userActivity) await prisma.userActivity.deleteMany({});

    console.log('Step 4: Resetting Customer Balances...');
    await prisma.customer.updateMany({
      data: {
        loyaltyPoints: 0,
        totalSpent: 0,
        creditBalance: 0
      }
    });

    console.log('--------------------------------------------------');
    console.log('✅ DATABASE PURGE SUCCESSFUL!');
    console.log('All historical transactions (Sales, Purchases, Returns, Expenses) have been cleared.');
    console.log('Products, Categories, Customers, and Suppliers were PRESERVED.');
    console.log('--------------------------------------------------');

  } catch (error) {
    console.error('❌ Error during purge:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
