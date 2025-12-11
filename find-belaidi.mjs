#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupsDir = path.join(__dirname, 'backups');

const indexPath = path.join(backupsDir, 'index.json');

let backupName = null;
if (fs.existsSync(indexPath)) {
  const backups = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  if (backups.length > 0) {
    backupName = backups[backups.length - 1].name;
  }
}

if (!backupName) {
  console.log('No backup found');
  process.exit(1);
}

const backupPath = path.join(backupsDir, backupName, 'data.json');
const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
const members = backupData.tables?.members?.data || [];

console.log('Total members:', members.length);
console.log('\nFirst 10 members:');
members.slice(0, 10).forEach((m, i) => {
  console.log(`  ${i}: ${m.username || m.email || m.login} (role: ${m.role})`);
});

// Search for belaidi
const belaidiMatches = members.filter(m => 
  (m.username && m.username.toLowerCase().includes('belaidi')) ||
  (m.email && m.email.toLowerCase().includes('belaidi')) ||
  (m.firstName && m.firstName.toLowerCase().includes('belaidi')) ||
  (m.lastName && m.lastName.toLowerCase().includes('belaidi'))
);

console.log('\n\nMatches for belaidi:');
if (belaidiMatches.length === 0) {
  console.log('  None found');
} else {
  belaidiMatches.forEach(m => {
    console.log(`  Username: ${m.username}, Email: ${m.email}, Role: ${m.role}`);
  });
}
