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

// ✅ TABLES À SAUVEGARDER - correspondant aux structures utilisées dans server.js
// Ne sauvegarder que ce qu'on utilise réellement
const tablesToBackup = [
  // Core data
  'members',              // Utilisateurs/membres
  'Vehicle',              // Véhicules
  'Event',                // Événements
  'site_users',           // Utilisateurs site (pour auth + permissions)
  
  // Finance
  'finance_transactions', // Transactions
  'finance_categories',   // Catégories financières
  'finance_balances',     // Soldes/balance
  'finance_expense_reports',  // Rapports de dépenses
  
  // Vehicles details
  'vehicle_maintenance',  // Maintenance véhicules
  'vehicle_service_schedule',  // Planning services
  'Usage',                // Utilisation véhicules
  
  // Content
  'RetroNews',            // Actualités RétroBus
  'Flash',                // Messages flash
  'Document',             // Documents
  
  // Financial documents
  'DevisLine',            // Lignes de devis
  'QuoteTemplate',        // Templates de devis
  'financial_documents',  // Documents financiers
  
  // Permissions & settings
  'user_permissions',     // Permissions utilisateurs
  'notification_preferences',  // Préférences notifications
  'scheduled_operations', // Opérations planifiées
  'scheduled_operation_payments'  // Paiements planifiés
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
      description: 'Export des tables critiques pour l\'application RétroBus',
      tables: {}
    };
    
    let totalRows = 0;
    let successCount = 0;
    let failureCount = 0;
    
    console.log('📥 EXPORT DES TABLES CRITIQUES\n');
    
    for (const table of tablesToBackup) {
      try {
        const res = await c.query(`SELECT * FROM "${table}"`);
        
        backupData.tables[table] = {
          count: res.rows.length,
          columns: res.fields?.map(f => f.name) || [],
          data: res.rows
        };
        
        totalRows += res.rows.length;
        successCount++;
        
        if (res.rows.length > 0) {
          console.log(`  ✅ ${table.padEnd(35)} ${res.rows.length.toString().padStart(6)} lignes`);
        } else {
          console.log(`  ⚪ ${table.padEnd(35)} (vide)`);
        }
      } catch (err) {
        failureCount++;
        const errMsg = err.message.includes('relation') ? 'table inexistante' : err.message.slice(0, 35);
        console.log(`  ⚠️  ${table.padEnd(35)} ${errMsg}`);
      }
    }
    
    // Sauvegarder en JSON
    const jsonPath = path.join(backupPath, 'data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(backupData, null, 2));
    
    // Créer un fichier manifest détaillé
    const manifest = {
      name: backupName,
      timestamp: new Date().toISOString(),
      type: 'FULL_EXPORT',
      description: 'Export complet des tables critiques pour restauration autonome',
      statistics: {
        totalRows,
        tablesRequested: tablesToBackup.length,
        tablesExported: successCount,
        tablesFailed: failureCount,
        exportRate: ((successCount / tablesToBackup.length) * 100).toFixed(1) + '%'
      },
      tablesIncluded: Object.keys(backupData.tables),
      usage: 'Ce backup contient TOUTES les données nécessaires pour démarrer l\'application sans dépendre de PostgreSQL'
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
    console.log(`✅ EXPORT COMPLET RÉUSSI`);
    console.log(`${'═'.repeat(75)}`);
    console.log(`📁 Backup: ${backupPath}`);
    console.log(`\n📊 Statistiques:`);
    console.log(`   • Tables à exporter: ${tablesToBackup.length}`);
    console.log(`   • Tables exportées: ${successCount}`);
    console.log(`   • Tables manquantes: ${failureCount}`);
    console.log(`   • Total de lignes: ${totalRows}`);
    console.log(`   • Taux de réussite: ${((successCount / tablesToBackup.length) * 100).toFixed(1)}%`);
    console.log(`\n📋 Fichiers créés:`);
    console.log(`   • data.json (données)`);
    console.log(`   • manifest.json (métadonnées)`);
    console.log(`\n💡 Usage:`);
    console.log(`   Ce backup contient TOUTES les données nécessaires pour démarrer`);
    console.log(`   l'application sans dépendre de PostgreSQL.`);
    console.log(`${'═'.repeat(75)}\n`);
    
  } catch (err) {
    console.error('❌ Erreur lors de la sauvegarde:', err.message);
  } finally {
    await c.end();
  }
}

backupDatabase();
