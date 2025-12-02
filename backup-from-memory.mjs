/**
 * Backup depuis le serveur en mémoire
 * Sauvegarde l'état en mémoire du serveur en cours d'exécution
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDir = path.join(__dirname, 'backups');
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Créer le répertoire backups s'il n'existe pas
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function backupFromMemory() {
  try {
    console.log(`🔗 Récupération des données depuis ${API_URL}...\n`);
    
    // Récupérer l'état du serveur
    const response = await fetch(`${API_URL}/api/export/state`);
    
    if (!response.ok) {
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }
    
    const backupData = await response.json();
    
    // Créer le dossier du backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupName = `backup_${timestamp}`;
    const backupPath = path.join(backupDir, backupName);
    fs.mkdirSync(backupPath, { recursive: true });
    
    // Compter les lignes
    let totalRows = 0;
    let tableCount = 0;
    const tables = backupData.tables || {};
    
    console.log('📥 EXPORT DE L\'ÉTAT EN MÉMOIRE\n');
    
    for (const [table, data] of Object.entries(tables)) {
      const count = data.count || (Array.isArray(data.data) ? data.data.length : 0);
      totalRows += count;
      if (count > 0) {
        tableCount++;
      }
      
      if (count > 0) {
        console.log(`  ✅ ${table.padEnd(35)} ${count.toString().padStart(6)} lignes`);
      } else {
        console.log(`  ⚪ ${table.padEnd(35)} (vide)`);
      }
    }
    
    // Sauvegarder en JSON
    const jsonPath = path.join(backupPath, 'data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(backupData, null, 2));
    
    // Créer un fichier manifest
    const manifest = {
      name: backupName,
      timestamp: new Date().toISOString(),
      type: 'FULL_EXPORT',
      description: 'Export complet de l\'état en mémoire',
      statistics: {
        totalRows,
        tablesRequested: Object.keys(tables).length,
        tablesExported: tableCount,
        tablesFailed: 0,
        exportRate: ((tableCount / Object.keys(tables).length) * 100).toFixed(1) + '%'
      },
      tablesIncluded: Object.keys(tables),
      usage: 'Ce backup contient TOUTES les données en mémoire pour restauration autonome'
    };
    
    const manifestPath = path.join(backupPath, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Mettre à jour l'index des sauvegardes
    const indexPath = path.join(backupDir, 'index.json');
    let index = [];
    
    if (fs.existsSync(indexPath)) {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    }
    
    index.push(manifest);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    
    console.log(`\n${'═'.repeat(75)}`);
    console.log(`✅ BACKUP RÉUSSI`);
    console.log(`${'═'.repeat(75)}`);
    console.log(`📁 Backup: ${backupPath}`);
    console.log(`\n📊 Statistiques:`);
    console.log(`   • Tables: ${Object.keys(tables).length}`);
    console.log(`   • Tables avec données: ${tableCount}`);
    console.log(`   • Total de lignes: ${totalRows}`);
    console.log(`\n📋 Fichiers créés:`);
    console.log(`   • data.json (données)`);
    console.log(`   • manifest.json (métadonnées)`);
    console.log(`${'═'.repeat(75)}\n`);
    
  } catch (err) {
    console.error('❌ Erreur lors de la sauvegarde:', err.message);
    console.error('\n💡 Assurez-vous que le serveur est en cours d\'exécution (npm run dev)');
    process.exit(1);
  }
}

backupFromMemory();
