const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- ENTERPRISE CLOUD SYNC DB PREP ---');
    console.log('1. Ensure DATABASE_URL is set in .env');
    console.log('2. Running migrations...');
    
    // Add logic to check for admin user
    const admin = await prisma.user.findUnique({
        where: { email: 'admin@example.com' }
    });

    if (!admin) {
        await prisma.user.create({
            data: {
                name: 'System Admin',
                email: 'admin@example.com',
                password: 'admin123',
                role: 'ADMIN'
            }
        });
        console.log('✅ Default Admin Created');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
