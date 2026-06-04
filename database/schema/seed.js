const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const cashierPassword = await bcrypt.hash('cashier123', 10);

  // 1. Categories
  const cat1 = await prisma.category.upsert({ where: { name: 'Groceries' }, update: {}, create: { name: 'Groceries' } });
  const cat2 = await prisma.category.upsert({ where: { name: 'Electronics' }, update: {}, create: { name: 'Electronics' } });

  // 2. Master License
  const masterLicense = await prisma.license.upsert({
    where: { key: 'MASTER-2026-POS' },
    update: {},
    create: {
      key: 'MASTER-2026-POS',
      maxDevices: 10,
      expiryDate: new Date('2027-12-31'),
      status: 'ACTIVE'
    }
  });

  // 3. Admin User
  await prisma.user.upsert({
    where: { email: 'admin' },
    update: { password },
    create: { name: 'System Admin', email: 'admin', password, role: 'ADMIN' }
  });

  // 4. Managed Users
  await prisma.user.upsert({
    where: { email: 'manager' },
    update: { password: managerPassword, licenseId: masterLicense.id },
    create: { name: 'Branch Manager', email: 'manager', password: managerPassword, role: 'MANAGER', licenseId: masterLicense.id }
  });

  await prisma.user.upsert({
    where: { email: 'cashier' },
    update: { password: cashierPassword, licenseId: masterLicense.id },
    create: { name: 'Cashier-01', email: 'cashier', password: cashierPassword, role: 'CASHIER', licenseId: masterLicense.id }
  });

  console.log('SaaS Master Data Seeded Successfully! 🏁');
  console.log('Admin: admin / admin123');
  console.log('License: MASTER-2026-POS');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
