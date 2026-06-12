const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      role: true
    }
  });

  console.log('--- ALL USERS ---');
  console.log(users);
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
