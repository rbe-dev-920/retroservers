#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupsDir = path.join(__dirname, 'backups');

// Find the latest backup
const indexPath = path.join(backupsDir, 'index.json');
let backupName = null;

if (fs.existsSync(indexPath)) {
  const backups = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  if (backups.length > 0) {
    backupName = backups[backups.length - 1].name;
  }
}

if (!backupName) {
  console.error('❌ No backup found');
  process.exit(1);
}

const backupPath = path.join(backupsDir, backupName, 'data.json');

if (!fs.existsSync(backupPath)) {
  console.error(`❌ Backup not found: ${backupPath}`);
  process.exit(1);
}

const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
const members = backupData.tables?.members?.data || [];

// Find w.belaidi
const belaidi = members.find(m => 
  m.username === 'w.belaidi' || 
  m.email?.toLowerCase().includes('belaidi')
);

if (!belaidi) {
  console.log('Members found:');
  members.forEach((m, i) => {
    if (i < 5) {
      console.log(`  ${i}: ${m.username || m.email} (role: ${m.role})`);
    }
  });
  console.error('❌ w.belaidi not found');
  process.exit(1);
}

console.log('✅ Found w.belaidi:');
console.log(`  ID: ${belaidi.id}`);
console.log(`  Username: ${belaidi.username}`);
console.log(`  Email: ${belaidi.email}`);
console.log(`  Current role: ${belaidi.role}`);
console.log('');

// Update role to TRESORIER
belaidi.role = 'TRESORIER';

// Save back to the backup
backupData.tables.members.data = members;
fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

console.log('✅ Updated w.belaidi role to TRESORIER');
console.log(`✅ Saved to: ${backupPath}`);
