const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  if (!global.prisma) {
    const { PrismaClient } = require('@prisma/client');
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
} else {
  if (!global.prisma) {
    const { PrismaClient } = require('@prisma/client');
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;
