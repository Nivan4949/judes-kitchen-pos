const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BACKUP_DIR = path.join(__dirname, '../backups');
const LOG_FILE = path.join(BACKUP_DIR, 'backup.log');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function getPgDumpPath() {
  if (process.platform === 'win32') {
    // Check standard Postgres installation paths on Windows
    const standardPaths = [
      'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
      'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
      'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
      'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe'
    ];
    for (const p of standardPaths) {
      if (fs.existsSync(p)) return `"${p}"`;
    }
  }
  return 'pg_dump'; // fallback to PATH
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(LOG_FILE, logMessage);
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

function getDatabaseUrl() {
  // Use DIRECT_URL for pg_dump if available, else DATABASE_URL
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('No DATABASE_URL or DIRECT_URL found in .env');
  }
  return url;
}

async function uploadToGoogleDrive(filePath, fileName) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.DRIVE_FOLDER_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground';

  if (!refreshToken || refreshToken === 'your_refresh_token_here') {
    log('GOOGLE_REFRESH_TOKEN not set or is still placeholder, skipping cloud upload.');
    return;
  }
  if (!folderId) {
    log('DRIVE_FOLDER_ID not defined in .env, skipping cloud upload.');
    return;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Check if a backup with the same name already exists to prevent duplicates
    const res = await drive.files.list({
      q: `'${folderId}' in parents and name='${fileName}' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (res.data.files.length > 0) {
      log(`File ${fileName} already exists in Google Drive. Overwriting...`);
      const fileId = res.data.files[0].id;
      await drive.files.update({
        fileId: fileId,
        media: {
          mimeType: 'application/sql',
          body: fs.createReadStream(filePath)
        }
      });
      log(`Successfully updated existing backup ${fileName} in Google Drive.`);
      return;
    }

    // Create new file
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };
    const media = {
      mimeType: 'application/sql',
      body: fs.createReadStream(filePath)
    };

    await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });
    
    log(`Successfully uploaded ${fileName} to Google Drive.`);
  } catch (error) {
    log(`Error uploading to Google Drive: ${error.message}`);
    throw error;
  }
}

function manageRetention() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.sql'));

  const backupData = files.map(file => {
    // backup-YYYY-MM-DD.sql
    const dateStr = file.replace('backup-', '').replace('.sql', '');
    const date = new Date(dateStr);
    return { file, date };
  }).filter(b => !isNaN(b.date.getTime()));

  // Sort descending (newest first)
  backupData.sort((a, b) => b.date - a.date);

  const keepFiles = new Set();

  // 1. Keep last 7 daily backups
  const dailies = backupData.slice(0, 7);
  dailies.forEach(b => keepFiles.add(b.file));

  // 2. Keep last 4 weekly backups (Sundays)
  const weeklies = backupData.filter(b => b.date.getDay() === 0).slice(0, 4);
  weeklies.forEach(b => keepFiles.add(b.file));

  // 3. Keep last 3 monthly backups (1st of the month)
  const monthlies = backupData.filter(b => b.date.getDate() === 1).slice(0, 3);
  monthlies.forEach(b => keepFiles.add(b.file));

  // 4. Delete the rest
  let deletedCount = 0;
  backupData.forEach(b => {
    if (!keepFiles.has(b.file)) {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, b.file));
        log(`Retention Policy: Deleted old backup ${b.file}`);
        deletedCount++;
      } catch (err) {
        log(`Failed to delete ${b.file}: ${err.message}`);
      }
    }
  });

  if (deletedCount === 0) {
    log('Retention Policy: No old backups needed to be deleted.');
  }
}

async function performBackup() {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `backup-${dateStr}.sql`;
  const filePath = path.join(BACKUP_DIR, fileName);
  
  log(`Starting database backup for ${dateStr}...`);

  try {
    const dbUrl = getDatabaseUrl();
    const pgDumpCmd = getPgDumpPath();
    
    // -F p format is plain text SQL, -O ignores ownership
    const command = `${pgDumpCmd} --dbname="${dbUrl}" -F p -O -f "${filePath}"`;
    
    await runCommand(command);
    log(`Successfully created local backup at ${filePath}`);
    
    // Apply Retention Policy (Local files)
    manageRetention();

    // Cloud Upload
    await uploadToGoogleDrive(filePath, fileName);

    log(`Backup process completed successfully.`);
  } catch (error) {
    log(`Backup process failed: ${error.message}`);
    if (error.stderr) {
      log(`Process Stderr: ${error.stderr}`);
    }
    process.exit(1);
  }
}

// Execute
performBackup();
