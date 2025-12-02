#!/usr/bin/env node
/**
 * 🧹 CLEANUP SCRIPT: Remove all stale backup/state files
 * 
 * This script removes files that cause data to reload from old backups:
 * - backups/data.json files (old snapshots)
 * - backups/index.json (backup catalog)
 * - backups/restore-info.json (force-load directive)
 * - backups/runtime-state.json (in-memory state snapshots)
 * 
 * AFTER running this, the server will:
 * ✅ Start fresh with Prisma PostgreSQL only
 * ✅ NOT reload any stale data
 * ✅ Persist all changes directly to DB
 * 
 * Run this ONCE before deploying to production:
 *   node cleanup-stale-backups.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupsDir = path.join(__dirname, 'backups');

console.log('\n🧹 CLEANUP: Removing stale backup files...\n');

// 1. Remove restore-info.json (prevents auto-loading)
const restoreInfoPath = path.join(backupsDir, 'restore-info.json');
if (fs.existsSync(restoreInfoPath)) {
  fs.unlinkSync(restoreInfoPath);
  console.log('✅ Removed: backups/restore-info.json');
}

// 2. Remove runtime-state.json (prevents reload of in-memory state)
const runtimeStatePath = path.join(backupsDir, 'runtime-state.json');
if (fs.existsSync(runtimeStatePath)) {
  fs.unlinkSync(runtimeStatePath);
  console.log('✅ Removed: backups/runtime-state.json');
}

// 3. Remove index.json (backup catalog)
const indexPath = path.join(backupsDir, 'index.json');
if (fs.existsSync(indexPath)) {
  fs.unlinkSync(indexPath);
  console.log('✅ Removed: backups/index.json');
}

// 4. Archive old backup directories
const archiveDir = path.join(backupsDir, '_archived');
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

let archivedCount = 0;
if (fs.existsSync(backupsDir)) {
  const files = fs.readdirSync(backupsDir);
  files.forEach(file => {
    const filePath = path.join(backupsDir, file);
    const stat = fs.statSync(filePath);
    
    // Move backup_XXXX directories and .zip files to archive
    if ((stat.isDirectory() && file.startsWith('backup_')) || 
        (file.endsWith('.zip') && file.includes('backup'))) {
      const destPath = path.join(archiveDir, file);
      fs.renameSync(filePath, destPath);
      console.log(`📦 Archived: backups/${file}`);
      archivedCount++;
    }
  });
}

console.log(`\n✅ Archived ${archivedCount} backup folder(s) to backups/_archived/`);

console.log('\n' + '═'.repeat(70));
console.log('✨ CLEANUP COMPLETE');
console.log('═'.repeat(70));

console.log('\n📋 Next Steps:');
console.log('');
console.log('1. Verify PostgreSQL is running:');
console.log('   echo $DATABASE_URL');
console.log('');
console.log('2. Ensure .env has production flags:');
console.log('   LOAD_BACKUP_AT_BOOT=false');
console.log('   ENABLE_MEMORY_FALLBACK=false');
console.log('   ENABLE_RUNTIME_STATE_SAVE=false');
console.log('');
console.log('3. Restart the API server:');
console.log('   npm run dev');
console.log('');
console.log('4. Test that data comes from Prisma:');
console.log('   curl http://localhost:3001/api/members');
console.log('   curl http://localhost:3001/api/events');
console.log('   curl http://localhost:3001/public/vehicles');
console.log('');
console.log('5. Verify changes persist after restart:');
console.log('   - Add a member via API');
console.log('   - Restart server');
console.log('   - Member should still exist');
console.log('');
console.log('6. Deploy to production with confidence!');
console.log('\n');
