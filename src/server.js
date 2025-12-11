import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// 🔧 Modes avancés (désactivés par défaut en production)
// - LOAD_BACKUP_AT_BOOT : recharge un backup JSON au démarrage (❌ à éviter en prod)
// - ENABLE_RUNTIME_STATE_SAVE : écrit l'état mémoire dans runtime-state.json
// - ENABLE_MEMORY_FALLBACK : bascule en mémoire si Prisma ne répond pas
//
// Par défaut TOUT est à false pour éviter les "données fantômes".
const LOAD_BACKUP_AT_BOOT = process.env.LOAD_BACKUP_AT_BOOT === 'true';
const ENABLE_MEMORY_FALLBACK = process.env.ENABLE_MEMORY_FALLBACK === 'true';
const ENABLE_RUNTIME_STATE_SAVE = process.env.ENABLE_RUNTIME_STATE_SAVE === 'true';

// ============================================================
// 🔧 INITIALISATION PRISMA (source unique de vérité)
// ============================================================
let prisma = null;
let prismaAvailable = true; // Always true - Prisma is the single source of truth

// Initialize Prisma without blocking startup
try {
  prisma = new PrismaClient({
    log: ['warn', 'error'], // Only warn and error logs in production
  });
  console.log('✅ PrismaClient instance created');
  
  // Test connection asynchronously (don't block startup)
  prisma.$queryRaw`SELECT 1`.then(() => {
    console.log('✅ Database connection verified');
  }).catch(e => {
    console.warn('⚠️ Database connection check failed:', e.message);
  });
} catch (e) {
  console.error('❌ CRITICAL: Failed to initialize Prisma:', e.message);
  process.exit(1);
}

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 4000;
const pathRoot = process.cwd();

