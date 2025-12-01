import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDir = path.join(__dirname, 'backups');

// Créer le répertoire backups s'il n'existe pas
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const c = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
  database: 'railway'
});

// Tables critiques à sauvegarder
const tablesToBackup = [
  'members',
  'Vehicle',
  'Event',
  'finance_transactions',
  'finance_categories',
  'finance_balances',
  'finance_expense_reports',
  'user_permissions',
  'RetroNews',
  'Flash',
  'Document',
  'vehicle_maintenance',
  'vehicle_service_schedule',
  'site_users',
  'notification_preferences',
  'scheduled_operations',
  'scheduled_operation_payments',
  'Stock',
  'StockMovement',
  'Usage',
  'Report',
  'Changelog'
];

async function backupDatabase() {
  try {
    await c.connect();
    console.log('🔗 Connecté à PostgreSQL...\n');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupName = `backup_${timestamp}`;
    const backupPath = path.join(backupDir, backupName);
    
    // Créer le dossier du backup
    fs.mkdirSync(backupPath, { recursive: true });
    
    const backupData = {
      timestamp: new Date().toISOString(),
      tables: {}
    };
    
    let totalRows = 0;
    
    for (const table of tablesToBackup) {
      try {
        console.log(`📥 Sauvegarde de ${table}...`);
        const res = await c.query(`SELECT * FROM "${table}"`);
        
        backupData.tables[table] = {
          count: res.rows.length,
          columns: res.fields?.map(f => f.name) || [],
          data: res.rows
        };
        
        totalRows += res.rows.length;
        console.log(`   ✅ ${res.rows.length} lignes`);
      } catch (err) {
        console.log(`   ⚠️  Erreur: ${err.message}`);
      }
    }
    
    // Sauvegarder en JSON
    const jsonPath = path.join(backupPath, 'data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(backupData, null, 2));
    
    // Créer un fichier manifest
    const manifest = {
      name: backupName,
      timestamp: new Date().toISOString(),
      totalRows,
      totalTables: Object.keys(backupData.tables).length,
      tablesBackedup: Object.keys(backupData.tables)
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
    
    console.log(`\n✅ Sauvegarde complète réussie!`);
    console.log(`   📁 Dossier: ${backupPath}`);
    console.log(`   📊 Total: ${totalRows} lignes sauvegardées`);
    console.log(`   📋 Tables: ${Object.keys(backupData.tables).length}`);
    
  } catch (err) {
    console.error('❌ Erreur lors de la sauvegarde:', err.message);
  } finally {
    await c.end();
  }
}

backupDatabase();
