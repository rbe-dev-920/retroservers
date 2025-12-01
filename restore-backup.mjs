import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { loadBackup, getLatestBackup, listBackups, backupDir } from './backup-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const isLatest = args.includes('--latest');
const isInteractive = args.includes('--interactive');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function restoreBackup() {
  try {
    let backupName = null;

    if (isLatest) {
      // Restaurer la dernière sauvegarde
      const latest = getLatestBackup();
      if (!latest) {
        console.error('❌ Aucune sauvegarde trouvée');
        process.exit(1);
      }
      backupName = latest.name;
      console.log(`\n📦 Restauration de: ${backupName}\n`);
    } else if (isInteractive) {
      // Mode interactif - liste et choix
      console.log('');
      listBackups();
      const choice = await prompt('Choisir un numéro de sauvegarde: ');
      const index = parseInt(choice) - 1;
      
      const indexPath = path.join(backupDir, 'index.json');
      if (!fs.existsSync(indexPath)) {
        console.error('❌ Aucune sauvegarde trouvée');
        process.exit(1);
      }
      
      const backups = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      if (index < 0 || index >= backups.length) {
        console.error('❌ Choix invalide');
        process.exit(1);
      }
      
      backupName = backups[index].name;
      console.log(`\n📦 Restauration de: ${backupName}\n`);
    } else {
      // Par défaut: restaurer la dernière
      const latest = getLatestBackup();
      if (!latest) {
        console.error('❌ Aucune sauvegarde trouvée');
        process.exit(1);
      }
      backupName = latest.name;
      console.log(`\n📦 Restauration de: ${backupName}\n`);
    }

    // Charger le backup
    const backupData = loadBackup(backupName);
    if (!backupData) {
      console.error('❌ Échec du chargement du backup');
      process.exit(1);
    }

    // Afficher les statistiques
    const backupPath = path.join(backupDir, backupName);
    const manifestPath = path.join(backupPath, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    console.log('═'.repeat(75));
    console.log('📋 DÉTAILS DU BACKUP');
    console.log('═'.repeat(75));
    console.log(`📅 Date: ${new Date(manifest.timestamp).toLocaleString('fr-FR')}`);
    console.log(`📊 Lignes: ${manifest.statistics.totalRows}`);
    console.log(`📦 Tables: ${manifest.statistics.tablesExported}/${manifest.statistics.tablesRequested}`);
    console.log(`✅ Taux: ${manifest.statistics.exportRate}`);
    console.log('\n📑 Tables incluses:');
    manifest.tablesIncluded.forEach(t => console.log(`   • ${t}`));
    console.log('═'.repeat(75));

    // Confirmation
    if (isInteractive) {
      const confirm = await prompt('\n⚠️  Êtes-vous sûr? Les données actuelles seront remplacées (y/N): ');
      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ Restauration annulée');
        rl.close();
        process.exit(0);
      }
    }

    // La restauration se fait au redémarrage du serveur
    console.log('\n✅ Backup sélectionné pour restauration');
    console.log('💡 Au prochain démarrage du serveur (npm run dev),');
    console.log('   les données de ce backup seront chargées.\n');

    rl.close();

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    rl.close();
    process.exit(1);
  }
}

restoreBackup();
