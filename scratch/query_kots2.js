const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const kots = await prisma.kOT.findMany({
    where: { kotNo: 'KOT-010' }
  });
  console.log('KOT-010 query results:', kots);
  
  const allKots = await prisma.kOT.findMany({
    select: { id: true, kotNo: true, createdAt: true }
  });
  console.log('Total KOTs in DB:', allKots.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
