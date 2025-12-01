import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDir = path.join(__dirname, 'backups');

function listBackups() {
  const indexPath = path.join(backupDir, 'index.json');
  
  if (!fs.existsSync(indexPath)) {
    console.log('❌ Aucune sauvegarde trouvée');
    return [];
  }
  
  const backups = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  
  console.log('\n=== Sauvegardes disponibles ===\n');
  backups.forEach((backup, idx) => {
    const date = new Date(backup.timestamp).toLocaleString('fr-FR');
    console.log(`${idx + 1}. ${backup.name}`);
    console.log(`   📅 ${date}`);
    console.log(`   📊 ${backup.totalRows} lignes de ${backup.totalTables} tables\n`);
  });
  
  return backups;
}

function loadBackup(backupName) {
  const backupPath = path.join(backupDir, backupName, 'data.json');
  
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Sauvegarde "${backupName}" non trouvée`);
    return null;
  }
  
  return JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
}

function getLatestBackup() {
  const indexPath = path.join(backupDir, 'index.json');
  
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  
  const backups = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  return backups[backups.length - 1];
}

export { listBackups, loadBackup, getLatestBackup, backupDir };
