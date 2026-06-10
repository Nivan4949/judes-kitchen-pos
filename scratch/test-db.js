const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }
  }
});

async function main() {
  console.log("Checking DB connection and active shifts...");
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, role: true, username: true }
    });
    console.log("Users in DB:", users);

    const activeShifts = await prisma.shift.findMany({
      where: { status: 'OPEN' }
    });
    console.log("Active OPEN Shifts:", activeShifts);

    const totalOrders = await prisma.order.count();
    console.log("Total Orders Count:", totalOrders);

  } catch (err) {
    console.error("DB Query failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
