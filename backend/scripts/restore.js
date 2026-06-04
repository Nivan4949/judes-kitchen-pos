const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BACKUP_DIR = path.join(__dirname, '../backups');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getPsqlPath() {
  if (process.platform === 'win32') {
    const standardPaths = [
      'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
      'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
      'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
      'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe'
    ];
    for (const p of standardPaths) {
      if (fs.existsSync(p)) return `"${p}"`;
    }
  }
  return 'psql';
}

function getDatabaseUrl() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('No DATABASE_URL or DIRECT_URL found in .env');
  }
  return url;
}

async function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function listAvailableBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('No local backups directory found.');
    return [];
  }
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
    .sort((a, b) => b.localeCompare(a));
  
  if (files.length === 0) {
    console.log('No backups found in local backups directory.');
  } else {
    console.log('\nAvailable Backups:');
    files.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  }
  return files;
}

async function startRestore() {
  console.log('====================================');
  console.log('   DATABASE RESTORE UTILITY         ');
  console.log('====================================');
  console.log('WARNING: Restoring a database will overwrite current data.');
  console.log('Ensure you have a recent backup before proceeding.\n');

  const files = listAvailableBackups();
  if (files.length === 0) {
    rl.close();
    return;
  }

  rl.question('\nEnter the number of the backup to restore (or type "cancel"): ', async (answer) => {
    if (answer.toLowerCase() === 'cancel') {
      console.log('Restore cancelled.');
      rl.close();
      return;
    }

    const index = parseInt(answer) - 1;
    if (isNaN(index) || index < 0 || index >= files.length) {
      console.log('Invalid selection. Restoring cancelled.');
      rl.close();
      return;
    }

    const selectedFile = files[index];
    const filePath = path.join(BACKUP_DIR, selectedFile);

    rl.question(`\n⚠️  Are you absolutely sure you want to restore '${selectedFile}'? This CANNOT be undone. (yes/no): `, async (confirm) => {
      if (confirm.toLowerCase() !== 'yes') {
        console.log('Restore cancelled.');
        rl.close();
        return;
      }

      console.log(`\nStarting restore from ${selectedFile}...`);
      
      try {
        const dbUrl = getDatabaseUrl();
        const psqlCmd = getPsqlPath();
        // Since we dumped plain SQL, we restore using psql
        const command = `${psqlCmd} --dbname="${dbUrl}" -f "${filePath}"`;
        
        await runCommand(command);
        console.log(`\n✅ Database restored successfully from ${selectedFile}`);
      } catch (error) {
        console.error(`\n❌ Failed to restore database:`);
        console.error(error.message);
        if (error.stderr) console.error(error.stderr);
      } finally {
        rl.close();
      }
    });
  });
}

startRestore();
