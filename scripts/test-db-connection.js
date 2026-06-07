const { PrismaClient } = require('@prisma/client');

const passwords = ["Freshnaad@009", "Freshnaad%40009", "POSFreshnaad123", "Freshnaad123", "Admin123", "admin123"];
const projectId = "ewawysxzsxlpfqbzpqpt";

async function main() {
  for (const rawPassword of passwords) {
    const password = rawPassword.includes('%') ? rawPassword : encodeURIComponent(rawPassword);
    const url = `postgresql://postgres.${projectId}:${password}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&statement_cache_size=0`;
    console.log(`Testing password: ${rawPassword}...`);
    
    const prisma = new PrismaClient({
      datasources: { db: { url } }
    });

    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`✅ SUCCESS! "${rawPassword}" is the correct password.`);
      console.log(`Url: ${url}`);
      
      // Let's print out the categories in this database!
      const categories = await prisma.category.findMany();
      console.log('Categories in Vercel DB:', categories.map(c => c.name));
      
      await prisma.$disconnect();
      return url;
    } catch (err) {
      console.log(`❌ Failed: ${err.message.substring(0, 100)}`);
      await prisma.$disconnect();
    }
  }
  console.log('🛑 None of the passwords worked for the Vercel database.');
  return null;
}

main();
