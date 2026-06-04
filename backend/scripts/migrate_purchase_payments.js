const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('--- Aggressive Purchase Payment Migration ---');
  try {
    // Fetch all purchases that have some payment recorded
    const purchases = await prisma.purchase.findMany({
      where: {
        amountPaid: { gt: 0 }
      },
      include: {
        payments: true
      }
    });

    console.log(`Found ${purchases.length} purchases with non-zero amountPaid.`);
    let migratedCount = 0;

    for (const p of purchases) {
      // Calculate how much is already recorded in PurchasePayment records
      const existingPaymentTotal = p.payments.reduce((sum, pay) => sum + pay.amount, 0);
      const gap = p.amountPaid - existingPaymentTotal;

      if (gap > 0.01) { // Floating point safety
        console.log(`Migrating missing gap of ₹${gap.toFixed(2)} for Inv: ${p.invoiceNo}`);
        await prisma.purchasePayment.create({
          data: {
            purchaseId: p.id,
            amount: gap,
            method: p.paymentMode || 'CASH',
            // Use the purchase date for historical accuracy in reports
            date: p.date || p.createdAt,
            createdAt: p.createdAt
          }
        });
        migratedCount++;
      }
    }

    console.log(`--- Migration Finished. ${migratedCount} new payment records created. ---`);
  } catch (error) {
    console.error('Migration crashed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
