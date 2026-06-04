const { PrismaClient } = require('@prisma/client');

const passwords = ["POSFreshnaad123", "admin123", "Freshnaad123", "Admin123"];
const projectId = "genbvbumxbmslhakulkz";

const runTests = async () => {
  for (const password of passwords) {
    const url = `postgresql://postgres.${projectId}:${password}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&statement_cache_size=0`;
    console.log(`\nTesting Password: [${password}] on Pooled Host (6543)...`);
    
    const prisma = new PrismaClient({
      datasources: { db: { url } }
    });

    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`✅ SUCCESS! [${password}] is the VALID database password.`);
      await prisma.$disconnect();
      return; // Stop after first success
    } catch (err) {
      console.log(`❌ FAILED: ${password}`);
      await prisma.$disconnect();
    }
  }
  console.log("\n🛑 CRITICAL: None of the suspected passwords worked locally.");
};

runTests();
