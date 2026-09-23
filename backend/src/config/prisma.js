const { PrismaClient } = require('@prisma/client');

let prisma;

function getPrismaInstance() {
  const dbUrl = process.env.DATABASE_URL || '';
  let connectionUrl = dbUrl;
  
  // If using the Supabase pooled connection on port 6543, ensure pgbouncer=true is appended
  if (dbUrl.includes(':6543') && !connectionUrl.includes('pgbouncer=true')) {
    connectionUrl = connectionUrl + (connectionUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
  }
  
  return new PrismaClient({
    datasources: {
      db: { url: connectionUrl }
    }
  });
}

if (process.env.NODE_ENV === 'production') {
  if (!global.prisma) {
    global.prisma = getPrismaInstance();
  }
  prisma = global.prisma;
} else {
  if (!global.prisma) {
    global.prisma = getPrismaInstance();
  }
  prisma = global.prisma;
}

module.exports = prisma;
