const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orderCount = await prisma.order.count();
  const kotCount = await prisma.kOT.count();
  console.log('--- DB STATS ---');
  console.log('Total Orders:', orderCount);
  console.log('Total KOTs:', kotCount);

  console.log('\n--- RECENT KOTs ---');
  const recentKots = await prisma.kOT.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { items: true }
  });
  console.log(JSON.stringify(recentKots, null, 2));

  console.log('\n--- RECENT ORDERs ---');
  const recentOrders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(recentOrders, null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
