const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const kots = await prisma.kOT.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      kotNo: true,
      orderId: true,
      createdAt: true,
      status: true,
      items: {
        select: {
          name: true,
          quantity: true
        }
      }
    }
  });

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      invoiceNo: true,
      createdAt: true,
      status: true
    }
  });

  console.log('--- LATEST KOTs ---');
  kots.forEach(k => {
    console.log(`ID: ${k.id}, No: ${k.kotNo}, OrderId: ${k.orderId}, Created: ${k.createdAt.toISOString()}, Status: ${k.status}`);
    console.log('Items:', k.items.map(i => `${i.name} (${i.quantity})`).join(', '));
  });

  console.log('\n--- LATEST ORDERs ---');
  orders.forEach(o => {
    console.log(`ID: ${o.id}, Invoice: ${o.invoiceNo}, Created: ${o.createdAt.toISOString()}, Status: ${o.status}`);
  });
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
