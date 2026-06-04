const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicates() {
  console.log('--- Order Duplicate Cleanup Utility ---');
  
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { orderItems: true }
    });

    console.log(`Analyzing ${orders.length} total orders...`);

    const lowSeries = orders.filter(o => parseInt(o.invoiceNo) < 900);
    const highSeries = orders.filter(o => parseInt(o.invoiceNo) >= 1000);

    console.log(`Found ${lowSeries.length} regular orders and ${highSeries.length} high-number orders.`);

    const toDeleteIds = [];

    for (const highOrder of highSeries) {
      // Find a matching low-series order
      const match = lowSeries.find(lowOrder => {
        const timeDiff = Math.abs(new Date(lowOrder.createdAt).getTime() - new Date(highOrder.createdAt).getTime());
        const amountDiff = Math.abs(lowOrder.grandTotal - highOrder.grandTotal);
        
        // Exact amount, within 15 minutes
        return amountDiff < 0.1 && timeDiff < 15 * 60 * 1000;
      });

      if (match) {
        console.log(`[DUPLICATE FOUND]`);
        console.log(`   Low:  Invoice ${match.invoiceNo} | ID: ${match.id} | Total: ${match.grandTotal}`);
        console.log(`   High: Invoice ${highOrder.invoiceNo} | ID: ${highOrder.id} | Total: ${highOrder.grandTotal}`);
        toDeleteIds.push(highOrder.id);
      }
    }

    if (toDeleteIds.length === 0) {
      console.log('No clear duplicates found.');
      return;
    }

    console.log(`\nIdentification complete. Found ${toDeleteIds.length} duplicate server records.`);
    
    // Perform deletion
    const deleteResult = await prisma.$transaction([
        prisma.payment.deleteMany({ where: { orderId: { in: toDeleteIds } } }),
        prisma.orderItem.deleteMany({ where: { orderId: { in: toDeleteIds } } }),
        prisma.order.delete({ where: { id: { in: toDeleteIds } } }) // Error: delete takes a unique selector. Use deleteMany.
    ]).catch(err => {
        // Redo with deleteMany
        return prisma.$transaction([
            prisma.payment.deleteMany({ where: { orderId: { in: toDeleteIds } } }),
            prisma.orderItem.deleteMany({ where: { orderId: { in: toDeleteIds } } }),
            prisma.order.deleteMany({ where: { id: { in: toDeleteIds } } })
        ]);
    });

    console.log(`Successfully purged ${toDeleteIds.length} duplicate records from the database.`);
    
  } catch (error) {
    console.error('Cleanup Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicates();
