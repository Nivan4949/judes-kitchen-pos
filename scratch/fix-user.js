const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }
  }
});

async function main() {
  console.log("Checking user 'BASIL' in database...");
  try {
    const user = await prisma.user.findUnique({
      where: { username: 'BASIL' }
    });

    if (!user) {
      console.log("User 'BASIL' not found in database.");
      return;
    }

    console.log("Found user:", user.username);
    const pass = user.password;
    
    // A bcrypt hash typically starts with $2a$ or $2b$ or $2y$ and is 60 characters long.
    const isHashed = pass.startsWith('$2a$') || pass.startsWith('$2b$') || pass.startsWith('$2y$');
    if (!isHashed) {
      console.log("Password is not hashed. Hashing now...");
      const hashedPassword = await bcrypt.hash(pass, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      console.log("Successfully hashed and updated password for 'BASIL'!");
    } else {
      console.log("Password is already hashed in bcrypt format. Resetting to hash of 'BASIL123' just in case...");
      const hashedPassword = await bcrypt.hash('BASIL123', 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      console.log("Successfully reset password for 'BASIL' to bcrypt hash of 'BASIL123'.");
    }
  } catch (err) {
    console.error("Database operation failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
