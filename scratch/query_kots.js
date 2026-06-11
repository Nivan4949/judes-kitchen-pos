const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const kots = await prisma.kOT.findMany({
    where: {
      kotNo: { startsWith: 'KOT-' }
    },
    select: {
      id: true,
      kotNo: true,
      createdAt: true
    },
    orderBy: { kotNo: 'asc' }
  });
  console.log('--- ALL KOTS ---');
  kots.forEach(k => {
    console.log(`ID: ${k.id}, No: ${k.kotNo}, Created: ${k.createdAt.toISOString()}`);
  });
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
