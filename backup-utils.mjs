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
  
  console.log('\n' + '═'.repeat(80));
  console.log('📦 SAUVEGARDES DISPONIBLES');
  console.log('═'.repeat(80) + '\n');
  
  backups.forEach((backup, idx) => {
    const date = new Date(backup.timestamp).toLocaleString('fr-FR');
    console.log(`${String(idx + 1).padStart(2, ' ')}. ${backup.name}`);
    console.log(`    📅 Date: ${date}`);
    console.log(`    📊 Lignes: ${backup.totalRows}`);
    
    if (backup.totalTablesInDb) {
      console.log(`    📋 Tables trouvées: ${backup.totalTablesInDb}`);
      console.log(`    ✅ Tables sauvegardées: ${backup.tablesBackedUp}`);
      if (backup.tablesFailed > 0) {
        console.log(`    ⚠️  Tables en erreur: ${backup.tablesFailed}`);
      }
      console.log(`    📈 Taux de succès: ${backup.statistics?.successRate || 'N/A'}`);
    } else {
      // Ancien format
      console.log(`    📋 Tables: ${backup.totalTables}`);
    }
    
    // Afficher la liste des tables sauvegardées
    if (backup.tablesInBackup && backup.tablesInBackup.length > 0) {
      console.log(`    📑 Tables: [${backup.tablesInBackup.slice(0, 5).join(', ')}${backup.tablesInBackup.length > 5 ? '...' : ''}]`);
    }
    console.log();
  });
  
  console.log('═'.repeat(80) + '\n');
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
