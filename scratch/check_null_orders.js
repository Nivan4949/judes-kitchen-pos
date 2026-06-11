const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const kots = await prisma.kOT.findMany({
    where: {
      OR: [
        { orderId: '' },
        { orderId: 'null' },
        { orderId: 'undefined' },
        { orderId: null }
      ]
    },
    select: {
      id: true,
      kotNo: true,
      orderId: true,
      createdAt: true
    }
  });

  console.log('--- INVALID ORDERID KOTS ---');
  console.log('Total found:', kots.length);
  kots.slice(0, 10).forEach(k => {
    console.log(`ID: ${k.id}, No: ${k.kotNo}, OrderId: ${k.orderId}, Created: ${k.createdAt}`);
  });
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
