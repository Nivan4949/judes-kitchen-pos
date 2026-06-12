const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoices = ['101', '102', '103', '104', '105'];
  const existingOrders = await prisma.order.findMany({
    where: {
      invoiceNo: { in: invoices }
    },
    select: {
      id: true,
      invoiceNo: true,
      grandTotal: true,
      createdAt: true
    }
  });

  console.log('--- Orders with matching invoices in DB ---');
  console.log(existingOrders);

  const latestOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      invoiceNo: true,
      grandTotal: true,
      createdAt: true
    }
  });

  console.log('--- Latest 5 orders in DB ---');
  console.log(latestOrders);
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
