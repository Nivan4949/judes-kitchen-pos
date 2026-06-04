const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

console.log('--- 🚀 POS-BILLING DATABASE BOOTSTRAPPER ---');

// Primary Schema path
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

async function bootstrap() {
    try {
        console.log('1. Checking Schema Path...');
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Prisma schema not found at: ${schemaPath}`);
        }

        console.log('2. Pushing Schema to Supabase...');
        execSync(`npx prisma db push --schema="${schemaPath}" --accept-data-loss`, { stdio: 'inherit' });

        console.log('3. Generating Prisma Client...');
        execSync(`npx prisma generate --schema="${schemaPath}"`, { stdio: 'inherit' });

        console.log('4. Creating Default Administrator...');
        const prisma = new PrismaClient();
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await prisma.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                name: 'System Admin',
                username: 'admin',
                email: 'admin@pos.com',
                password: hashedPassword,
                role: 'ADMIN'
            }
        });

        console.log('\n--- ✅ DATABASE INITIALIZED & ADMIN CREATED! ---');
        console.log('User: admin');
        console.log('Pass: admin123');
        await prisma.$disconnect();

    } catch (error) {
        console.error('\n--- ❌ BOOTSTRAP FAILED ---');
        console.error(error.message);
    }
}

bootstrap();