// ============================================================
// 🚀 MODE HYBRIDE - Prisma + État en mémoire pour compatibilité
// ============================================================
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('   🚀 RÉTROBUS ESSONNE - SERVEUR API (PRISMA MODE)');
console.log('   📦 Database: Railway PostgreSQL');
console.log('   ✅ Single source of truth: Prisma ORM');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Helpers
const uid = () => (global.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`);
const today = () => new Date().toISOString().split('T')[0];

// ============================================================
// 🔧 ÉTAT EN MÉMOIRE - Pour endpoints non encore migrés vers Prisma
// ============================================================
const state = {
  members: [],
  siteUsers: [],
  notifications: [],
  vehicles: [],
  events: [],
  flashes: [],
  retroNews: [],
  transactions: [],
  expenseReports: [],
  documents: [],
  devisLines: [],
  quoteTemplates: [],
  financialDocuments: [],
  userPermissions: {},
  notificationPreferences: [],
  vehicleMaintenance: [],
  vehicleServiceSchedule: [],
  vehicleScheduleItem: [],
  vehicleUsage: [],
  scheduledOperations: [],
  scheduledOperationPayments: [],
  stock: [],
  stockMovements: [],
  vehicleCarteGrise: [],
  vehicleAssurance: [],
  vehicleControleTechnique: [],
  vehicleCertificatCession: [],
  vehicleEchancier: [],
  scheduled: [],
  simulations: [],
  bankBalance: 0,
  categories: [
    { id: 'adhesions', name: 'Adhésions', type: 'recette' },
    { id: 'evenements', name: 'Événements', type: 'recette' },
    { id: 'carburant', name: 'Carburant', type: 'depense' },
    { id: 'maintenance', name: 'Maintenance', type: 'depense' },
    { id: 'assurance', name: 'Assurance', type: 'depense' },
    { id: 'materiel', name: 'Matériel', type: 'depense' },
    { id: 'frais_admin', name: 'Frais administratifs', type: 'depense' },
    { id: 'autres', name: 'Autres', type: 'both' }
  ]
};

// Catégories financières par défaut (en mémoire car rarement modifiées)
const defaultCategories = state.categories;

const backupsDir = path.join(pathRoot, 'backups');
const runtimeStatePath = path.join(backupsDir, 'runtime-state.json');

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const persistStateToDisk = () => {
  if (!ENABLE_RUNTIME_STATE_SAVE) {
    // Mode normal : on ne sauvegarde PAS l'état mémoire sur disque
    return;
  }
  try {
    ensureDirectoryExists(path.dirname(runtimeStatePath));
    fs.writeFileSync(runtimeStatePath, JSON.stringify({
      savedAt: new Date().toISOString(),
      state
    }, null, 2), 'utf-8');
  } catch (error) {
    console.warn('⚠️  Impossible de sauvegarder l\'état en mémoire:', error.message);
  }
};

let stateSaveTimer = null;
const debouncedSave = () => {
  if (stateSaveTimer) clearTimeout(stateSaveTimer);
  stateSaveTimer = setTimeout(persistStateToDisk, 750);
};

const normalizeExtrasValue = (extras) => {
  if (extras === undefined) return undefined;
  if (extras === null) return null;
  if (typeof extras === 'string') return extras;
  try {
    return JSON.stringify(extras);
  } catch (error) {
    console.warn('⚠️  Impossible de sérialiser extras:', error.message);
    return null;
  }
};

const normalizeEventExtras = (event = {}) => {
  if (!event || typeof event !== 'object') return event;
  const normalized = { ...event };
  if (Object.prototype.hasOwnProperty.call(normalized, 'extras')) {
    const normalizedExtras = normalizeExtrasValue(normalized.extras);
    if (normalizedExtras === undefined) {
      delete normalized.extras;
    } else {
      normalized.extras = normalizedExtras;
    }
  }
  return normalized;
};

const normalizeEventCollection = (events = []) => events.map(ev => normalizeEventExtras(ev));

const prismaEventFieldAllowList = new Set(['title', 'description', 'date', 'time', 'location', 'helloAssoUrl', 'adultPrice', 'childPrice', 'status', 'vehicleId', 'extras']);

const buildPrismaEventUpdateData = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return {};
  const normalized = normalizeEventExtras(payload);
  const data = {};
  prismaEventFieldAllowList.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(normalized, key) && normalized[key] !== undefined) {
      data[key] = normalized[key];
    }
  });
  if (data.date) {
    const parsedDate = new Date(data.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      data.date = parsedDate;
    } else {
      delete data.date;
    }
  }
  return data;
};

const buildStateEventUpdateData = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return {};
  const normalized = normalizeEventExtras(payload);
  if (normalized.date instanceof Date) {
    normalized.date = normalized.date.toISOString();
  } else if (normalized.date) {
    const parsedDate = new Date(normalized.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      normalized.date = parsedDate.toISOString();
    }
  }
  return normalized;
};

const upsertEventInMemory = (event) => {
  if (!event) return null;
  if (!Array.isArray(state.events)) state.events = [];
  const normalized = normalizeEventExtras(event);
  const idx = state.events.findIndex(ev => ev.id === normalized.id);
  if (idx === -1) {
    state.events.push(normalized);
    return normalized;
  }
  state.events[idx] = { ...state.events[idx], ...normalized };
  return state.events[idx];
};

const updateEventInMemory = (eventId, updatePayload = {}) => {
  if (!Array.isArray(state.events)) state.events = [];
  const idx = state.events.findIndex(ev => ev.id === eventId);
  if (idx === -1) return null;
  const normalizedUpdate = normalizeEventExtras(updatePayload);
  const merged = {
    ...state.events[idx],
    ...normalizedUpdate,
    id: state.events[idx].id || eventId,
    updatedAt: new Date().toISOString()
  };
  state.events[idx] = normalizeEventExtras(merged);
  return state.events[idx];
};

// VEHICLE HELPERS ---------------------------------------------------------
const prismaVehicleFieldAllowList = new Set([
  'id', 'parc', 'type', 'modele', 'marque', 'subtitle', 'immat', 'etat',
  'miseEnCirculation', 'energie', 'description', 'history', 'caracteristiques',
  'gallery', 'backgroundImage', 'backgroundPosition', 'isPublic', 'fuel', 'mileage'
]);

const numericVehicleFields = new Set(['fuel', 'mileage']);
const dateVehicleFields = new Set(['miseEnCirculation']);
const booleanVehicleFields = new Set(['isPublic']);

const coerceVehicleValue = (key, value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (numericVehicleFields.has(key)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (dateVehicleFields.has(key)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (booleanVehicleFields.has(key)) {
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
  }
  if (key === 'caracteristiques' && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.warn('⚠️  Impossible de sérialiser caracteristiques:', error.message);
      return null;
    }
  }
  return value;
};

const buildPrismaVehicleUpdateData = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return {};
  const data = {};
  Object.keys(payload).forEach((key) => {
    if (!prismaVehicleFieldAllowList.has(key)) return;
    const coerced = coerceVehicleValue(key, payload[key]);
    if (coerced !== undefined) data[key] = coerced;
  });
  return data;
};

const buildStateVehicleUpdateData = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return {};
  const update = {};
  Object.keys(payload).forEach((key) => {
    let value = payload[key];
    if (dateVehicleFields.has(key)) {
      const date = new Date(value);
      value = Number.isNaN(date.getTime()) ? null : date.toISOString();
    } else if (booleanVehicleFields.has(key)) {
      if (typeof value === 'string') value = value.toLowerCase() === 'true';
      else value = Boolean(value);
    } else if (numericVehicleFields.has(key)) {
      const parsed = Number(value);
      value = Number.isFinite(parsed) ? parsed : null;
    } else if (key === 'caracteristiques' && typeof value === 'object') {
      try {
        value = JSON.stringify(value);
      } catch (error) {
        console.warn('⚠️  Impossible de sérialiser caracteristiques:', error.message);
        value = null;
      }
    }
    update[key] = value;
  });
  return update;
};

const upsertVehicleInMemory = (vehicle) => {
  if (!vehicle) return null;
  if (!Array.isArray(state.vehicles)) state.vehicles = [];
  const idx = state.vehicles.findIndex(v => v.parc === vehicle.parc);
  if (idx === -1) {
    state.vehicles.push({ ...vehicle });
    return state.vehicles[state.vehicles.length - 1];
  }
  state.vehicles[idx] = { ...state.vehicles[idx], ...vehicle };
  return state.vehicles[idx];
};

const updateVehicleInMemory = (parc, updatePayload = {}) => {
  if (!Array.isArray(state.vehicles)) state.vehicles = [];
  const idx = state.vehicles.findIndex(v => v.parc === parc || String(v.id) === String(parc));
  if (idx === -1) return null;
  state.vehicles[idx] = {
    ...state.vehicles[idx],
    ...updatePayload,
    parc: state.vehicles[idx].parc || parc,
    updatedAt: new Date().toISOString()
  };
  return state.vehicles[idx];
};

// ============================================================
// ⚠️  ATTENTION - SYSTÈME DE BACKUP JSON
// ============================================================
// - Ce système charge un snapshot complet des données dans `state`
//   à partir des fichiers présents dans le dossier `backups/`.
// - En PRODUCTION, on ne doit PAS utiliser ce mécanisme comme
//   persistance principale, car il peut réinjecter d'anciennes
//   données à chaque redémarrage.
// - La source de vérité en production doit être la base Prisma
//   (DATABASE_URL) et non les fichiers JSON.
//
// Recommandation :
//   LOAD_BACKUP_AT_BOOT = false
//   ENABLE_RUNTIME_STATE_SAVE = false
//   ENABLE_MEMORY_FALLBACK = false
// ============================================================

// 💾 CHARGEMENT DU BACKUP AU DÉMARRAGE
function loadBackupAtStartup() {
  try {
    const backupDir = backupsDir;
    
    // D'abord, chercher restore-info.json
    let backupName = null;
    const restoreInfoPath = path.join(backupDir, 'restore-info.json');
    
    if (fs.existsSync(restoreInfoPath)) {
      const restoreInfo = JSON.parse(fs.readFileSync(restoreInfoPath, 'utf-8'));
      backupName = restoreInfo.backupToRestore;
    }
    
    // Si pas de restore-info.json, charger le backup le plus récent de index.json
    if (!backupName) {
      const indexPath = path.join(backupDir, 'index.json');
      if (fs.existsSync(indexPath)) {
        const backups = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        if (backups.length > 0) {
          // Prendre le dernier (le plus récent)
          backupName = backups[backups.length - 1].name;
          console.log(`📌 Aucun restore-info.json, chargement du backup le plus récent: ${backupName}`);
        }
      }
    }
    
    if (!backupName) {
      console.log('ℹ️  Aucun backup à charger');
      return;
    }
    
    const backupPath = path.join(backupDir, backupName, 'data.json');
    
    if (!fs.existsSync(backupPath)) {
      console.warn(`⚠️  Backup introuvable: ${backupPath}`);
      return;
    }
    
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    const tables = backupData.tables || {};
    
    console.log(`📦 Chargement du backup: ${backupName}`);
    
    // Charger chaque table dans state
    if (tables.members?.data) {
      state.members = tables.members.data;
      console.log(`   ✅ ${state.members.length} adhérents`);
    }
    if (tables.site_users?.data) {
      state.siteUsers = tables.site_users.data;
      console.log(`   ✅ ${state.siteUsers.length} utilisateurs site`);
    }
    if (tables.Vehicle?.data) {
      state.vehicles = tables.Vehicle.data;
      console.log(`   ✅ ${state.vehicles.length} véhicules`);
    }
    if (tables.RetroNews?.data) {
      state.retroNews = tables.RetroNews.data;
      console.log(`   ✅ ${state.retroNews.length} actualités`);
    }
    if (tables.Event?.data) {
      state.events = normalizeEventCollection(tables.Event.data || []);
      console.log(`   ✅ ${state.events.length} événements`);
    }
    if (tables.Flash?.data) {
      state.flashes = tables.Flash.data;
      console.log(`   ✅ ${state.flashes.length} flashes`);
    }
    if (tables.finance_transactions?.data) {
      state.transactions = tables.finance_transactions.data;
      console.log(`   ✅ ${state.transactions.length} transactions`);
    }
    if (tables.finance_expense_reports?.data) {
      state.expenseReports = tables.finance_expense_reports.data;
      console.log(`   ✅ ${state.expenseReports.length} rapports de dépenses`);
    }
    if (tables.DevisLine?.data) {
      state.devisLines = tables.DevisLine.data;
      console.log(`   ✅ ${state.devisLines.length} lignes de devis`);
    }
    if (tables.QuoteTemplate?.data) {
      state.quoteTemplates = tables.QuoteTemplate.data;
      console.log(`   ✅ ${state.quoteTemplates.length} templates de devis`);
    }
    if (tables.financial_documents?.data) {
      state.financialDocuments = tables.financial_documents.data;
      console.log(`   ✅ ${state.financialDocuments.length} documents financiers`);
    }
    if (tables.Document?.data) {
      state.documents = tables.Document.data;
      console.log(`   ✅ ${state.documents.length} documents`);
    }
    if (tables.user_permissions?.data) {
      state.userPermissions = tables.user_permissions.data;
      console.log(`   ✅ ${state.userPermissions.length || Object.keys(state.userPermissions).length} permissions utilisateurs`);
    }
    if (tables.finance_categories?.data) {
      // Merge avec les catégories par défaut
      state.categories = [...state.categories, ...tables.finance_categories.data];
      console.log(`   ✅ ${tables.finance_categories.data.length} catégories financières`);
    }
    if (tables.finance_balances?.data) {
      if (tables.finance_balances.data[0]) {
        state.bankBalance = tables.finance_balances.data[0].balance || 0;
        console.log(`   ✅ Solde bancaire: ${state.bankBalance}€`);
      }
    }
    if (tables.vehicle_maintenance?.data) {
      state.vehicleMaintenance = tables.vehicle_maintenance.data;
      console.log(`   ✅ ${state.vehicleMaintenance.length} maintenances véhicules`);
    }
    if (tables.vehicle_service_schedule?.data) {
      state.vehicleServiceSchedule = tables.vehicle_service_schedule.data;
      console.log(`   ✅ ${state.vehicleServiceSchedule.length} plannings services`);
    }
    if (tables.Usage?.data) {
      state.vehicleUsage = tables.Usage.data;
      console.log(`   ✅ ${state.vehicleUsage.length} utilisations véhicules`);
    }
    if (tables.notification_preferences?.data) {
      state.notificationPreferences = tables.notification_preferences.data;
      console.log(`   ✅ ${state.notificationPreferences.length} préférences notifications`);
    }
    if (tables.scheduled_operations?.data) {
      state.scheduledOperations = tables.scheduled_operations.data;
      console.log(`   ✅ ${state.scheduledOperations.length} opérations planifiées`);
    }
    if (tables.scheduled_operation_payments?.data) {
      state.scheduledOperationPayments = tables.scheduled_operation_payments.data;
      console.log(`   ✅ ${state.scheduledOperationPayments.length} paiements planifiés`);
    }
    if (tables.Stock?.data) {
      state.stock = tables.Stock.data;
      console.log(`   ✅ ${state.stock.length} articles de stock`);
    }
    if (tables.StockMovement?.data) {
      state.stockMovements = tables.StockMovement.data;
      console.log(`   ✅ ${state.stockMovements.length} mouvements de stock`);
    }
    
    console.log('✨ Backup chargé avec succès en mémoire\n');
    
  } catch (error) {
    console.warn('⚠️  Erreur lors du chargement du backup:', error.message);
  }
}

// Charger le backup au démarrage (optionnel)
if (LOAD_BACKUP_AT_BOOT) {
  console.log('⚠️  LOAD_BACKUP_AT_BOOT=true - tentative de chargement d\'un backup JSON');
  loadBackupAtStartup();
  state.events = normalizeEventCollection(state.events || []);
} else {
  console.log('⏭️  Aucun backup chargé au démarrage (LOAD_BACKUP_AT_BOOT=false)');
}

// CORS configuration - Allow frontend(s) and local dev
const allowedOrigins = [
  // Internal frontend
  'https://www.retrobus-interne.fr',
  'https://retrobus-interne.fr',
  // External frontend
  'https://www.association-rbe.fr',
  'https://association-rbe.fr',
  'https://attractive-kindness-rbe-serveurs.up.railway.app', // Frontend on same Railway
  // Railway subdomains and alternatives
  'https://retrobus-interne-frontend.up.railway.app',
  'https://rbe-frontend.up.railway.app',
  // Local dev
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (like curl, Postman, mobile apps)
    if (!origin) return cb(null, true);
    // Allow if in whitelist
    if (allowedOrigins.includes(origin)) return cb(null, origin);
    // In development (non-production), be more lenient
    if (process.env.NODE_ENV !== 'production') return cb(null, origin);
    // In production, only allow whitelisted origins
    return cb(new Error('CORS bloque: origine non autorisée'));
  },
  credentials: true,
  allowedHeaders: ['Authorization','Content-Type','Accept','x-qr-token','x-user-matricule'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS']
}));
// Préflight OPTIONS handler - ensure CORS headers are set
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, x-qr-token, x-user-matricule');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    return res.sendStatus(200);
  }
  next();
});

// Middleware JSON
app.use(express.json());
// Static files (serve uploaded content)
app.use('/uploads', express.static(pathRoot + '/uploads'));

// Auth middleware - decode token and extract email
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      // Token format: 'stub.' + base64(email)
      if (token.startsWith('stub.')) {
        const emailB64 = token.slice(5);
        const email = Buffer.from(emailB64, 'base64').toString('utf-8');
        req.user = { email: email, id: 'authenticated' }; // pass email for member lookup
      }
    } catch (e) {
      console.error('❌ Token decode error:', e.message);
    }
  }
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// Health & version
app.get(['/api/health','/health'], (req, res) => res.json({ ok: true, time: new Date().toISOString(), version: 'rebuild-1' }));

// Export endpoint pour sauvegarde - accessible pour les scripts de backup
app.get(['/api/export/state', '/export/state'], async (req, res) => {
  try {
    // En mode Prisma, récupérer les données depuis la base de données
    const [members, vehicles, events, retroNews, flashes, transactions, expenseReports, documents, maintenances, usages, retroRequests, retroRequestFiles] = await Promise.all([
      prisma.members.findMany(),
      prisma.vehicle.findMany(),
      prisma.event.findMany(),
      prisma.retroNews.findMany(),
      prisma.flash.findMany(),
      prisma.financeTransaction.findMany(),
      prisma.financeExpenseReport.findMany(),
      prisma.document.findMany(),
      prisma.vehicleMaintenance.findMany(),
      prisma.vehicleUsage.findMany(),
      prisma.retro_request.findMany(),
      prisma.retro_request_file.findMany()
    ]);

    const exported = {
      timestamp: new Date().toISOString(),
      description: 'Export complet depuis Prisma (base de données)',
      mode: 'PRISMA_DATABASE',
      tables: {
        members: { count: members.length, data: members },
        site_users: { count: 0, data: [] },
        Vehicle: { count: vehicles.length, data: vehicles },
        Event: { count: events.length, data: events },
        RetroNews: { count: retroNews.length, data: retroNews },
        Flash: { count: flashes.length, data: flashes },
        finance_transactions: { count: transactions.length, data: transactions },
        finance_expense_reports: { count: expenseReports.length, data: expenseReports },
        Document: { count: documents.length, data: documents },
        DevisLine: { count: 0, data: [] },
        QuoteTemplate: { count: 0, data: [] },
        financial_documents: { count: 0, data: [] },
        user_permissions: { count: 0, data: {} },
        vehicle_maintenance: { count: maintenances.length, data: maintenances },
        vehicle_service_schedule: { count: 0, data: [] },
        Usage: { count: usages.length, data: usages },
        retro_request: { count: retroRequests.length, data: retroRequests },
        retro_request_file: { count: retroRequestFiles.length, data: retroRequestFiles },
        notification_preferences: { count: 0, data: [] },
        scheduled_operations: { count: 0, data: [] },
        scheduled_operation_payments: { count: 0, data: [] }
      }
    };
    res.json(exported);
  } catch (e) {
    console.error('❌ Error exporting state:', e.message);
    res.status(500).json({ error: 'Failed to export state', details: e.message });
  }
});

// AUTH
app.post(['/auth/login','/api/auth/login'], (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email & password requis' });
  const member = state.members.find(m => m.email === email);
  if (!member) return res.status(401).json({ error: 'Identifiants invalides' });
  
  // Find user's role from site_users via linkedMemberId
  let role = 'MEMBER'; // default
  if (state.siteUsers && member.id) {
    const siteUser = state.siteUsers.find(u => u.linkedMemberId === member.id);
    if (siteUser) {
      role = siteUser.role || 'MEMBER';
    }
  }
  
  const token = 'stub.' + Buffer.from(email).toString('base64');
  res.json({ token, user: { id: member.id, email: member.email, firstName: member.firstName, role: role, permissions: member.permissions || [] } });
});

// Member login endpoint - accepts identifier (email or username) and password
app.post(['/auth/member-login','/api/auth/member-login'], (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: 'identifier & password requis' });
  
  // Try to find member by matricule, email (exact or partial), or firstname+lastname
  let member = state.members.find(m => {
    const id = identifier.toLowerCase();
    const matricule = m.matricule?.toLowerCase() || '';
    const email = m.email?.toLowerCase() || '';
    const fullName = `${m.firstName || ''}${m.lastName || ''}`.toLowerCase();
    
    // Exact matricule match (primary - this is the login field)
    if (matricule === id) return true;
    // Exact email match
    if (email === id) return true;
    // Partial email match: identifier matches beginning of email (w.belaidi matches w.belaidi@...)
    if (email.startsWith(id)) return true;
    // Or if identifier includes @, try exact email
    if (id.includes('@') && email === id) return true;
    // Or full name match
    if (fullName.includes(id)) return true;
    
    return false;
  });
  
  // If not found, return error
  if (!member) return res.status(401).json({ error: 'Identifiants invalides' });
  
  // Get role from member.role first, fall back to site_users if needed
  let role = member.role || 'MEMBER';
  
  const email = member.email || '';
  const token = 'stub.' + Buffer.from(email).toString('base64');
  res.json({ token, user: { id: member.id, email: member.email, firstName: member.firstName, lastName: member.lastName, role: role, permissions: member.permissions || [] } });
});

app.get(['/auth/me','/api/auth/me'], requireAuth, (req, res) => {
  const member = state.members.find(m => m.email === req.user.email) || null;
  if (!member) {
    return res.json({ user: null });
  }
  
  // Get role from member.role first, fall back to site_users if needed
  let role = member.role || 'MEMBER';
  
  res.json({ user: { id: member.id, email: member.email, role: role, permissions: member.permissions || [] } });
});

// Session validation - /api/me endpoint
app.get('/api/me', requireAuth, (req, res) => {
  const member = state.members.find(m => m.email === req.user.email) || null;
  if (!member) {
    return res.json({ user: null });
  }

  // Get role from member.role first, fall back to site_users if needed
  let role = member.role || 'MEMBER';

  res.json({ 
    user: { 
      id: member.id, 
      email: member.email, 
      firstName: member.firstName,
      lastName: member.lastName,
      role: role,  // ADD ROLE HERE
      permissions: member.permissions || [],
      status: member.status || 'active'
    }
  });
});

// PUBLIC ENDPOINTS (no authentication required)
app.get('/health', async (req, res) => {
  try {
    // Test Prisma connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'OK',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('❌ Health check failed:', e.message);
    res.status(503).json({ 
      status: 'ERROR',
      database: 'disconnected',
      error: e.message
    });
  }
});

app.get('/site-config', (req, res) => {
  res.json({
    siteName: 'RétroBus Essonne',
    siteURL: 'https://association-rbe.fr',
    apiURL: 'https://attractive-kindness-rbe-serveurs.up.railway.app',
    logo: '/assets/logo.png',
    description: 'Association RétroBus Essonne - Patrimoine automobile et mobilité douce'
  });
});

// Public events endpoint
app.get('/public/events', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { date: 'desc' }
    });
    res.json(events);
  } catch (e) {
    console.error('❌ GET /public/events error:', e.message);
    res.status(500).json({ error: 'Failed to fetch events', details: e.message });
  }
});

app.get('/public/events/:id', async (req, res) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, status: 'PUBLISHED' }
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (e) {
    console.error('❌ GET /public/events/:id error:', e.message);
    res.status(500).json({ error: 'Failed to fetch event', details: e.message });
  }
});

// Public vehicles endpoint - avec fallback en mémoire
// Normalize vehicle data by extracting caracteristiques from JSON
const normalizeVehicleWithCaracteristiques = (vehicle) => {
  if (!vehicle) return vehicle;
  
  const normalized = { ...vehicle };
  
  // Parse caracteristiques JSON if it exists
  if (vehicle.caracteristiques && typeof vehicle.caracteristiques === 'string') {
    try {
      const caract = JSON.parse(vehicle.caracteristiques);
      if (Array.isArray(caract)) {
        // Create a direct map for frontend compatibility
        const caracMap = {};
        
        // Create mappings for various key formats
        caract.forEach(item => {
          if (item.label && item.value) {
            // Keep original label as key for direct access
            caracMap[item.label] = item.value;
            
            // Also create normalized key for programmatic access
            const key = item.label
              .toLowerCase()
              .replace(/é/g, 'e')
              .replace(/è/g, 'e')
              .replace(/ç/g, 'c')
              .replace(/\s+/g, '_')
              .replace(/[^a-z0-9_]/g, '');
            caracMap[key] = item.value;
            
            // Add to normalized object for direct access
            normalized[key] = item.value;
          }
        });
        
        // Keep as both object and array for compatibility
        normalized.caracteristiques = caract;
        normalized.caracteristiquesMap = caracMap;
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse caracteristiques for vehicle', vehicle.parc);
    }
  }
  
  return normalized;
};

app.get('/public/vehicles', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany();
    const normalized = vehicles.map(v => normalizeVehicleWithCaracteristiques(v));
    res.json(normalized);
  } catch (e) {
    console.error('❌ GET /public/vehicles error:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicles', details: e.message });
  }
});

app.get('/public/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { OR: [{ id: parseInt(req.params.id) || 0 }, { parc: req.params.id }] }
    });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    const normalized = normalizeVehicleWithCaracteristiques(vehicle);
    res.json(normalized);
  } catch (e) {
    console.error('❌ GET /public/vehicles/:id error:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle', details: e.message });
  }
});

app.get('/public/vehicles/:id/events', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: {
        vehicleId: req.params.id,
        status: 'PUBLISHED'
      },
      orderBy: { date: 'desc' }
    });
    res.json(events);
  } catch (e) {
    console.error('❌ GET /public/vehicles/:id/events error:', e.message);
    res.json([]);
  }
});

// ⛔ ENDPOINT DÉPLACÉ - Voir ligne ~1443 pour version avec fallback mémoire
// app.get(['/events','/api/events'], requireAuth, async (req, res) => {
//   try {
//     const events = await prisma.event.findMany({
//       orderBy: { createdAt: 'desc' }
//     });
//     res.json({ events });
//   } catch (e) {
//     console.error('Erreur GET /events (Prisma):', e.message);
//     res.json({ events: [] });
//   }
// });

// ⛔ ENDPOINT DÉPLACÉ - Voir ligne ~1446 pour version avec fallback mémoire
// app.get(['/events/:id','/api/events/:id'], requireAuth, async (req, res) => {
//   try {
//     const event = await prisma.event.findUnique({
//       where: { id: req.params.id }
//     });
//     if (!event) return res.status(404).json({ error: 'Event not found' });
//     res.json({ event });
//   } catch (e) {
//     console.error('Erreur GET /events/:id (Prisma):', e.message);
//     res.status(500).json({ error: 'Database error' });
//   }
// });
// ⛔ FIN ENDPOINT DÉPLACÉ

// FLASHES - PRISMA avec fallback
app.get(['/flashes','/api/flashes'], async (req, res) => {
  try {
    const flashes = await prisma.flash.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(flashes);
  } catch (e) {
    console.error('Erreur GET /flashes (Prisma):', e.message);
    res.json([]);
  }
});

app.get(['/flashes/all','/api/flashes/all'], async (req, res) => {
  try {
    const flashes = await prisma.flash.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(flashes);
  } catch (e) {
    console.error('Erreur GET /flashes/all (Prisma):', e.message);
    res.json([]);
  }
});

app.post(['/flashes','/api/flashes'], requireAuth, async (req, res) => {
  try {
    const { title, message, active = false } = req.body || {};
    const flash = await prisma.flash.create({
      data: { title, message, active: !!active }
    });
    console.log('✅ Flash créé:', flash.id);
    res.status(201).json(flash);
  } catch (e) {
    console.error('Erreur POST /flashes (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put(['/flashes/:id','/api/flashes/:id'], requireAuth, async (req, res) => {
  try {
    const flash = await prisma.flash.update({
      where: { id: req.params.id },
      data: req.body
    });
    console.log('✅ Flash modifié:', flash.id);
    res.json(flash);
  } catch (e) {
    console.error('Erreur PUT /flashes/:id (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete(['/flashes/:id','/api/flashes/:id'], requireAuth, async (req, res) => {
  try {
    await prisma.flash.delete({
      where: { id: req.params.id }
    });
    console.log('✅ Flash supprimé:', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('Erreur DELETE /flashes/:id (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// RETRO NEWS - PRISMA avec fallback
// ⛔ ENDPOINT DÉPLACÉ avec fallback mémoire (voir ligne ~1410)
// app.get(['/api/retro-news','/retro-news'], async (req, res) => {
//   try {
//     const news = await prisma.retroNews.findMany({
//       orderBy: { createdAt: 'desc' }
//     });
//     res.json({ news });
//   } catch (e) {
//     console.error('Erreur GET /retro-news (Prisma):', e.message);
//     res.json({ news: state.retroNews || [] });
//   }
// });

// ⛔ ENDPOINT DÉPLACÉ avec fallback mémoire
// app.post(['/api/retro-news','/retro-news'], requireAuth, async (req, res) => {
//   try {
//     const news = await prisma.retroNews.create({
//       data: {
//         title: req.body?.title || 'News',
//         body: req.body?.body || '',
//         status: 'published',
//         publishedAt: new Date()
//       }
//     });
//     console.log('✅ RetroNews créé:', news.id);
//     res.status(201).json({ news });
//   } catch (e) {
//     console.error('Erreur POST /retro-news (Prisma):', e.message);
//     // Fallback: créer en mémoire
//     const item = { id: 'rn' + Date.now(), title: req.body?.title || 'News', body: req.body?.body || '', publishedAt: new Date().toISOString() };
//     state.retroNews.unshift(item);
//     res.status(201).json({ news: item });
//   }
// });
// ⛔ FIN ENDPOINT DÉPLACÉ

// NOTIFICATIONS
app.get(['/api/notifications/inbox','/notifications/inbox'], requireAuth, (req, res) => {
  const limit = Number(req.query.limit || 20);
  res.json({ notifications: state.notifications.slice(0, limit) });
});
app.get(['/api/notifications/preferences','/notifications/preferences'], requireAuth, (req, res) => {
  res.json({ preferences: { email: true, sms: false, push: true } });
});
app.post(['/api/notifications/inbox','/notifications/inbox'], requireAuth, (req, res) => {
  const n = { id: 'n' + Date.now(), type: req.body?.type || 'info', message: req.body?.message || '', createdAt: new Date().toISOString(), read: false };
  state.notifications.unshift(n);
  debouncedSave();
  res.status(201).json({ notification: n });
});
app.post(['/api/notifications/:id/read','/notifications/:id/read'], requireAuth, (req, res) => {
  state.notifications = state.notifications.map(n => n.id === req.params.id ? { ...n, read: true } : n);
  const n = state.notifications.find(n => n.id === req.params.id);
  debouncedSave();
  res.json({ notification: n });
});

// ===== RETROMAIL (stub endpoints) =====
app.get(['/retromail/list'], requireAuth, (req, res) => {
  // Retourne une liste vide de fiches retromail
  res.json([]);
});

app.get(['/retromail/:filename'], requireAuth, (req, res) => {
  // Retourne une fiche retromail vide
  res.json({
    id: req.params.filename,
    parc: 'N/A',
    description: 'Fiche non trouvée',
    createdAt: new Date().toISOString()
  });
});

app.get(['/retromail/:filename.pdf'], requireAuth, (req, res) => {
  // Retourne un PDF vide
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4\n', 'utf8'));
});

// VEHICLES - PRISMA avec fallback// ⛔ ENDPOINT DÉPLACÉ avec fallback mémoire (voir ligne ~1390)
// app.get(['/vehicles','/api/vehicles'], requireAuth, async (req, res) => {
//   try {
//     const vehicles = await prisma.vehicle.findMany();
//     res.json({ vehicles });
//   } catch (e) {
//     console.error('Erreur GET /vehicles (Prisma):', e.message);
//     res.json({ vehicles: [] });
//   }
// });

// ⛔ ENDPOINT DÉPLACÉ avec fallback mémoire
// app.get(['/vehicles/:parc','/api/vehicles/:parc'], requireAuth, async (req, res) => {
//   try {
//     const vehicle = await prisma.vehicle.findUnique({
//       where: { parc: req.params.parc }
//     });
//     if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
//     res.json({ vehicle });
//   } catch (e) {
//     console.error('Erreur GET /vehicles/:parc (Prisma):', e.message);
//     res.status(500).json({ error: 'Database error' });
//   }
// });
// ⛔ FIN ENDPOINTS DÉPLACÉS

app.put(['/vehicles/:parc','/api/vehicles/:parc'], requireAuth, async (req, res) => {
  try {
    const prismaData = buildPrismaVehicleUpdateData(req.body || {});
    
    if (Object.keys(prismaData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const vehicle = await prisma.vehicle.update({
      where: { parc: req.params.parc },
      data: prismaData
    });
    
    console.log('✅ Vehicle updated via Prisma:', vehicle.parc);
    res.json({ vehicle, source: 'prisma' });
  } catch (e) {
    console.error('❌ PUT /vehicles/:parc error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.status(500).json({ error: 'Failed to update vehicle', details: e.message });
  }
});

// Usages (historique pointages) - PRISMA avec fallback
app.get(['/vehicles/:parc/usages','/api/vehicles/:parc/usages'], requireAuth, async (req, res) => {
  try {
    const usages = await prisma.Usage.findMany({
      where: { parc: req.params.parc },
      orderBy: { startedAt: 'desc' }
    });
    res.json(usages);
  } catch (e) {
    console.error('Erreur GET usages (Prisma):', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post(['/vehicles/:parc/usages','/api/vehicles/:parc/usages'], requireAuth, async (req, res) => {
  try {
    const usage = await prisma.Usage.create({
      data: {
        parc: req.params.parc,
        startedAt: new Date(),
        conducteur: req.body?.conducteur || 'Conducteur',
        note: req.body?.note || ''
      }
    });
    console.log('✅ Usage créé:', usage.id);
    res.status(201).json(usage);
  } catch (e) {
    console.error('Erreur POST usages (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post(['/vehicles/:parc/usages/:id/end','/api/vehicles/:parc/usages/:id/end'], requireAuth, async (req, res) => {
  try {
    const usage = await prisma.Usage.update({
      where: { id: parseInt(req.params.id) },
      data: { endedAt: new Date() }
    });
    res.json(usage);
  } catch (e) {
    console.error('Erreur end usage (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Maintenance - PRISMA avec fallback
app.get(['/vehicles/:parc/maintenance','/api/vehicles/:parc/maintenance'], requireAuth, async (req, res) => {
  try {
    const maintenance = await prisma.vehicle_maintenance.findMany({
      where: { Vehicle: { parc: req.params.parc } },
      orderBy: { date: 'desc' }
    });
    res.json(maintenance);
  } catch (e) {
    console.error('Erreur GET maintenance (Prisma):', e.message);
    res.json([]);
  }
});

app.post(['/vehicles/:parc/maintenance','/api/vehicles/:parc/maintenance'], requireAuth, async (req, res) => {
  try {
    console.log('📝 POST /vehicles/:parc/maintenance - Body:', JSON.stringify(req.body, null, 2));
    
    // Get vehicle by parc code
    const vehicle = await prisma.vehicle.findUnique({ where: { parc: req.params.parc } });
    if (!vehicle) {
      console.error('❌ Vehicle not found for parc:', req.params.parc);
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    console.log('✅ Vehicle found:', vehicle.id, vehicle.parc);
    
    const item = await prisma.vehicle_maintenance.create({
      data: {
        id: Math.random().toString(36).substr(2, 9),
        vehicleId: vehicle.id,
        type: req.body?.type || 'other',
        description: req.body?.description || '',
        cost: req.body?.cost ? parseFloat(req.body.cost) : 0,
        status: req.body?.status || 'completed',
        date: req.body?.date ? new Date(req.body.date) : new Date(),
        updatedAt: new Date()
      }
    });
    console.log('✅ Maintenance créée:', item.id);
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Erreur POST maintenance (Prisma):', e.message);
    console.error('Stack:', e.stack);
    res.status(500).json({ error: 'Database error', details: e.message });
  }
});

// Service schedule - PRISMA avec fallback
app.get(['/vehicles/:parc/service-schedule','/api/vehicles/:parc/service-schedule'], requireAuth, async (req, res) => {
  try {
    // Get vehicle by parc code
    const vehicle = await prisma.vehicle.findUnique({ where: { parc: req.params.parc } });
    if (!vehicle) return res.json([]);
    
    const schedule = await prisma.vehicle_service_schedule.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { plannedDate: 'asc' }
    });
    res.json(schedule);
  } catch (e) {
    console.error('Erreur GET service-schedule (Prisma):', e.message);
    res.json([]);
  }
});

app.post(['/vehicles/:parc/service-schedule','/api/vehicles/:parc/service-schedule'], requireAuth, async (req, res) => {
  try {
    // Get vehicle by parc code
    const vehicle = await prisma.vehicle.findUnique({ where: { parc: req.params.parc } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    
    const item = await prisma.vehicle_service_schedule.create({
      data: {
        id: Math.random().toString(36).substr(2, 9),
        vehicleId: vehicle.id,
        serviceType: req.body?.serviceType || 'other',
        description: req.body?.description || '',
        frequency: req.body?.frequency || 'yearly',
        priority: req.body?.priority || 'medium',
        status: req.body?.status || 'pending',
        plannedDate: req.body?.plannedDate ? new Date(req.body.plannedDate) : new Date()
      }
    });
    console.log('✅ Service schedule créé:', item.id);
    res.status(201).json(item);
  } catch (e) {
    console.error('Erreur POST service-schedule (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Maintenance summary - PRISMA avec fallback
app.get(['/vehicles/:parc/maintenance-summary','/api/vehicles/:parc/maintenance-summary'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    // Get vehicle by parc code
    const vehicle = await prisma.vehicle.findUnique({ where: { parc } });
    if (!vehicle) return res.json({ totalCost: 0, maintenanceCount: 0, overdueTasks: 0, pendingTasks: 0 });
    
    const maintenance = await prisma.vehicle_maintenance.findMany({ where: { vehicleId: vehicle.id } });
    const schedule = await prisma.vehicle_service_schedule.findMany({ where: { vehicleId: vehicle.id } });
    
    const totalCost = maintenance.reduce((s, m) => s + (m.cost || 0), 0);
    const maintenanceCount = maintenance.length;
    const overdueTasks = schedule.filter(s => s.status === 'overdue').length;
    const pendingTasks = schedule.filter(s => s.status === 'pending').length;
    
    res.json({ totalCost, maintenanceCount, overdueTasks, pendingTasks });
  } catch (e) {
    console.error('Erreur maintenance-summary (Prisma):', e.message);
    res.json({ totalCost: 0, maintenanceCount: 0, overdueTasks: 0, pendingTasks: 0 });
  }
});

// Gallery / background placeholders
app.get(['/vehicles/:parc/gallery','/api/vehicles/:parc/gallery'], requireAuth, (req, res) => {
  res.json([]);
});
app.get(['/vehicles/:parc/background','/api/vehicles/:parc/background'], requireAuth, (req, res) => {
  res.json({ background: null });
});
app.get(['/vehicles/:parc/reports','/api/vehicles/:parc/reports'], requireAuth, (req, res) => {
  res.json({ reports: [] });
});

// ============ ADMINISTRATION VÉHICULES ============

// CARTES GRISES
app.get(['/vehicles/:parc/cg','/api/vehicles/:parc/cg'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const cg = state.vehicleCarteGrise.find(c => c.parc === parc);
  res.json(cg || { parc, oldCGPath: null, newCGPath: null, oldCGBarred: false, dateImport: null, notes: '' });
});

app.post(['/vehicles/:parc/cg','/api/vehicles/:parc/cg'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const { type, documentPath, notes } = req.body; // type: 'old' | 'new'
  let cg = state.vehicleCarteGrise.find(c => c.parc === parc);
  
  if (!cg) {
    cg = { id: uid(), parc, oldCGPath: null, newCGPath: null, oldCGBarred: false, dateImport: new Date().toISOString(), notes: notes || '' };
    state.vehicleCarteGrise.push(cg);
  }
  
  if (type === 'old') {
    cg.oldCGPath = documentPath;
  } else if (type === 'new') {
    cg.newCGPath = documentPath;
    cg.dateImport = new Date().toISOString();
  }
  
  cg.notes = notes || cg.notes;
  debouncedSave();
  res.json(cg);
});

app.put(['/vehicles/:parc/cg/mark-old-barred','/api/vehicles/:parc/cg/mark-old-barred'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const cg = state.vehicleCarteGrise.find(c => c.parc === parc);
  if (!cg) return res.status(404).json({ error: 'CG not found' });
  cg.oldCGBarred = true;
  debouncedSave();
  res.json(cg);
});

// ASSURANCE
app.get(['/vehicles/:parc/assurance','/api/vehicles/:parc/assurance'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const assurance = state.vehicleAssurance.find(a => a.parc === parc);
  if (!assurance) return res.json({ parc, attestationPath: null, dateValidityStart: null, dateValidityEnd: null, timeValidityStart: null, timeValidityEnd: null, isActive: false, notes: '' });
  
  const now = new Date();
  const endDate = assurance.dateValidityEnd ? new Date(assurance.dateValidityEnd) : null;
  assurance.isActive = endDate ? endDate > now : false;
  
  res.json(assurance);
});

app.post(['/vehicles/:parc/assurance','/api/vehicles/:parc/assurance'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const { attestationPath, dateValidityStart, dateValidityEnd, timeValidityStart, timeValidityEnd, notes } = req.body;
  
  let assurance = state.vehicleAssurance.find(a => a.parc === parc);
  if (!assurance) {
    assurance = { id: uid(), parc, attestationPath: null, dateValidityStart: null, dateValidityEnd: null, timeValidityStart: null, timeValidityEnd: null, isActive: false, notes: '' };
    state.vehicleAssurance.push(assurance);
  }
  
  assurance.attestationPath = attestationPath || assurance.attestationPath;
  assurance.dateValidityStart = dateValidityStart || assurance.dateValidityStart;
  assurance.dateValidityEnd = dateValidityEnd || assurance.dateValidityEnd;
  assurance.timeValidityStart = timeValidityStart || assurance.timeValidityStart;
  assurance.timeValidityEnd = timeValidityEnd || assurance.timeValidityEnd;
  assurance.notes = notes !== undefined ? notes : assurance.notes;
  
  const now = new Date();
  const endDate = assurance.dateValidityEnd ? new Date(assurance.dateValidityEnd) : null;
  assurance.isActive = endDate ? endDate > now : false;
  
  debouncedSave();
  res.json(assurance);
});

// CONTRÔLE TECHNIQUE
app.get(['/vehicles/:parc/ct','/api/vehicles/:parc/ct'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    const cts = await prisma.vehicleControlTechnique.findMany({
      where: { parc },
      orderBy: { ctDate: 'desc' }
    });
    
    const latest = cts[0] || null;
    res.json({ parc, ctHistory: cts, latestCT: latest });
  } catch (e) {
    console.error('❌ Error fetching CT:', e.message);
    res.status(500).json({ error: 'Failed to fetch contrôle technique', details: e.message });
  }
});

app.post(['/vehicles/:parc/ct','/api/vehicles/:parc/ct'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    const { attestationPath, ctDate, ctStatus, nextCtDate, mileage, notes } = req.body;
    
    // Create in Prisma
    const ct = await prisma.vehicleControlTechnique.create({
      data: {
        id: uid(),
        parc,
        attestationPath: attestationPath || null,
        ctDate: ctDate ? new Date(ctDate) : new Date(),
        ctStatus: ctStatus || 'passed',
        nextCtDate: nextCtDate ? new Date(nextCtDate) : null,
        mileage: mileage ? parseInt(mileage) : null,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Also save to state for in-memory access
    state.vehicleControleTechnique.push({
      id: ct.id,
      parc: ct.parc,
      attestationPath: ct.attestationPath,
      ctDate: ct.ctDate.toISOString(),
      ctStatus: ct.ctStatus,
      nextCtDate: ct.nextCtDate?.toISOString() || null,
      mileage: ct.mileage,
      notes: ct.notes
    });
    
    debouncedSave();
    console.log('✅ Contrôle technique créé:', ct.id, parc);
    res.status(201).json(ct);
  } catch (e) {
    console.error('❌ Error creating CT:', e.message);
    res.status(500).json({ error: 'Failed to create contrôle technique', details: e.message });
  }
});

// CERTIFICAT DE CESSION (une seule fois)
app.get(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    const cert = await prisma.vehicleCessionCertificate.findUnique({
      where: { parc }
    });
    res.json(cert || { parc, certificatePath: null, dateImport: null, notes: '', imported: false });
  } catch (e) {
    console.error('Erreur lecture cession:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    
    // Vérifier si déjà importé
    const existing = await prisma.vehicleCessionCertificate.findUnique({
      where: { parc }
    });
    
    if (existing && existing.imported) {
      return res.status(400).json({ error: 'Certificate already imported for this vehicle' });
    }
    
    const { certificatePath, notes } = req.body;
    
    const cert = await prisma.vehicleCessionCertificate.upsert({
      where: { parc },
      update: {
        certificatePath,
        notes: notes || '',
        dateImport: new Date(),
        imported: true
      },
      create: {
        id: uid(),
        parc,
        certificatePath,
        notes: notes || '',
        dateImport: new Date(),
        imported: true
      }
    });
    
    res.json(cert);
  } catch (e) {
    console.error('Erreur sauvegarde cession:', e);
    res.status(500).json({ error: e.message });
  }
});

// ÉCHÉANCIER
app.get(['/vehicles/:parc/echancier','/api/vehicles/:parc/echancier'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const items = state.vehicleEchancier.filter(e => e.parc === parc).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  res.json(items);
});

app.get(['/api/echancier','/echancier'], requireAuth, (req, res) => {
  const allItems = state.vehicleEchancier.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  res.json({ echancier: allItems });
});

app.post(['/vehicles/:parc/echancier','/api/vehicles/:parc/echancier'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const { type, description, dueDate, notes } = req.body;
  
  const item = {
    id: uid(),
    parc,
    type: type || 'assurance', // 'assurance' | 'ct' | 'cg'
    description: description || '',
    dueDate,
    status: 'pending', // 'pending' | 'done' | 'expired'
    notes: notes || ''
  };
  
  state.vehicleEchancier.push(item);
  debouncedSave();
  res.status(201).json(item);
});

app.put(['/vehicles/:parc/echancier/:id','/api/vehicles/:parc/echancier/:id'], requireAuth, (req, res) => {
  const { parc, id } = req.params;
  const { status, notes } = req.body;
  
  const item = state.vehicleEchancier.find(e => e.id === id && e.parc === parc);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  
  if (status) item.status = status;
  if (notes !== undefined) item.notes = notes;
  
  debouncedSave();
  res.json(item);
});

app.delete(['/vehicles/:parc/echancier/:id','/api/vehicles/:parc/echancier/:id'], requireAuth, (req, res) => {
  const { parc, id } = req.params;
  const idx = state.vehicleEchancier.findIndex(e => e.id === id && e.parc === parc);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  
  const deleted = state.vehicleEchancier.splice(idx, 1)[0];
  debouncedSave();
  res.json(deleted);
});

// RETRO REQUESTS & NEWS (RetroAssistant, RétroDemandes)
app.get(['/api/retro-requests'], requireAuth, async (req, res) => {
  try {
    // Get member by email to get real ID
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    // Get user's retro requests from Prisma
    const requests = await prisma.retro_request.findMany({
      where: { userId: member.id },
      orderBy: { createdAt: 'desc' },
      include: {
        retro_request_file: true,
        retro_request_status_log: true
      }
    });
    res.json({ requests });
  } catch (e) {
    console.error('Erreur GET retro-requests:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get(['/api/retro-requests/admin/all'], requireAuth, async (req, res) => {
  try {
    // Check if user has ADMIN role - lookup by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    const isAdmin = member?.role === 'ADMIN';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Return all retro requests
    const requests = await prisma.retro_request.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        retro_request_file: true,
        retro_request_status_log: true
      }
    });
    res.json({ requests });
  } catch (e) {
    console.error('Erreur GET retro-requests/admin/all:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post(['/api/retro-requests'], requireAuth, async (req, res) => {
  try {
    const { title, description, category, priority, details } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    
    // Get user info by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    if (!member) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const request = await prisma.retro_request.create({
      data: {
        id: Math.random().toString(36).substr(2, 9),
        userId: member.id,
        userName: `${member.firstName} ${member.lastName}`,
        userEmail: member.email,
        title,
        description,
        category: category || 'GENERAL',
        priority: priority || 'NORMAL',
        status: 'PENDING',
        details: details || {},
        updatedAt: new Date()
      }
    });
    
    console.log('✅ RétroDemande créée:', request.id);
    res.status(201).json({ request });
  } catch (e) {
    console.error('Erreur POST retro-requests:', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put(['/api/retro-requests/:id'], requireAuth, async (req, res) => {
  try {
    const { title, description, category, priority, status, notes } = req.body;
    
    // Check if request exists and user owns it
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Only allow user to edit their own requests or admins to edit all - lookup by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    const isAdmin = member?.role === 'ADMIN';
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const updated = await prisma.retro_request.update({
      where: { id: req.params.id },
      data: {
        title: title || request.title,
        description: description || request.description,
        category: category || request.category,
        priority: priority || request.priority,
        status: status || request.status,
        notes: notes || request.notes,
        updatedAt: new Date()
      }
    });
    
    res.json({ request: updated });
  } catch (e) {
    console.error('Erreur PUT retro-requests:', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete(['/api/retro-requests/:id'], requireAuth, async (req, res) => {
  try {
    // Check if request exists and user owns it
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Only allow user to delete their own requests or admins to delete all - lookup by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    const isAdmin = member?.role === 'ADMIN';
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await prisma.retro_request.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('Erreur DELETE retro-requests:', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post(['/api/retro-requests/:id/status'], requireAuth, async (req, res) => {
  try {
    // Get member by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Find the request
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check authorization - ONLY ADMIN can change status
    const isAdmin = member.role === 'ADMIN';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can change request status' });
    }

    // Update status
    const updatedRequest = await prisma.retro_request.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        updatedAt: new Date()
      }
    });

    res.json({ ok: true, request: updatedRequest });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Upload file to retro request
app.post(['/api/retro-requests/:id/upload'], requireAuth, multer({ storage: multer.memoryStorage() }).single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Check if request exists
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get member by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Only owner or admin can upload
    const isAdmin = member?.role === 'ADMIN';
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Save file to disk
    const uploadsDir = pathRoot + '/uploads/retro-requests';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = uploadsDir + '/' + fileName;
    fs.writeFileSync(filePath, req.file.buffer);

    // Save file record to database
    const fileRecord = await prisma.retro_request_file.create({
      data: {
        id: Math.random().toString(36).substr(2, 9),
        requestId: req.params.id,
        fileName: req.file.originalname,
        filePath: filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: member.id
      }
    });

    console.log('✅ File uploaded:', fileRecord.id, req.file.originalname);
    res.status(201).json({ file: fileRecord });
  } catch (e) {
    console.error('Erreur POST retro-requests/:id/upload:', e.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Delete file from retro request
app.delete(['/api/retro-requests/:id/files/:fileId'], requireAuth, async (req, res) => {
  try {
    // Get file record
    const fileRecord = await prisma.retro_request_file.findUnique({ where: { id: req.params.fileId } });
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check request exists
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get member by email
    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Only owner or admin can delete
    const isAdmin = member?.role === 'ADMIN';
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete file from disk
    if (fs.existsSync(fileRecord.filePath)) {
      fs.unlinkSync(fileRecord.filePath);
    }

    // Delete file record
    await prisma.retro_request_file.delete({ where: { id: req.params.fileId } });

    console.log('✅ File deleted:', req.params.fileId);
    res.json({ ok: true });
  } catch (e) {
    console.error('Erreur DELETE retro-requests/:id/files/:fileId:', e.message);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Lier un devis à une demande
app.post(['/api/retro-requests/:id/link-devis'], requireAuth, async (req, res) => {
  try {
    const { devisId } = req.body;
    if (!devisId) {
      return res.status(400).json({ error: 'devisId is required' });
    }

    // Get request and verify ownership/admin
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    const isAdmin = member?.role === 'ADMIN';
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update request with devis link
    const updated = await prisma.retro_request.update({
      where: { id: req.params.id },
      data: {
        details: {
          ...request.details,
          linkedDevisId: devisId
        }
      }
    });

    console.log('✅ Devis lié à la demande:', devisId);
    res.json({ ok: true, request: updated });
  } catch (e) {
    console.error('Erreur POST retro-requests/:id/link-devis:', e.message);
    res.status(500).json({ error: 'Link failed' });
  }
});

// Lier une facture à une demande
app.post(['/api/retro-requests/:id/link-facture'], requireAuth, async (req, res) => {
  try {
    const { factureId } = req.body;
    if (!factureId) {
      return res.status(400).json({ error: 'factureId is required' });
    }

    // Get request and verify ownership/admin
    const request = await prisma.retro_request.findUnique({ where: { id: req.params.id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const member = await prisma.members.findUnique({ where: { email: req.user.email } });
    const isAdmin = member?.role === 'ADMIN';
    if (request.userId !== member.id && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update request with facture link
    const updated = await prisma.retro_request.update({
      where: { id: req.params.id },
      data: {
        details: {
          ...request.details,
          linkedFactureId: factureId
        }
      }
    });

    console.log('✅ Facture liée à la demande:', factureId);
    res.json({ ok: true, request: updated });
  } catch (e) {
    console.error('Erreur POST retro-requests/:id/link-facture:', e.message);
    res.status(500).json({ error: 'Link failed' });
  }
});

// RETRO NEWS (content management)
app.get(['/api/retro-news'], requireAuth, (req, res) => {
  res.json(state.retroNews || []);
});

app.post(['/api/retro-news'], requireAuth, (req, res) => {
  const news = {
    id: uid(),
    title: req.body.title,
    body: req.body.body,
    status: req.body.status || 'published',
    publishedAt: new Date().toISOString(),
    author: req.body.author || req.user?.id || 'anonyme'
  };
  state.retroNews.push(news);
  debouncedSave();
  res.status(201).json(news);
});

app.put(['/api/retro-news/:id'], requireAuth, (req, res) => {
  const idx = state.retroNews.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'News not found' });
  
  state.retroNews[idx] = {
    ...state.retroNews[idx],
    title: req.body.title || state.retroNews[idx].title,
    body: req.body.body || state.retroNews[idx].body,
    status: req.body.status || state.retroNews[idx].status,
    updatedAt: new Date().toISOString()
  };
  debouncedSave();
  res.json(state.retroNews[idx]);
});

app.delete(['/api/retro-news/:id'], requireAuth, (req, res) => {
  state.retroNews = state.retroNews.filter(r => r.id !== req.params.id);
  debouncedSave();
  res.json({ ok: true });
});

// MEMBERS
app.get(['/api/members','/members'], requireAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || undefined;
    const members = await prisma.members.findMany({ take: limit });
    return res.json({ members });
  } catch (e) {
    console.error('❌ Error fetching members:', e.message);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});
app.get(['/api/members/me'], requireAuth, (req, res) => {
  // stub current member from token
  const m = state.members.find(mem => mem.email === req.user.email) || null;
  return res.json({ member: m });
});
app.post(['/api/members','/members'], requireAuth, async (req, res) => {
  try {
    const member = await prisma.members.create({
      data: {
        id: uid(),
        ...req.body,
        status: req.body.status || 'active',
        firstName: req.body.firstName || '',
        lastName: req.body.lastName || '',
        email: req.body.email,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    state.members.push(member);
    debouncedSave();
    res.status(201).json({ member });
  } catch (e) {
    console.error('❌ Error creating member:', e.message);
    res.status(500).json({ error: 'Failed to create member', details: e.message });
  }
});
app.put(['/api/members','/members'], requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    const member = await prisma.members.update({
      where: { id },
      data: { ...req.body, updatedAt: new Date() }
    });
    const stateIdx = state.members.findIndex(m => m.id === id);
    if (stateIdx !== -1) state.members[stateIdx] = member;
    debouncedSave();
    console.log(`✅ Adhérent ${id} modifié et sauvegardé`);
    res.json({ member });
  } catch (e) {
    console.error('❌ Error updating member:', e.message);
    res.status(500).json({ error: 'Failed to update member', details: e.message });
  }
});
app.patch(['/api/members','/members'], requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    const member = await prisma.members.update({
      where: { id },
      data: { ...req.body, updatedAt: new Date() }
    });
    const stateIdx = state.members.findIndex(m => m.id === id);
    if (stateIdx !== -1) state.members[stateIdx] = member;
    debouncedSave();
    console.log(`✅ Adhérent ${id} patchié et sauvegardé`);
    res.json({ member });
  } catch (e) {
    console.error('❌ Error patching member:', e.message);
    res.status(500).json({ error: 'Failed to patch member', details: e.message });
  }
});
app.delete(['/api/members','/members'], requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    
    // Delete from Prisma (single source of truth)
    const deleted = await prisma.members.delete({
      where: { id }
    });
    
    // Also remove from state.members
    state.members = state.members.filter(m => m.id !== id);
    debouncedSave();
    
    console.log(`✅ Adhérent ${id} supprimé de Prisma et mémoire`);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Error deleting member:', e.message);
    res.status(500).json({ error: 'Failed to delete member', details: e.message });
  }
});
app.post('/api/members/change-password', requireAuth, (req, res) => {
  res.json({ ok: true });
});
app.post('/api/members/:id/terminate', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update in Prisma
    const updated = await prisma.members.update({
      where: { id },
      data: { status: 'terminated', updatedAt: new Date() }
    });
    
    // Also update in state.members
    const member = state.members.find(m => m.id === id);
    if (member) {
      member.status = 'terminated';
      member.updatedAt = new Date().toISOString();
    }
    
    debouncedSave();
    console.log(`✅ Adhérent ${id} terminé dans Prisma et mémoire`);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Error terminating member:', e.message);
    res.status(500).json({ error: 'Failed to terminate member', details: e.message });
  }
});
app.post('/api/members/:id/link-access', requireAuth, (req, res) => {
  const { id } = req.params;
  const { email, membershipType = 'STANDARD', permissions = [] } = req.body || {};
  
  // Find or create user permissions for this member
  if (!state.userPermissions) state.userPermissions = {};
  
  state.userPermissions[id] = {
    id,
    email: email || state.members.find(m => m.id === id)?.email,
    membershipType,
    permissions: Array.isArray(permissions) ? permissions : [],
    linkedAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
  
  debouncedSave();
  res.json({ 
    ok: true, 
    message: 'Accès lié avec succès',
    userPermissions: state.userPermissions[id]
  });
});

// GET member permissions
// MEMBERS endpoints
app.get('/api/members/:id', requireAuth, async (req, res) => {
  try {
    const member = await prisma.members.findUnique({
      where: { id: req.params.id }
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (e) {
    console.error('❌ Error fetching member:', e.message);
    res.status(500).json({ error: 'Failed to fetch member', details: e.message });
  }
});

// PUT /api/members/:id - Update member
app.put(['/api/members/:id', '/members/:id'], requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update in Prisma
    const updatedMember = await prisma.members.update({
      where: { id },
      data: { ...req.body, updatedAt: new Date() }
    });
    
    // Also update in state
    const stateIdx = state.members.findIndex(m => m.id === id);
    if (stateIdx !== -1) state.members[stateIdx] = updatedMember;
    
    debouncedSave();
    console.log(`✅ Adhérent ${id} mis à jour et sauvegardé`);
    res.json({ success: true, member: updatedMember });
  } catch (e) {
    console.error('❌ Error updating member:', e.message);
    res.status(500).json({ error: 'Failed to update member', details: e.message });
  }
});

app.get('/api/members/:id/permissions', requireAuth, (req, res) => {
  const { id } = req.params;
  const member = state.members.find(m => m.id === id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  
  const userPerms = state.userPermissions?.[id] || {
    id,
    email: member.email,
    membershipType: member.membershipType || 'STANDARD',
    permissions: member.permissions || [],
    linkedAt: member.createdAt,
    lastModified: new Date().toISOString()
  };
  
  res.json(userPerms);
});

// PUT update member permissions
// ✅ NOW USING PRISMA
app.put('/api/members/:id/permissions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions = [], membershipType } = req.body || {};
    
    // Update member permissions in Prisma
    const member = await prisma.members.update({
      where: { id },
      data: {
        permissions: Array.isArray(permissions) ? permissions : [],
        membershipType: membershipType || undefined
      }
    });
    
    res.json({ 
      ok: true, 
      message: 'Permissions mises à jour',
      member
    });
  } catch (e) {
    console.error('❌ Error updating member permissions:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST add permission to member
// ✅ NOW USING PRISMA
app.post('/api/members/:id/permissions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { permission } = req.body || {};
    
    if (!permission) return res.status(400).json({ error: 'Permission required' });
    
    // Get current permissions
    const member = await prisma.members.findUnique({
      where: { id },
      select: { permissions: true }
    });
    
    if (!member) return res.status(404).json({ error: 'Member not found' });
    
    const currentPerms = member.permissions || [];
    const newPerms = Array.isArray(currentPerms) ? [...currentPerms] : [];
    
    // Add new permission if not already exists
    if (!newPerms.includes(permission)) {
      newPerms.push(permission);
    }
    
    // Update member
    const updated = await prisma.members.update({
      where: { id },
      data: { permissions: newPerms }
    });
    
    res.json({ 
      ok: true, 
      message: 'Permission ajoutée',
      member: updated
    });
  } catch (e) {
    console.error('❌ Error adding permission:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE permission from member
// ✅ NOW USING PRISMA
app.delete('/api/members/:id/permissions/:permission', requireAuth, async (req, res) => {
  try {
    const { id, permission } = req.params;
    
    // Get current permissions
    const member = await prisma.members.findUnique({
      where: { id },
      select: { permissions: true }
    });
    
    if (!member) return res.status(404).json({ error: 'Member not found' });
    
    const currentPerms = member.permissions || [];
    const newPerms = currentPerms.filter(p => p !== permission);
    
    // Update member
    const updated = await prisma.members.update({
      where: { id },
      data: { permissions: newPerms }
    });
    
    res.json({ 
      ok: true, 
      message: 'Permission supprimée',
      member: updated
    });
  } catch (e) {
    console.error('❌ Error deleting permission:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PERMISSIONS ENDPOINT - Lookup user role and permissions by memberId or userId
// ✅ NOW USING PRISMA - Get permissions from members.permissions + user_permissions table
app.get('/api/user-permissions/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`🔍 GET /api/user-permissions/:userId - ${userId}`);
    
    // Try to find member first (userId might be memberId)
    const member = await prisma.members.findFirst({
      where: {
        OR: [
          { id: userId },
          { email: userId }
        ]
      }
    });
    
    if (!member) {
      console.log(`   ❌ Member not found for userId: ${userId}`);
      return res.json({ permissions: [], role: 'MEMBER' });
    }
    
    // Get permissions from member object
    const memberPermissions = member.permissions || [];
    console.log(`   ✅ Found member: ${member.email}, permissions: ${memberPermissions.length}`);
    
    // Try to find site_user to get role
    const siteUser = await prisma.site_users.findFirst({
      where: { linkedMemberId: member.id }
    });
    
    const role = siteUser?.role || 'MEMBER';
    
    res.json({ 
      permissions: memberPermissions, 
      role, 
      memberId: member.id,
      email: member.email
    });
  } catch (e) {
    console.error('❌ Error in /api/user-permissions:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET all user permissions (admin endpoint)
app.get('/api/user-permissions', requireAuth, async (req, res) => {
  try {
    const allMembers = await prisma.members.findMany({
      select: { id: true, email: true, firstName: true, lastName: true, permissions: true }
    });
    
    res.json(allMembers);
  } catch (e) {
    console.error('❌ Error fetching all user permissions:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DOCUMENTS
app.get('/api/documents/member/:memberId', requireAuth, async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: { memberId: req.params.memberId }
    });
    res.json({ documents });
  } catch (e) {
    console.error('❌ Error fetching documents:', e.message);
    res.status(500).json({ error: e.message });
  }
});
app.delete('/api/documents/:id', requireAuth, (req, res) => {
  state.documents = state.documents.filter(d => d.id !== req.params.id);
  debouncedSave();
  res.json({ ok: true });
});
app.put('/api/documents/:id/status', requireAuth, (req, res) => {
  const { id } = req.params; const { status } = req.body;
  state.documents = state.documents.map(d => d.id === id ? { ...d, status } : d);
  const doc = state.documents.find(d => d.id === id);
  debouncedSave();
  res.json({ document: doc });
});
app.get('/api/documents/expiring', requireAuth, (req, res) => {
  const days = Number(req.query.days || 60);
  const now = Date.now();
  const soon = state.documents.filter(d => d.expiresAt && (new Date(d.expiresAt).getTime() - now) < days*86400000);
  res.json({ documents: soon });
});
app.get('/api/documents/:id/download', requireAuth, (req, res) => {
  res.status(404).json({ error: 'Not implemented file storage' });
});

// EVENTS - PRISMA avec fallback optionnel
app.get(['/events', '/api/events'], requireAuth, async (req, res) => {
  try {
    const events = await prisma.event.findMany({ orderBy: { date: 'desc' } });
    res.json({ events });
  } catch (e) {
    console.error('❌ GET /events error:', e.message);
    res.status(500).json({ error: 'Failed to fetch events', details: e.message });
  }
});

app.get(['/events/:id', '/api/events/:id'], requireAuth, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: normalizeEventExtras(event) });
  } catch (e) {
    console.error('❌ GET /events/:id error:', e.message);
    res.status(500).json({ error: 'Failed to fetch event', details: e.message });
  }
});

// VEHICLES - PRISMA avec fallback optionnel
app.get(['/vehicles', '/api/vehicles'], requireAuth, async (req, res) => {
  if (prisma) {
    try {
      const vehicles = await prisma.vehicle.findMany({ orderBy: { parc: 'asc' } });
      const normalized = vehicles.map(v => normalizeVehicleWithCaracteristiques(v));
      return res.json({ vehicles: normalized });
    } catch (e) {
      console.error('❌ GET /vehicles error:', e.message);
      return res.status(500).json({ error: 'Failed to fetch vehicles', details: e.message });
    }
  }
  res.status(503).json({ error: 'Prisma unavailable' });
});

app.post(['/vehicles', '/api/vehicles'], requireAuth, async (req, res) => {
  try {
    const { parc, type, modele, marque, subtitle, immat, etat, miseEnCirculation, energie, description, history, caracteristiques, gallery, backgroundImage, backgroundPosition, isPublic, fuel, mileage } = req.body;
    
    if (!parc) {
      return res.status(400).json({ error: 'Parc number is required' });
    }
    
    // Check if vehicle already exists
    const existing = await prisma.vehicle.findUnique({
      where: { parc }
    });
    
    if (existing) {
      return res.status(409).json({ error: 'Vehicle with this parc number already exists' });
    }
    
    // Create vehicle in Prisma
    const vehicle = await prisma.vehicle.create({
      data: {
        parc,
        type: type || 'Véhicule',
        modele: modele || '',
        marque: marque || null,
        subtitle: subtitle || null,
        immat: immat || null,
        etat: etat || 'actif',
        miseEnCirculation: miseEnCirculation ? new Date(miseEnCirculation) : null,
        energie: energie || null,
        description: description || null,
        history: history || null,
        caracteristiques: caracteristiques && Array.isArray(caracteristiques) ? JSON.stringify(caracteristiques) : (caracteristiques ? caracteristiques : null),
        gallery: gallery && Array.isArray(gallery) ? JSON.stringify(gallery) : (gallery ? gallery : null),
        backgroundImage: backgroundImage || null,
        backgroundPosition: backgroundPosition || null,
        isPublic: isPublic || false,
        fuel: fuel ? parseFloat(fuel) : null,
        mileage: mileage ? parseFloat(mileage) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Also add to state for in-memory access
    state.vehicles.push(vehicle);
    debouncedSave();
    
    const normalized = normalizeVehicleWithCaracteristiques(vehicle);
    console.log(`✅ Vehicle créé: ${parc}`);
    res.status(201).json({ vehicle: normalized });
  } catch (e) {
    console.error('❌ POST /vehicles error:', e.message);
    res.status(500).json({ error: 'Failed to create vehicle', details: e.message });
  }
});

app.get(['/vehicles/:parc', '/api/vehicles/:parc'], requireAuth, async (req, res) => {
  try {
    const idCandidate = Number(req.params.parc);
    const filters = [{ parc: req.params.parc }];
    if (!Number.isNaN(idCandidate)) {
      filters.push({ id: idCandidate });
    }
    const vehicle = await prisma.vehicle.findFirst({ where: { OR: filters } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    const normalized = normalizeVehicleWithCaracteristiques(vehicle);
    res.json({ vehicle: normalized });
  } catch (e) {
    console.error('❌ GET /vehicles/:parc error:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle', details: e.message });
  }
});

app.put(['/vehicles/:parc', '/api/vehicles/:parc'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    
    // Find vehicle by parc or id
    const idCandidate = Number(parc);
    const filters = [{ parc }];
    if (!Number.isNaN(idCandidate)) {
      filters.push({ id: idCandidate });
    }
    
    const existing = await prisma.vehicle.findFirst({ where: { OR: filters } });
    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    // Update vehicle in Prisma
    const updated = await prisma.vehicle.update({
      where: { id: existing.id },
      data: {
        ...req.body,
        miseEnCirculation: req.body.miseEnCirculation ? new Date(req.body.miseEnCirculation) : undefined,
        fuel: req.body.fuel ? parseFloat(req.body.fuel) : undefined,
        mileage: req.body.mileage ? parseFloat(req.body.mileage) : undefined,
        updatedAt: new Date()
      }
    });
    
    // Also update in state
    const stateIdx = state.vehicles.findIndex(v => v.id === existing.id);
    if (stateIdx !== -1) state.vehicles[stateIdx] = updated;
    debouncedSave();
    
    const normalized = normalizeVehicleWithCaracteristiques(updated);
    console.log(`✅ Vehicle ${parc} mis à jour`);
    res.json({ vehicle: normalized });
  } catch (e) {
    console.error('❌ PUT /vehicles/:parc error:', e.message);
    res.status(500).json({ error: 'Failed to update vehicle', details: e.message });
  }
});

app.delete(['/vehicles/:parc', '/api/vehicles/:parc'], requireAuth, async (req, res) => {
  try {
    const parc = req.params.parc;
    
    // Find vehicle by parc or id
    const idCandidate = Number(parc);
    const filters = [{ parc }];
    if (!Number.isNaN(idCandidate)) {
      filters.push({ id: idCandidate });
    }
    
    const existing = await prisma.vehicle.findFirst({ where: { OR: filters } });
    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    // Delete from Prisma
    await prisma.vehicle.delete({
      where: { id: existing.id }
    });
    
    // Also remove from state
    state.vehicles = state.vehicles.filter(v => v.id !== existing.id);
    debouncedSave();
    
    console.log(`✅ Vehicle ${parc} supprimé`);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /vehicles/:parc error:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicle', details: e.message });
  }
});

// EVENTS CRUD - PRISMA avec fallback
app.post(['/events', '/api/events'], requireAuth, async (req, res) => {
  try {
    const basePayload = {
      id: uid(),
      title: req.body.title || 'Nouvel événement',
      description: req.body.description,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      time: req.body.time || null,
      location: req.body.location || null,
      helloAssoUrl: req.body.helloAssoUrl || null,
      adultPrice: req.body.adultPrice ? parseFloat(req.body.adultPrice) : null,
      childPrice: req.body.childPrice ? parseFloat(req.body.childPrice) : null,
      status: req.body.status || 'DRAFT',
      updatedAt: new Date(),
      vehicleId: req.body.vehicleId || null
    };

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'extras')) {
      const extrasValue = normalizeExtrasValue(req.body.extras);
      if (extrasValue !== undefined) {
        basePayload.extras = extrasValue;
      }
    }

    const event = await prisma.event.create({ data: basePayload });
    console.log('✅ Event créé:', event.id, event.title);
    res.status(201).json({ event, source: 'prisma' });
  } catch (e) {
    console.error('❌ POST /events error:', e.message);
    res.status(500).json({ error: 'Failed to create event', details: e.message });
  }
});

app.put(['/events/:id', '/api/events/:id'], requireAuth, async (req, res) => {
  try {
    const prismaData = buildPrismaEventUpdateData(req.body || {});
    
    if (Object.keys(prismaData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: prismaData
    });
    console.log('✅ Event modifié:', event.id, event.title);
    res.json({ event, source: 'prisma' });
  } catch (e) {
    console.error('❌ PUT /events/:id error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(500).json({ error: 'Failed to update event', details: e.message });
  }
});

app.delete(['/events/:id', '/api/events/:id'], requireAuth, async (req, res) => {
  try {
    await prisma.event.delete({
      where: { id: req.params.id }
    });
    console.log('✅ Event supprimé:', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ DELETE /events/:id error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(500).json({ error: 'Failed to delete event', details: e.message });
  }
});

// FINANCE
app.get(['/finance/stats', '/api/finance/stats'], requireAuth, (req, res) => {
  const revenue = state.transactions.filter(t => t.type === 'recette').reduce((s,t)=>s+t.amount,0);
  const expenses = state.transactions.filter(t => t.type === 'depense').reduce((s,t)=>s+t.amount,0);
  res.json({ data: { monthlyRevenue: revenue, monthlyExpenses: expenses, currentBalance: state.bankBalance, membershipRevenue: 0, activeMembers: state.members.length, revenueGrowth: 0 } });
});
app.get(['/finance/bank-balance', '/api/finance/bank-balance'], requireAuth, (req, res) => {
  res.json({ data: { balance: state.bankBalance } });
});
app.post(['/finance/bank-balance', '/api/finance/bank-balance'], requireAuth, (req, res) => {
  state.bankBalance = Number(req.body.balance || 0);
  debouncedSave();
  res.json({ data: { balance: state.bankBalance } });
});

// Scheduled expenses
app.get(['/finance/scheduled-expenses', '/api/finance/scheduled-expenses'], requireAuth, (req, res) => {
  const { eventId } = req.query;
  let list = state.scheduled;
  if (eventId) list = list.filter(x => x.eventId === eventId);
  res.json({ operations: list });
});
app.post(['/finance/scheduled-expenses', '/api/finance/scheduled-expenses'], requireAuth, (req, res) => {
  const op = { id: uid(), ...req.body };
  state.scheduled.push(op);
  debouncedSave();
  res.status(201).json(op);
});
app.put(['/finance/scheduled-expenses/:id', '/api/finance/scheduled-expenses/:id'], requireAuth, (req, res) => {
  state.scheduled = state.scheduled.map(o => o.id === req.params.id ? { ...o, ...req.body } : o);
  const op = state.scheduled.find(o => o.id === req.params.id);
  debouncedSave();
  res.json(op);
});
app.delete(['/finance/scheduled-expenses/:id', '/api/finance/scheduled-expenses/:id'], requireAuth, (req, res) => {
  state.scheduled = state.scheduled.filter(o => o.id !== req.params.id);
  debouncedSave();
  res.json({ ok: true });
});
app.post('/finance/scheduled-expenses/:id/execute', requireAuth, (req, res) => {
  const op = state.scheduled.find(o => o.id === req.params.id);
  if (!op) return res.status(404).json({ error: 'Not found' });
  const tx = { id: uid(), type: op.type, amount: op.amount, description: op.description, category: op.category, date: today(), eventId: op.eventId || null };
  state.transactions.unshift(tx);
  if (!op.recurring || op.recurring === 'none') {
    state.scheduled = state.scheduled.filter(o => o.id !== op.id);
  }
  if (tx.type === 'recette') state.bankBalance += tx.amount; else state.bankBalance -= tx.amount;
  debouncedSave();
  res.json({ ok: true, transaction: tx });
});

// Transactions
app.get(['/finance/transactions', '/api/finance/transactions'], requireAuth, (req, res) => {
  const { page = 1, limit = 20, eventId } = req.query;
  let list = state.transactions;
  if (eventId) list = list.filter(t => t.eventId === eventId);
  const start = (Number(page)-1)*Number(limit);
  const slice = list.slice(start, start + Number(limit));
  res.json({ transactions: slice, total: list.length });
});
app.post('/finance/transactions', requireAuth, (req, res) => {
  const tx = { id: uid(), date: today(), ...req.body };
  state.transactions.unshift(tx);
  if (tx.type === 'recette') state.bankBalance += Number(tx.amount||0); else state.bankBalance -= Number(tx.amount||0);
  debouncedSave();
  res.status(201).json(tx);
});
app.put('/finance/transactions/:id', requireAuth, (req, res) => {
  state.transactions = state.transactions.map(t => t.id === req.params.id ? { ...t, ...req.body } : t);
  const tx = state.transactions.find(t => t.id === req.params.id);
  debouncedSave();
  res.json(tx);
});
app.delete('/finance/transactions/:id', requireAuth, (req, res) => {
  state.transactions = state.transactions.filter(t => t.id !== req.params.id);
  debouncedSave();
  res.json({ ok: true });
});

app.post('/finance/sync/memberships', requireAuth, (req, res) => {
  res.json({ synchronized: 0, ok: true });
});

app.get(['/finance/categories', '/api/finance/categories'], requireAuth, (req, res) => {
  res.json({ categories: state.categories });
});
app.get(['/finance/category-breakdown', '/api/finance/category-breakdown'], requireAuth, (req, res) => {
  res.json({ period: req.query.period || 'month', breakdown: [], total: 0 });
});

// Expense Reports (notes de frais)
app.get(['/finance/expense-reports', '/api/finance/expense-reports'], requireAuth, (req, res) => {
  const { eventId } = req.query;
  let list = state.expenseReports;
  if (eventId) list = list.filter(r => r.eventId === eventId);
  res.json({ reports: list });
});
app.post('/finance/expense-reports', requireAuth, upload.single('file'), (req, res) => {
  const { date, description, amount, status = 'open', planned = false, eventId } = req.body;
  const report = {
    id: uid(),
    date: date || today(),
    description: description || '',
    amount: Number(amount || 0),
    status,
    planned: planned === 'true' || planned === true,
    fileName: req.file?.originalname,
    fileUrl: req.file ? `/uploads/${req.file.filename}` : '',
    eventId: eventId || null
  };
  state.expenseReports.unshift(report);
  debouncedSave();
  res.status(201).json({ report });
});
app.put('/finance/expense-reports/:id', requireAuth, (req, res) => {
  state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, ...req.body } : r);
  const report = state.expenseReports.find(r => r.id === req.params.id);
  debouncedSave();
  res.json({ report });
});
app.post('/finance/expense-reports/:id/close', requireAuth, (req, res) => {
  state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, status: 'closed', closedAt: new Date().toISOString() } : r);
  const report = state.expenseReports.find(r => r.id === req.params.id);
  debouncedSave();
  res.json({ report });
});
app.post('/finance/expense-reports/:id/reimburse', requireAuth, (req, res) => {
  state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, status: 'reimbursed', reimbursedAt: new Date().toISOString() } : r);
  const report = state.expenseReports.find(r => r.id === req.params.id);
  debouncedSave();
  res.json({ report });
});
app.post('/finance/expense-reports/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, status } : r);
  const report = state.expenseReports.find(r => r.id === req.params.id);
  debouncedSave();
  res.json({ report });
});
app.delete('/finance/expense-reports/:id', requireAuth, (req, res) => {
  state.expenseReports = state.expenseReports.filter(r => r.id !== req.params.id);
  res.json({ ok: true });
});

// EXPORT placeholder
app.get(['/finance/export', '/api/finance/export'], requireAuth, (req, res) => {
  res.header('Content-Type','text/csv');
  res.send('Date,Type,Description,Montant\n');
});

// PERMISSIONS & ADMIN endpoints
app.get('/api/admin/users', requireAuth, async (req, res) => {
  try {
    // Read from Prisma (single source of truth)
    const prismaUsers = await prisma.members.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        matricule: true,
        role: true,
        status: true,
        permissions: true,
        createdAt: true
      }
    });
    
    // Convert to API response format
    const users = prismaUsers.map(m => ({
      id: m.id,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      matricule: m.matricule,
      role: m.role,
      status: m.status || 'active',
      permissions: m.permissions || [],
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt
    }));
    
    res.json(users);
  } catch (e) {
    console.error('❌ GET /api/admin/users error:', e.message);
    res.status(500).json({ error: 'Failed to fetch users', details: e.message });
  }
});

app.post('/api/admin/users', requireAuth, async (req, res) => {
  try {
    const { email, firstName, lastName, matricule, password, role } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user already exists in Prisma
    const existingInPrisma = await prisma.members.findUnique({
      where: { email }
    });
    
    if (existingInPrisma) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    // Create in Prisma (single source of truth)
    const newMember = await prisma.members.create({
      data: {
        id: uid(),
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        matricule: matricule || '',
        password: password || '',
        role: role || 'USER',
        status: 'active',
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Also add to state.members for in-memory access
    state.members.push({
      id: newMember.id,
      email: newMember.email,
      firstName: newMember.firstName,
      lastName: newMember.lastName,
      matricule: newMember.matricule,
      password: newMember.password,
      role: newMember.role,
      status: newMember.status,
      permissions: newMember.permissions || [],
      createdAt: newMember.createdAt.toISOString()
    });
    
    debouncedSave();
    
    console.log('✅ User créé:', newMember.id, email, 'matricule:', matricule);
    res.status(201).json({ user: newMember });
  } catch (e) {
    console.error('❌ POST /api/admin/users error:', e.message);
    res.status(500).json({ error: 'Failed to create user', details: e.message });
  }
});

// PUT /api/admin/users/:id - Update user
app.put('/api/admin/users/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role } = req.body;

    // Check if user exists
    const existingUser = await prisma.members.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update in Prisma
    const updatedMember = await prisma.members.update({
      where: { id },
      data: {
        firstName: firstName !== undefined ? firstName : existingUser.firstName,
        lastName: lastName !== undefined ? lastName : existingUser.lastName,
        role: role !== undefined ? role : existingUser.role,
        updatedAt: new Date()
      }
    });

    // Also update in state.members
    const stateIndex = state.members.findIndex(m => m.id === id);
    if (stateIndex !== -1) {
      state.members[stateIndex] = {
        ...state.members[stateIndex],
        firstName: updatedMember.firstName,
        lastName: updatedMember.lastName,
        role: updatedMember.role
      };
    }

    debouncedSave();

    console.log('✅ User updated:', id, firstName, lastName);
    res.json({ user: updatedMember });
  } catch (e) {
    console.error('❌ PUT /api/admin/users/:id error:', e.message);
    res.status(500).json({ error: 'Failed to update user', details: e.message });
  }
});

// DELETE /api/admin/users/:id - Delete user
app.delete('/api/admin/users/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await prisma.members.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete from Prisma
    await prisma.members.delete({
      where: { id }
    });

    // Remove from state.members
    state.members = state.members.filter(m => m.id !== id);

    debouncedSave();

    console.log('✅ User deleted:', id);
    res.json({ success: true, message: 'User deleted' });
  } catch (e) {
    console.error('❌ DELETE /api/admin/users/:id error:', e.message);
    res.status(500).json({ error: 'Failed to delete user', details: e.message });
  }
});

app.get(['/api/admin/users/:id/permissions', '/api/user-permissions/:id'], requireAuth, (req, res) => {
  const member = state.members.find(m => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'User not found' });
  res.json({ 
    permissions: member.permissions || [],
    userId: member.id,
    email: member.email
  });
});

// NEWSLETTER endpoints
app.get('/newsletter', requireAuth, (req, res) => {
  const subscribers = state.members.map(m => ({
    id: m.id,
    email: m.email,
    status: 'CONFIRMED',
    subscribedAt: m.createdAt,
    firstName: m.firstName,
    lastName: m.lastName
  }));
  res.json(subscribers);
});

app.post('/newsletter', requireAuth, (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  const id = 'sub_' + uid();
  const subscriber = {
    id,
    email,
    status: 'CONFIRMED',
    subscribedAt: new Date().toISOString()
  };
  state.members.push({
    id: subscriber.id,
    email: subscriber.email,
    firstName: email.split('@')[0],
    lastName: 'Newsletter',
    status: 'active',
    permissions: [],
    createdAt: new Date().toISOString()
  });
  res.status(201).json(subscriber);
});

app.get('/newsletter/:id', requireAuth, (req, res) => {
  const member = state.members.find(m => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Subscriber not found' });
  res.json({
    id: member.id,
    email: member.email,
    status: 'CONFIRMED',
    subscribedAt: member.createdAt
  });
});

app.put('/newsletter/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  const idx = state.members.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Subscriber not found' });
  state.members[idx].status = status || 'active';
  res.json({ ok: true, status });
});

app.delete('/newsletter/:id', requireAuth, (req, res) => {
  state.members = state.members.filter(m => m.id !== req.params.id);
  res.json({ ok: true });
});

app.get('/newsletter/stats', requireAuth, (req, res) => {
  res.json({
    total: state.members.length,
    confirmed: state.members.length,
    pending: 0
  });
});

app.get('/newsletter/export', requireAuth, (req, res) => {
  const format = req.query.format || 'csv';
  if (format === 'csv') {
    res.header('Content-Type', 'text/csv');
    const csv = 'Email,Status,SubscribedAt\n' + 
      state.members.map(m => `"${m.email}","CONFIRMED","${m.createdAt}"`).join('\n');
    res.send(csv);
  } else {
    res.json(state.members.map(m => ({ email: m.email, status: 'CONFIRMED' })));
  }
});

// FINANCE API ALIASES - for frontend compatibility
// /api/finance/balance -> /api/finance/bank-balance
app.get('/api/finance/balance', requireAuth, (req, res) => {
  res.json({ data: { balance: state.bankBalance } });
});

// /api/finance/scheduled-operations -> /finance/scheduled-expenses
app.get('/api/finance/scheduled-operations', requireAuth, (req, res) => {
  const { eventId } = req.query;
  let list = state.scheduled;
  if (eventId) list = list.filter(x => x.eventId === eventId);
  res.json({ operations: list });
});
app.post('/api/finance/scheduled-operations', requireAuth, (req, res) => {
  const op = { id: uid(), ...req.body };
  state.scheduled.push(op);
  res.status(201).json(op);
});
app.put('/api/finance/scheduled-operations/:id', requireAuth, (req, res) => {
  state.scheduled = state.scheduled.map(o => o.id === req.params.id ? { ...o, ...req.body } : o);
  const op = state.scheduled.find(o => o.id === req.params.id);
  res.json(op);
});
app.delete('/api/finance/scheduled-operations/:id', requireAuth, (req, res) => {
  state.scheduled = state.scheduled.filter(o => o.id !== req.params.id);
  res.json({ ok: true });
});

// ============================================================
// SIMULATIONS ENDPOINT - Financial scenario simulations
// ============================================================
app.get('/api/finance/simulations', requireAuth, (req, res) => {
  res.json(state.simulations || []);
});

app.post('/api/finance/simulations', requireAuth, (req, res) => {
  const scenario = {
    id: uid(),
    ...req.body,
    createdAt: new Date().toISOString(),
    incomeItems: req.body.incomeItems || [],
    expenseItems: req.body.expenseItems || []
  };
  state.simulations.push(scenario);
  debouncedSave();
  res.status(201).json(scenario);
});

app.get('/api/finance/simulations/:id', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  res.json(scenario);
});

app.put('/api/finance/simulations/:id', requireAuth, (req, res) => {
  const idx = state.simulations.findIndex(s => s.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  state.simulations[idx] = {
    ...state.simulations[idx],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  debouncedSave();
  res.json(state.simulations[idx]);
});

app.delete('/api/finance/simulations/:id', requireAuth, (req, res) => {
  state.simulations = state.simulations.filter(s => s.id !== req.params.id);
  debouncedSave();
  res.json({ ok: true });
});

// Add income item to simulation
app.post('/api/finance/simulations/:id/income', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  const item = {
    id: uid(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  if (!scenario.incomeItems) scenario.incomeItems = [];
  scenario.incomeItems.push(item);
  debouncedSave();
  res.status(201).json(item);
});

// Remove income item from simulation
app.delete('/api/finance/simulations/:id/income/:itemId', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  if (!scenario.incomeItems) scenario.incomeItems = [];
  scenario.incomeItems = scenario.incomeItems.filter(i => i.id !== req.params.itemId);
  debouncedSave();
  res.json({ ok: true });
});

// Add expense item to simulation
app.post('/api/finance/simulations/:id/expense', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  const item = {
    id: uid(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  if (!scenario.expenseItems) scenario.expenseItems = [];
  scenario.expenseItems.push(item);
  debouncedSave();
  res.status(201).json(item);
});

// Remove expense item from simulation
app.delete('/api/finance/simulations/:id/expense/:itemId', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  if (!scenario.expenseItems) scenario.expenseItems = [];
  scenario.expenseItems = scenario.expenseItems.filter(e => e.id !== req.params.itemId);
  debouncedSave();
  res.json({ ok: true });
});

// Run simulation (calculate projection)
app.post('/api/finance/simulations/:id/run', requireAuth, (req, res) => {
  const scenario = state.simulations.find(s => s.id === req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }

  const { startingBalance = 0, projectionMonths = 12 } = req.body;
  const incomeItems = scenario.incomeItems || [];
  const expenseItems = scenario.expenseItems || [];

  // Helper: get frequency multiplier (times per year)
  const getFrequencyMultiplier = (freq) => {
    const freqMap = {
      'MONTHLY': 12,
      'QUARTERLY': 4,
      'SEMI_ANNUAL': 2,
      'YEARLY': 1,
      'ONE_SHOT': 0
    };
    return freqMap[freq] || 1;
  };

  // Calculate monthly amounts
  const monthlyIncome = incomeItems.reduce((sum, item) => {
    const multiplier = getFrequencyMultiplier(item.frequency);
    return sum + (parseFloat(item.amount) || 0) / (multiplier > 0 ? multiplier : 12);
  }, 0);

  const monthlyExpense = expenseItems.reduce((sum, item) => {
    const multiplier = getFrequencyMultiplier(item.frequency);
    return sum + (parseFloat(item.amount) || 0) / (multiplier > 0 ? multiplier : 12);
  }, 0);

  const monthlyNet = monthlyIncome - monthlyExpense;

  // Generate projection
  const projection = [];
  let currentBalance = startingBalance;
  for (let month = 1; month <= projectionMonths; month++) {
    currentBalance += monthlyNet;
    projection.push({
      month,
      startBalance: month === 1 ? startingBalance : projection[month - 2]?.endBalance || startingBalance,
      income: monthlyIncome,
      expenses: monthlyExpense,
      net: monthlyNet,
      endBalance: currentBalance
    });
  }

  const results = {
    scenarioId: scenario.id,
    projectionMonths,
    startingBalance,
    finalBalance: currentBalance,
    monthlyNet,
    totalChange: currentBalance - startingBalance,
    projection,
    summary: {
      isPositive: monthlyNet >= 0,
      breakEvenMonth: monthlyNet === 0 ? 1 : monthlyNet < 0 ? Math.ceil(-startingBalance / monthlyNet) : null,
      projectionMonths
    }
  };

  res.json(results);
});

// /api/finance/documents -> returns all documents (finance perspective)
app.get('/api/finance/documents', requireAuth, (req, res) => {
  res.json({ documents: state.financialDocuments || [] });
});

// Quote templates endpoint - retourner les templates depuis le backup
app.get('/api/quote-templates', requireAuth, (req, res) => {
  res.json(state.quoteTemplates || []);
});
app.post('/api/quote-templates', requireAuth, (req, res) => {
  const template = { id: uid(), ...req.body, createdAt: new Date().toISOString() };
  state.quoteTemplates.push(template);
  debouncedSave();
  res.status(201).json(template);
});
app.put('/api/quote-templates/:id', requireAuth, (req, res) => {
  const idx = state.quoteTemplates.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  state.quoteTemplates[idx] = { ...state.quoteTemplates[idx], ...req.body, updatedAt: new Date().toISOString() };
  debouncedSave();
  res.json(state.quoteTemplates[idx]);
});
app.delete('/api/quote-templates/:id', requireAuth, (req, res) => {
  state.quoteTemplates = state.quoteTemplates.filter(t => t.id !== req.params.id);
  debouncedSave();
  res.json({ ok: true });
});

// Devis Lines endpoints
app.get('/api/devis-lines/:devisId', requireAuth, (req, res) => {
  // Retourner les lignes du devis spécifique, ou toutes si devisId = "all"
  if (req.params.devisId === 'all') {
    return res.json(state.devisLines || []);
  }
  const lines = state.devisLines.filter(l => l.devisId === req.params.devisId);
  res.json({ lines });
});

app.get('/api/devis-lines', requireAuth, (req, res) => {
  // Retourner toutes les lignes de devis
  res.json(state.devisLines || []);
});

app.post('/api/devis-lines', requireAuth, (req, res) => {
  const line = { 
    id: uid(), 
    ...req.body,
    createdAt: new Date().toISOString()
  };
  state.devisLines.push(line);
  debouncedSave();
  res.status(201).json(line);
});

app.put('/api/devis-lines/:lineId', requireAuth, (req, res) => {
  const idx = state.devisLines.findIndex(l => l.id === req.params.lineId);
  if (idx === -1) return res.status(404).json({ error: 'Line not found' });
  state.devisLines[idx] = { ...state.devisLines[idx], ...req.body, updatedAt: new Date().toISOString() };
  debouncedSave();
  res.json(state.devisLines[idx]);
});

app.delete('/api/devis-lines/:lineId', requireAuth, (req, res) => {
  state.devisLines = state.devisLines.filter(l => l.id !== req.params.lineId);
  debouncedSave();
  res.json({ ok: true });
});

// Financial documents endpoint (devis, factures, documents)
app.get('/api/financial-documents', requireAuth, (req, res) => {
  res.json({ financialDocuments: state.financialDocuments || [] });
});

app.post('/api/financial-documents', requireAuth, (req, res) => {
  const doc = { 
    id: uid(), 
    ...req.body,
    createdAt: new Date().toISOString()
  };
  state.financialDocuments.push(doc);
  debouncedSave();
  res.status(201).json(doc);
});

app.put('/api/financial-documents/:docId', requireAuth, (req, res) => {
  const idx = state.financialDocuments.findIndex(d => d.id === req.params.docId);
  if (idx === -1) return res.status(404).json({ error: 'Document not found' });
  state.financialDocuments[idx] = { ...state.financialDocuments[idx], ...req.body, updatedAt: new Date().toISOString() };
  debouncedSave();
  res.json(state.financialDocuments[idx]);
});

app.delete('/api/financial-documents/:docId', requireAuth, (req, res) => {
  state.financialDocuments = state.financialDocuments.filter(d => d.id !== req.params.docId);
  debouncedSave();
  res.json({ ok: true });
});

// Email templates endpoint
app.get('/api/email-templates', requireAuth, (req, res) => {
  res.json([]);
});
app.get('/api/email-templates/:id', requireAuth, (req, res) => {
  res.status(404).json({ error: 'Template not found' });
});
app.post('/api/email-templates', requireAuth, (req, res) => {
  const template = { id: uid(), ...req.body, createdAt: new Date().toISOString() };
  res.status(201).json(template);
});
app.put('/api/email-templates/:id', requireAuth, (req, res) => {
  const template = { id: req.params.id, ...req.body, updatedAt: new Date().toISOString() };
  res.json(template);
});
app.delete('/api/email-templates/:id', requireAuth, (req, res) => {
  res.json({ ok: true });
});

// ===== ADMIN PROMOTION ENDPOINT =====
// POST /api/admin/users/:id/permissions - Set user permissions
app.post('/api/admin/users/:id/permissions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    
    // Find the member in Prisma
    const member = await prisma.members.findUnique({
      where: { id }
    });
    
    if (!member) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update in Prisma
    const updatedMember = await prisma.members.update({
      where: { id },
      data: {
        permissions: permissions || []
      }
    });
    
    // Also update in state.members
    const stateUser = state.members.find(m => m.id === id);
    if (stateUser) {
      stateUser.permissions = permissions || [];
    }
    
    debouncedSave();
    
    console.log(`✅ Permissions updated for user ${id}`);
    res.json({ ok: true, user: updatedMember });
  } catch (e) {
    console.error('❌ POST /api/admin/users/:id/permissions error:', e.message);
    res.status(500).json({ error: 'Failed to update permissions', details: e.message });
  }
});

// GET /api/admin/users/:id/permissions - Get user permissions
app.get('/api/admin/users/:id/permissions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the member in Prisma
    const member = await prisma.members.findUnique({
      where: { id }
    });
    
    if (!member) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      userId: id,
      email: member.email,
      permissions: member.permissions || []
    });
  } catch (e) {
    console.error('❌ GET /api/admin/users/:id/permissions error:', e.message);
    res.status(500).json({ error: 'Failed to fetch permissions', details: e.message });
  }
});
app.post('/api/admin/users/:userId/make-admin', requireAuth, async (req, res) => {
  const { userId } = req.params;
  
  console.log(`👤 Admin promotion request for user: ${userId}`);
  
  try {
    // Find the member in Prisma
    const member = await prisma.members.findUnique({
      where: { id: userId }
    });
    
    if (!member) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Define admin resources
    const adminResources = ['members', 'vehicles', 'events', 'finance', 'transactions', 'reports', 'permissions', 'users', 'news', 'documents', 'maintenance', 'admin'];
    const adminActions = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'];
    
    // Build admin permissions
    const adminPermissions = adminResources.map(resource => ({
      resource: resource,
      actions: adminActions
    }));
    
    // Update in Prisma
    const updatedMember = await prisma.members.update({
      where: { id: userId },
      data: {
        role: 'ADMIN',
        permissions: adminPermissions
      }
    });
    
    // Also update in state.members for in-memory access
    const stateUser = state.members.find(m => m.id === userId);
    if (stateUser) {
      stateUser.role = 'ADMIN';
      stateUser.permissions = adminPermissions;
    }
    
    debouncedSave();
    console.log(`✅ User ${userId} promoted to ADMIN`);
    res.json({ ok: true, user: updatedMember });
  } catch (e) {
    console.error('❌ Make-admin error:', e.message);
    res.status(500).json({ error: 'Failed to promote user', details: e.message });
  }
});

// ===== ENDPOINTS ADMINISTRATION VÉHICULES (PERSISTE DANS PRISMA) =====

// Cartes Grises - GET
app.get(['/vehicles/:parc/grayscale','/api/vehicles/:parc/grayscale'], requireAuth, async (req, res) => {
  try {
    const grayscale = await prisma.vehicleGrayscale.findUnique({
      where: { vehicleId: req.params.parc }
    });
    res.json(grayscale || { vehicleId: req.params.parc });
  } catch (e) {
    console.error('Erreur lecture CG:', e);
    res.status(500).json({ error: e.message });
  }
});

// Cartes Grises - PUT
app.put(['/vehicles/:parc/grayscale','/api/vehicles/:parc/grayscale'], requireAuth, async (req, res) => {
  try {
    const { currentGrayscaleNumber, currentGrayscaleUrl, previousGrayscaleNumber, previousGrayscaleUrl, registrationDate, expiresAt } = req.body;
    const grayscale = await prisma.vehicleGrayscale.upsert({
      where: { vehicleId: req.params.parc },
      update: { currentGrayscaleNumber, currentGrayscaleUrl, previousGrayscaleNumber, previousGrayscaleUrl, registrationDate, expiresAt, status: expiresAt && new Date(expiresAt) < new Date() ? 'expired' : 'valid' },
      create: { vehicleId: req.params.parc, currentGrayscaleNumber, currentGrayscaleUrl, previousGrayscaleNumber, previousGrayscaleUrl, registrationDate, expiresAt, status: expiresAt && new Date(expiresAt) < new Date() ? 'expired' : 'valid' }
    });
    res.json(grayscale);
  } catch (e) {
    console.error('Erreur sauvegarde CG:', e);
    res.status(500).json({ error: e.message });
  }
});

// Certificat de Cession - GET
app.get(['/vehicles/:parc/cession','/api/vehicles/:parc/cession'], requireAuth, async (req, res) => {
  try {
    const cession = await prisma.vehicleCessionCertificate.findUnique({
      where: { vehicleId: req.params.parc }
    });
    res.json(cession || { vehicleId: req.params.parc });
  } catch (e) {
    console.error('Erreur lecture cession:', e);
    res.status(500).json({ error: e.message });
  }
});

// Certificat de Cession - PUT
app.put(['/vehicles/:parc/cession','/api/vehicles/:parc/cession'], requireAuth, async (req, res) => {
  try {
    const { certificateUrl, issuedDate, issuedBy } = req.body;
    const cession = await prisma.vehicleCessionCertificate.upsert({
      where: { vehicleId: req.params.parc },
      update: { certificateUrl, issuedDate, issuedBy },
      create: { vehicleId: req.params.parc, certificateUrl, issuedDate, issuedBy }
    });
    res.json(cession);
  } catch (e) {
    console.error('Erreur sauvegarde cession:', e);
    res.status(500).json({ error: e.message });
  }
});

// Assurance - GET
app.get(['/vehicles/:parc/insurance','/api/vehicles/:parc/insurance'], requireAuth, async (req, res) => {
  try {
    const insurance = await prisma.vehicleInsurance.findUnique({
      where: { vehicleId: req.params.parc }
    });
    res.json(insurance || { vehicleId: req.params.parc });
  } catch (e) {
    console.error('Erreur lecture assurance:', e);
    res.status(500).json({ error: e.message });
  }
});

// Assurance - PUT
app.put(['/vehicles/:parc/insurance','/api/vehicles/:parc/insurance'], requireAuth, async (req, res) => {
  try {
    const { attestationUrl, insuranceCompany, policyNumber, validFrom, validUntil, validFromTime, validUntilTime } = req.body;
    const isExpired = validUntil && new Date(validUntil) < new Date();
    const insurance = await prisma.vehicleInsurance.upsert({
      where: { vehicleId: req.params.parc },
      update: { attestationUrl, insuranceCompany, policyNumber, validFrom, validUntil, validFromTime, validUntilTime, status: isExpired ? 'expired' : 'valid' },
      create: { vehicleId: req.params.parc, attestationUrl, insuranceCompany, policyNumber, validFrom, validUntil, validFromTime, validUntilTime, status: isExpired ? 'expired' : 'valid' }
    });
    res.json(insurance);
  } catch (e) {
    console.error('Erreur sauvegarde assurance:', e);
    res.status(500).json({ error: e.message });
  }
});

// Contrôle Technique - GET dernier CT
app.get(['/vehicles/:parc/inspection','/api/vehicles/:parc/inspection'], requireAuth, async (req, res) => {
  try {
    const inspection = await prisma.vehicleInspection.findFirst({
      where: { vehicleId: req.params.parc },
      orderBy: { inspectionDate: 'desc' },
      take: 1
    });
    res.json(inspection || { vehicleId: req.params.parc });
  } catch (e) {
    console.error('Erreur lecture CT:', e);
    res.status(500).json({ error: e.message });
  }
});

// Contrôle Technique - GET tous les CT
app.get(['/vehicles/:parc/inspections','/api/vehicles/:parc/inspections'], requireAuth, async (req, res) => {
  try {
    const inspections = await prisma.vehicleInspection.findMany({
      where: { vehicleId: req.params.parc },
      orderBy: { inspectionDate: 'desc' }
    });
    res.json({ inspections });
  } catch (e) {
    console.error('Erreur lecture CT:', e);
    res.status(500).json({ error: e.message });
  }
});

// Contrôle Technique - POST nouveau CT
app.post(['/vehicles/:parc/inspection','/api/vehicles/:parc/inspection'], requireAuth, async (req, res) => {
  try {
    const { attestationUrl, inspectionDate, expiryDate, mileage, status, defects, nextInspectionDate } = req.body;
    const inspection = await prisma.vehicleInspection.create({
      data: {
        vehicleId: req.params.parc,
        attestationUrl,
        inspectionDate,
        expiryDate,
        mileage,
        status: status || (expiryDate && new Date(expiryDate) < new Date() ? 'expired' : 'valid'),
        defects,
        nextInspectionDate
      }
    });
    res.status(201).json(inspection);
  } catch (e) {
    console.error('Erreur création CT:', e);
    res.status(500).json({ error: e.message });
  }
});

// Échéancier - GET tous les échéanciers pour un véhicule
app.get(['/vehicles/:parc/schedule','/api/vehicles/:parc/schedule'], requireAuth, async (req, res) => {
  try {
    const schedule = await prisma.vehicleScheduleItem.findMany({
      where: { vehicleId: req.params.parc },
      orderBy: { dueDate: 'asc' }
    });
    res.json({ schedule });
  } catch (e) {
    console.error('❌ GET /vehicles/:parc/schedule error:', e.message);
    res.status(500).json({ error: 'Failed to fetch schedule', details: e.message });
  }
});

// Échéancier - GET global tous les véhicules
app.get(['/vehicles/schedule/all','/api/vehicles/schedule/all'], requireAuth, async (req, res) => {
  try {
    const schedule = await prisma.vehicleScheduleItem.findMany({
      orderBy: { dueDate: 'asc' }
    });
    res.json({ schedule });
  } catch (e) {
    console.error('❌ GET /vehicles/schedule/all error:', e.message);
    res.status(500).json({ error: 'Failed to fetch schedules', details: e.message });
  }
});

// Échéancier - POST ajouter une ligne
app.post(['/vehicles/:parc/schedule','/api/vehicles/:parc/schedule'], requireAuth, async (req, res) => {
  try {
    const { type, description, dueDate, dueTime, priority, notes } = req.body;
    const item = await prisma.vehicleScheduleItem.create({
      data: {
        vehicleId: req.params.parc,
        type,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        dueTime,
        priority: priority || 'normal',
        status: 'pending',
        notes
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ POST /vehicles/:parc/schedule error:', e.message);
    res.status(500).json({ error: 'Failed to create schedule item', details: e.message });
  }
});

// Échéancier - PUT marquer comme complété
app.put(['/vehicles/schedule/:itemId','/api/vehicles/schedule/:itemId'], requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const item = await prisma.vehicleScheduleItem.update({
      where: { id: req.params.itemId },
      data: { status }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ PUT /vehicles/schedule/:itemId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.status(500).json({ error: 'Failed to update schedule item', details: e.message });
  }
});

// Échéancier - DELETE supprimer une ligne
app.delete(['/vehicles/schedule/:itemId','/api/vehicles/schedule/:itemId'], requireAuth, async (req, res) => {
  try {
    await prisma.vehicleScheduleItem.delete({
      where: { id: req.params.itemId }
    });
    res.json({ success: true });
  } catch (e) {
    console.error('❌ DELETE /vehicles/schedule/:itemId error:', e.message);
    if (e?.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.status(500).json({ error: 'Failed to delete schedule item', details: e.message });
  }
});

// Notes Administratives - GET
app.get(['/vehicles/:parc/notes','/api/vehicles/:parc/notes'], requireAuth, async (req, res) => {
  try {
    const notes = await prisma.vehicleAdministrativeNote.findMany({
      where: { vehicleId: req.params.parc },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ notes });
  } catch (e) {
    console.error('Erreur lecture notes:', e);
    res.status(500).json({ error: e.message });
  }
});

// Notes Administratives - POST
app.post(['/vehicles/:parc/notes','/api/vehicles/:parc/notes'], requireAuth, async (req, res) => {
  try {
    const { category, content, attachmentUrl } = req.body;
    const note = await prisma.vehicleAdministrativeNote.create({
      data: {
        vehicleId: req.params.parc,
        category,
        content,
        attachmentUrl
      }
    });
    res.status(201).json(note);
  } catch (e) {
    console.error('Erreur création note:', e);
    res.status(500).json({ error: e.message });
  }
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  // Load users from Prisma into state.members at startup
  try {
    const prismaMembers = await prisma.members.findMany();
    state.members = prismaMembers.map(m => ({
      id: m.id,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      matricule: m.matricule,
      password: m.password,
      role: m.role,
      status: m.status,
      permissions: m.permissions || [],
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt
    }));
    console.log(`✅ Loaded ${state.members.length} members from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load members from Prisma:', e.message);
  }

  // Load contrôles techniques from Prisma
  try {
    const prismaCtData = await prisma.vehicleControlTechnique.findMany();
    state.vehicleControleTechnique = prismaCtData.map(ct => ({
      id: ct.id,
      parc: ct.parc,
      attestationPath: ct.attestationPath,
      ctDate: ct.ctDate instanceof Date ? ct.ctDate.toISOString() : ct.ctDate,
      ctStatus: ct.ctStatus,
      nextCtDate: ct.nextCtDate instanceof Date ? ct.nextCtDate.toISOString() : ct.nextCtDate,
      mileage: ct.mileage,
      notes: ct.notes
    }));
    console.log(`✅ Loaded ${state.vehicleControleTechnique.length} contrôles techniques from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load contrôles techniques from Prisma:', e.message);
  }

  // Load vehicles from Prisma
  try {
    const prismaVehicles = await prisma.vehicle.findMany();
    state.vehicles = prismaVehicles;
    console.log(`✅ Loaded ${state.vehicles.length} vehicles from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load vehicles from Prisma:', e.message);
  }

  // Load events from Prisma
  try {
    const prismaEvents = await prisma.event.findMany();
    state.events = prismaEvents;
    console.log(`✅ Loaded ${state.events.length} events from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load events from Prisma:', e.message);
  }

  // Load retro news from Prisma
  try {
    const prismaNews = await prisma.retroNews.findMany();
    state.retroNews = prismaNews;
    console.log(`✅ Loaded ${state.retroNews.length} retro news from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load retro news from Prisma:', e.message);
  }

  // Load flashes from Prisma
  try {
    const prismaFlashes = await prisma.flash.findMany();
    state.flashes = prismaFlashes;
    console.log(`✅ Loaded ${state.flashes.length} flashes from Prisma`);
  } catch (e) {
    console.warn('⚠️ Failed to load flashes from Prisma:', e.message);
  }

  console.log('');
  console.log(`🌐 API accessible sur: http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Endpoints disponibles:');
  console.log('   GET  /public/events     - Événements publiés');
  console.log('   GET  /public/vehicles   - Véhicules');
  console.log('   GET  /api/events        - Tous les événements (auth)');
  console.log('   POST /api/events        - Créer événement (auth)');
  console.log('   PUT  /api/events/:id    - Modifier événement (auth)');
  console.log('   DEL  /api/events/:id    - Supprimer événement (auth)');
  console.log('');
  console.log('✅ Serveur prêt - toutes les modifications sont persistées');
  console.log('═══════════════════════════════════════════════════════════');
});

// Utilitaire pour déconnecter Prisma proprement
async function safeDisconnectPrisma() {
  try {
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
      console.log('🔌 Prisma déconnecté proprement');
    } else {
      console.log('ℹ️ Prisma non initialisé ou indisponible, pas de déconnexion nécessaire');
    }
  } catch (e) {
    console.warn('⚠️ Erreur lors de la déconnexion Prisma:', e.message);
  }
}



// ============ AUTO-GENERATED CRUD ENDPOINTS ============

// ============ VEHICLE CRUD ============

// GET - List all vehicle
app.get(['/api/vehicle', '/vehicle'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicle.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicle:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle', details: e.message });
  }
});

// GET - Get single vehicle
app.get(['/api/vehicle/:id', '/vehicle/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicle not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicle:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle', details: e.message });
  }
});

// POST - Create new vehicle
app.post(['/api/vehicle', '/vehicle'], requireAuth, async (req, res) => {
  try {
    const { parc, type, modele, etat, marque, ...rest } = req.body;
    
    if (!parc || !type || !modele || !etat) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['parc', 'type', 'modele', 'etat']
      });
    }
    
    const item = await prisma.vehicle.create({
      data: {
        parc,
        type,
        modele,
        etat,
        marque: marque || null,
        ...rest,
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicle:', e.message);
    res.status(500).json({ error: 'Failed to create vehicle', details: e.message });
  }
});

// PUT - Update vehicle
app.put(['/api/vehicle/:id', '/vehicle/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicle:', e.message);
    res.status(500).json({ error: 'Failed to update vehicle', details: e.message });
  }
});

// DELETE - Remove vehicle
app.delete(['/api/vehicle/:id', '/vehicle/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicle.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicle:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicle', details: e.message });
  }
});

// ============ EVENT CRUD ============

// GET - List all event
app.get(['/api/event', '/event'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.event.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting event:', e.message);
    res.status(500).json({ error: 'Failed to fetch event', details: e.message });
  }
});

// GET - Get single event
app.get(['/api/event/:id', '/event/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.event.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'event not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting event:', e.message);
    res.status(500).json({ error: 'Failed to fetch event', details: e.message });
  }
});

// POST - Create new event
app.post(['/api/event', '/event'], requireAuth, async (req, res) => {
  try {
    const { title, date, ...rest } = req.body;
    
    if (!title || !date) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['title', 'date']
      });
    }
    
    const item = await prisma.event.create({
      data: {
        id: uid(),
        title,
        date: new Date(date),
        ...rest,
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating event:', e.message);
    res.status(500).json({ error: 'Failed to create event', details: e.message });
  }
});

// PUT - Update event
app.put(['/api/event/:id', '/event/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.event.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating event:', e.message);
    res.status(500).json({ error: 'Failed to update event', details: e.message });
  }
});

// DELETE - Remove event
app.delete(['/api/event/:id', '/event/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.event.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting event:', e.message);
    res.status(500).json({ error: 'Failed to delete event', details: e.message });
  }
});

// ============ FLASH CRUD ============

// GET - List all flash
app.get(['/api/flash', '/flash'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.flash.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting flash:', e.message);
    res.status(500).json({ error: 'Failed to fetch flash', details: e.message });
  }
});

// GET - Get single flash
app.get(['/api/flash/:id', '/flash/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.flash.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'flash not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting flash:', e.message);
    res.status(500).json({ error: 'Failed to fetch flash', details: e.message });
  }
});

// POST - Create new flash
app.post(['/api/flash', '/flash'], requireAuth, async (req, res) => {
  try {
    const { content, title, ...rest } = req.body; // Ignore title, it's not a flash field
    
    if (!content) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['content']
      });
    }
    
    const item = await prisma.flash.create({
      data: {
        id: uid(),
        content,
        ...rest,
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating flash:', e.message);
    res.status(500).json({ error: 'Failed to create flash', details: e.message });
  }
});

// PUT - Update flash
app.put(['/api/flash/:id', '/flash/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.flash.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating flash:', e.message);
    res.status(500).json({ error: 'Failed to update flash', details: e.message });
  }
});

// DELETE - Remove flash
app.delete(['/api/flash/:id', '/flash/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.flash.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting flash:', e.message);
    res.status(500).json({ error: 'Failed to delete flash', details: e.message });
  }
});

// ============ RETRO_REQUEST CRUD ============

// GET - List all retro_request
app.get(['/api/retro_request', '/retro_request'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.retro_request.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting retro_request:', e.message);
    res.status(500).json({ error: 'Failed to fetch retro_request', details: e.message });
  }
});

// GET - Get single retro_request
app.get(['/api/retro_request/:id', '/retro_request/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'retro_request not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting retro_request:', e.message);
    res.status(500).json({ error: 'Failed to fetch retro_request', details: e.message });
  }
});

// POST - Create new retro_request
app.post(['/api/retro_request', '/retro_request'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating retro_request:', e.message);
    res.status(500).json({ error: 'Failed to create retro_request', details: e.message });
  }
});

// PUT - Update retro_request
app.put(['/api/retro_request/:id', '/retro_request/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating retro_request:', e.message);
    res.status(500).json({ error: 'Failed to update retro_request', details: e.message });
  }
});

// DELETE - Remove retro_request
app.delete(['/api/retro_request/:id', '/retro_request/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.retro_request.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting retro_request:', e.message);
    res.status(500).json({ error: 'Failed to delete retro_request', details: e.message });
  }
});

// ============ RETRO_REQUEST_FILE CRUD ============

// GET - List all retro_request_file
app.get(['/api/retro_request_file', '/retro_request_file'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.retro_request_file.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting retro_request_file:', e.message);
    res.status(500).json({ error: 'Failed to fetch retro_request_file', details: e.message });
  }
});

// GET - Get single retro_request_file
app.get(['/api/retro_request_file/:id', '/retro_request_file/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request_file.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'retro_request_file not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting retro_request_file:', e.message);
    res.status(500).json({ error: 'Failed to fetch retro_request_file', details: e.message });
  }
});

// POST - Create new retro_request_file
app.post(['/api/retro_request_file', '/retro_request_file'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request_file.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating retro_request_file:', e.message);
    res.status(500).json({ error: 'Failed to create retro_request_file', details: e.message });
  }
});

// PUT - Update retro_request_file
app.put(['/api/retro_request_file/:id', '/retro_request_file/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.retro_request_file.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating retro_request_file:', e.message);
    res.status(500).json({ error: 'Failed to update retro_request_file', details: e.message });
  }
});

// DELETE - Remove retro_request_file
app.delete(['/api/retro_request_file/:id', '/retro_request_file/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.retro_request_file.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting retro_request_file:', e.message);
    res.status(500).json({ error: 'Failed to delete retro_request_file', details: e.message });
  }
});

// ============ SITE_USERS CRUD ============

// GET - List all site_users
app.get(['/api/site_users', '/site_users'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.site_users.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting site_users:', e.message);
    res.status(500).json({ error: 'Failed to fetch site_users', details: e.message });
  }
});

// GET - Get single site_users
app.get(['/api/site_users/:id', '/site_users/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.site_users.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'site_users not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting site_users:', e.message);
    res.status(500).json({ error: 'Failed to fetch site_users', details: e.message });
  }
});

// POST - Create new site_users
app.post(['/api/site_users', '/site_users'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.site_users.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating site_users:', e.message);
    res.status(500).json({ error: 'Failed to create site_users', details: e.message });
  }
});

// PUT - Update site_users
app.put(['/api/site_users/:id', '/site_users/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.site_users.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating site_users:', e.message);
    res.status(500).json({ error: 'Failed to update site_users', details: e.message });
  }
});

// DELETE - Remove site_users
app.delete(['/api/site_users/:id', '/site_users/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.site_users.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting site_users:', e.message);
    res.status(500).json({ error: 'Failed to delete site_users', details: e.message });
  }
});

// ============ DOCUMENT CRUD ============

// GET - List all document
app.get(['/api/document', '/document'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.document.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting document:', e.message);
    res.status(500).json({ error: 'Failed to fetch document', details: e.message });
  }
});

// GET - Get single document
app.get(['/api/document/:id', '/document/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.document.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'document not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting document:', e.message);
    res.status(500).json({ error: 'Failed to fetch document', details: e.message });
  }
});

// POST - Create new document
app.post(['/api/document', '/document'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.document.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating document:', e.message);
    res.status(500).json({ error: 'Failed to create document', details: e.message });
  }
});

// PUT - Update document
app.put(['/api/document/:id', '/document/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.document.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating document:', e.message);
    res.status(500).json({ error: 'Failed to update document', details: e.message });
  }
});

// DELETE - Remove document
app.delete(['/api/document/:id', '/document/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.document.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting document:', e.message);
    res.status(500).json({ error: 'Failed to delete document', details: e.message });
  }
});

// ============ VEHICLE_MAINTENANCE CRUD ============

// GET - List all vehicle_maintenance
app.get(['/api/vehicle_maintenance', '/vehicle_maintenance'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicle_maintenance.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicle_maintenance:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle_maintenance', details: e.message });
  }
});

// GET - Get single vehicle_maintenance
app.get(['/api/vehicle_maintenance/:id', '/vehicle_maintenance/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_maintenance.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicle_maintenance not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicle_maintenance:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle_maintenance', details: e.message });
  }
});

// POST - Create new vehicle_maintenance
app.post(['/api/vehicle_maintenance', '/vehicle_maintenance'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_maintenance.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicle_maintenance:', e.message);
    res.status(500).json({ error: 'Failed to create vehicle_maintenance', details: e.message });
  }
});

// PUT - Update vehicle_maintenance
app.put(['/api/vehicle_maintenance/:id', '/vehicle_maintenance/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_maintenance.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicle_maintenance:', e.message);
    res.status(500).json({ error: 'Failed to update vehicle_maintenance', details: e.message });
  }
});

// DELETE - Remove vehicle_maintenance
app.delete(['/api/vehicle_maintenance/:id', '/vehicle_maintenance/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicle_maintenance.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicle_maintenance:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicle_maintenance', details: e.message });
  }
});

// ============ VEHICLE_SERVICE_SCHEDULE CRUD ============

// GET - List all vehicle_service_schedule
app.get(['/api/vehicle_service_schedule', '/vehicle_service_schedule'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicle_service_schedule.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicle_service_schedule:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle_service_schedule', details: e.message });
  }
});

// GET - Get single vehicle_service_schedule
app.get(['/api/vehicle_service_schedule/:id', '/vehicle_service_schedule/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_service_schedule.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicle_service_schedule not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicle_service_schedule:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicle_service_schedule', details: e.message });
  }
});

// POST - Create new vehicle_service_schedule
app.post(['/api/vehicle_service_schedule', '/vehicle_service_schedule'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_service_schedule.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicle_service_schedule:', e.message);
    res.status(500).json({ error: 'Failed to create vehicle_service_schedule', details: e.message });
  }
});

// PUT - Update vehicle_service_schedule
app.put(['/api/vehicle_service_schedule/:id', '/vehicle_service_schedule/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicle_service_schedule.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicle_service_schedule:', e.message);
    res.status(500).json({ error: 'Failed to update vehicle_service_schedule', details: e.message });
  }
});

// DELETE - Remove vehicle_service_schedule
app.delete(['/api/vehicle_service_schedule/:id', '/vehicle_service_schedule/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicle_service_schedule.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicle_service_schedule:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicle_service_schedule', details: e.message });
  }
});

// ============ USAGE CRUD ============

// GET - List all usage
app.get(['/api/usage', '/usage'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.Usage.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting usage:', e.message);
    res.status(500).json({ error: 'Failed to fetch usage', details: e.message });
  }
});

// GET - Get single usage
app.get(['/api/usage/:id', '/usage/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.Usage.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'usage not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting usage:', e.message);
    res.status(500).json({ error: 'Failed to fetch usage', details: e.message });
  }
});

// POST - Create new usage
app.post(['/api/usage', '/usage'], requireAuth, async (req, res) => {
  try {
    const { parc, startedAt, ...rest } = req.body;
    
    if (!parc || !startedAt) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['parc', 'startedAt']
      });
    }
    
    const item = await prisma.Usage.create({
      data: {
        parc,
        startedAt: new Date(startedAt),
        ...rest,
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating usage:', e.message);
    res.status(500).json({ error: 'Failed to create usage', details: e.message });
  }
});

// PUT - Update usage
app.put(['/api/usage/:id', '/usage/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.Usage.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating usage:', e.message);
    res.status(500).json({ error: 'Failed to update usage', details: e.message });
  }
});

// DELETE - Remove usage
app.delete(['/api/usage/:id', '/usage/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.Usage.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting usage:', e.message);
    res.status(500).json({ error: 'Failed to delete usage', details: e.message });
  }
});

// ============ VEHICLECONTROLTECHNIQUE CRUD ============

// GET - List all vehicleControlTechnique
app.get(['/api/vehicle-control-technique', '/vehicle-control-technique'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicleControlTechnique.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicleControlTechnique:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleControlTechnique', details: e.message });
  }
});

// GET - Get single vehicleControlTechnique
app.get(['/api/vehicle-control-technique/:id', '/vehicle-control-technique/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleControlTechnique.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicleControlTechnique not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicleControlTechnique:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleControlTechnique', details: e.message });
  }
});

// POST - Create new vehicleControlTechnique
app.post(['/api/vehicle-control-technique', '/vehicle-control-technique'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleControlTechnique.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicleControlTechnique:', e.message);
    res.status(500).json({ error: 'Failed to create vehicleControlTechnique', details: e.message });
  }
});

// PUT - Update vehicleControlTechnique
app.put(['/api/vehicle-control-technique/:id', '/vehicle-control-technique/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleControlTechnique.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicleControlTechnique:', e.message);
    res.status(500).json({ error: 'Failed to update vehicleControlTechnique', details: e.message });
  }
});

// DELETE - Remove vehicleControlTechnique
app.delete(['/api/vehicle-control-technique/:id', '/vehicle-control-technique/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicleControlTechnique.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicleControlTechnique:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicleControlTechnique', details: e.message });
  }
});

// ============ VEHICLECESSIONCERTIFICATE CRUD ============

// GET - List all vehicleCessionCertificate
app.get(['/api/vehicle-cession-certificate', '/vehicle-cession-certificate'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicleCessionCertificate.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicleCessionCertificate:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleCessionCertificate', details: e.message });
  }
});

// GET - Get single vehicleCessionCertificate
app.get(['/api/vehicle-cession-certificate/:id', '/vehicle-cession-certificate/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleCessionCertificate.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicleCessionCertificate not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicleCessionCertificate:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleCessionCertificate', details: e.message });
  }
});

// POST - Create new vehicleCessionCertificate
app.post(['/api/vehicle-cession-certificate', '/vehicle-cession-certificate'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleCessionCertificate.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicleCessionCertificate:', e.message);
    res.status(500).json({ error: 'Failed to create vehicleCessionCertificate', details: e.message });
  }
});

// PUT - Update vehicleCessionCertificate
app.put(['/api/vehicle-cession-certificate/:id', '/vehicle-cession-certificate/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleCessionCertificate.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicleCessionCertificate:', e.message);
    res.status(500).json({ error: 'Failed to update vehicleCessionCertificate', details: e.message });
  }
});

// DELETE - Remove vehicleCessionCertificate
app.delete(['/api/vehicle-cession-certificate/:id', '/vehicle-cession-certificate/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicleCessionCertificate.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicleCessionCertificate:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicleCessionCertificate', details: e.message });
  }
});

// ============ VEHICLEGRAYSCALE CRUD ============

// GET - List all vehicleGrayscale
app.get(['/api/vehicle-grayscale', '/vehicle-grayscale'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicleGrayscale.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicleGrayscale:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleGrayscale', details: e.message });
  }
});

// GET - Get single vehicleGrayscale
app.get(['/api/vehicle-grayscale/:id', '/vehicle-grayscale/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleGrayscale.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicleGrayscale not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicleGrayscale:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleGrayscale', details: e.message });
  }
});

// POST - Create new vehicleGrayscale
app.post(['/api/vehicle-grayscale', '/vehicle-grayscale'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleGrayscale.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicleGrayscale:', e.message);
    res.status(500).json({ error: 'Failed to create vehicleGrayscale', details: e.message });
  }
});

// PUT - Update vehicleGrayscale
app.put(['/api/vehicle-grayscale/:id', '/vehicle-grayscale/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleGrayscale.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicleGrayscale:', e.message);
    res.status(500).json({ error: 'Failed to update vehicleGrayscale', details: e.message });
  }
});

// DELETE - Remove vehicleGrayscale
app.delete(['/api/vehicle-grayscale/:id', '/vehicle-grayscale/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicleGrayscale.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicleGrayscale:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicleGrayscale', details: e.message });
  }
});

// ============ VEHICLEINSURANCE CRUD ============

// GET - List all vehicleInsurance
app.get(['/api/vehicle-insurance', '/vehicle-insurance'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicleInsurance.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicleInsurance:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleInsurance', details: e.message });
  }
});

// GET - Get single vehicleInsurance
app.get(['/api/vehicle-insurance/:id', '/vehicle-insurance/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInsurance.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicleInsurance not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicleInsurance:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleInsurance', details: e.message });
  }
});

// POST - Create new vehicleInsurance
app.post(['/api/vehicle-insurance', '/vehicle-insurance'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInsurance.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicleInsurance:', e.message);
    res.status(500).json({ error: 'Failed to create vehicleInsurance', details: e.message });
  }
});

// PUT - Update vehicleInsurance
app.put(['/api/vehicle-insurance/:id', '/vehicle-insurance/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInsurance.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicleInsurance:', e.message);
    res.status(500).json({ error: 'Failed to update vehicleInsurance', details: e.message });
  }
});

// DELETE - Remove vehicleInsurance
app.delete(['/api/vehicle-insurance/:id', '/vehicle-insurance/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicleInsurance.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicleInsurance:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicleInsurance', details: e.message });
  }
});

// ============ VEHICLEINSPECTION CRUD ============

// GET - List all vehicleInspection
app.get(['/api/vehicle-inspection', '/vehicle-inspection'], requireAuth, async (req, res) => {
  try {
    const items = await prisma.vehicleInspection.findMany();
    res.json(items);
  } catch (e) {
    console.error('❌ Error getting vehicleInspection:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleInspection', details: e.message });
  }
});

// GET - Get single vehicleInspection
app.get(['/api/vehicle-inspection/:id', '/vehicle-inspection/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInspection.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ error: 'vehicleInspection not found' });
    res.json(item);
  } catch (e) {
    console.error('❌ Error getting vehicleInspection:', e.message);
    res.status(500).json({ error: 'Failed to fetch vehicleInspection', details: e.message });
  }
});

// POST - Create new vehicleInspection
app.post(['/api/vehicle-inspection', '/vehicle-inspection'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInspection.create({
      data: {
        id: uid(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('❌ Error creating vehicleInspection:', e.message);
    res.status(500).json({ error: 'Failed to create vehicleInspection', details: e.message });
  }
});

// PUT - Update vehicleInspection
app.put(['/api/vehicle-inspection/:id', '/vehicle-inspection/:id'], requireAuth, async (req, res) => {
  try {
    const item = await prisma.vehicleInspection.update({
      where: { id: req.params.id },
      data: { ...req.body, updatedAt: new Date() }
    });
    res.json(item);
  } catch (e) {
    console.error('❌ Error updating vehicleInspection:', e.message);
    res.status(500).json({ error: 'Failed to update vehicleInspection', details: e.message });
  }
});

// DELETE - Remove vehicleInspection
app.delete(['/api/vehicle-inspection/:id', '/vehicle-inspection/:id'], requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.vehicleInspection.delete({
      where: { id: req.params.id }
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    console.error('❌ Error deleting vehicleInspection:', e.message);
    res.status(500).json({ error: 'Failed to delete vehicleInspection', details: e.message });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Arrêt du serveur...');
  await safeDisconnectPrisma();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Arrêt du serveur (SIGTERM)...');
  await safeDisconnectPrisma();
  process.exit(0);
});
