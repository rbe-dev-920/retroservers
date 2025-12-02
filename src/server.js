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

// ============================================================
// 🔧 INITIALISATION PRISMA avec détection d'erreur
// ============================================================
let prisma = null;
let prismaAvailable = false;

try {
  prisma = new PrismaClient();
  // Test rapide de connexion
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:') || dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    prismaAvailable = true;
    console.log('✅ Prisma initialisé - DATABASE_URL valide');
  } else {
    console.warn('⚠️  DATABASE_URL invalide ou manquante - mode mémoire activé');
    prismaAvailable = false;
  }
} catch (e) {
  console.warn('⚠️  Prisma non disponible:', e.message);
  prismaAvailable = false;
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
console.log('   🚀 RÉTROBUS ESSONNE - SERVEUR API');
console.log('   📦 Mode:', prismaAvailable ? 'HYBRIDE (Prisma + Mémoire)' : 'MÉMOIRE SEULE');
console.log('   ✅', prismaAvailable ? 'Données persistées via Prisma' : 'Données en mémoire uniquement');
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

// ============================================================
// 💾 CHARGEMENT DU BACKUP AU DÉMARRAGE
// ============================================================
function loadBackupAtStartup() {
  try {
    const backupDir = path.join(pathRoot, 'backups');
    
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
      state.events = tables.Event.data;
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

// Charger le backup au démarrage
loadBackupAtStartup();

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

// Auth placeholder
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    req.user = { id: 'user', role: 'admin' }; // stub
  }
  next();
});

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// Health & version
app.get(['/api/health','/health'], (req, res) => res.json({ ok: true, time: new Date().toISOString(), version: 'rebuild-1' }));

// AUTH
app.post(['/auth/login','/api/auth/login'], (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email & password requis' });
  const member = state.members.find(m => m.email === email) || state.members[0];
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
app.get(['/auth/me','/api/auth/me'], requireAuth, (req, res) => {
  const member = state.members[0] || null;
  if (!member) {
    return res.json({ user: null });
  }
  
  // Find user's role from site_users via linkedMemberId
  let role = 'MEMBER'; // default
  if (state.siteUsers && member.id) {
    const siteUser = state.siteUsers.find(u => u.linkedMemberId === member.id);
    if (siteUser) {
      role = siteUser.role || 'MEMBER';
    }
  }
  
  res.json({ user: { id: member.id, email: member.email, role: role, permissions: member.permissions || [] } });
});

// Session validation - /api/me endpoint
app.get('/api/me', requireAuth, (req, res) => {
  const member = state.members[0] || null;
  if (!member) {
    return res.json({ user: null });
  }

  // Try to find the user's site_users record to get the role
  let role = 'MEMBER'; // default
  if (state.siteUsers && member.id) {
    const siteUser = state.siteUsers.find(u => u.linkedMemberId === member.id);
    if (siteUser) {
      role = siteUser.role || 'MEMBER';
    }
  }

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
app.get('/site-config', (req, res) => {
  res.json({
    siteName: 'RétroBus Essonne',
    siteURL: 'https://association-rbe.fr',
    apiURL: 'https://attractive-kindness-rbe-serveurs.up.railway.app',
    logo: '/assets/logo.png',
    description: 'Association RétroBus Essonne - Patrimoine automobile et mobilité douce'
  });
});

// Public events endpoint - PRISMA avec fallback
app.get('/public/events', async (req, res) => {
  try {
    if (prismaAvailable) {
      const events = await prisma.event.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { date: 'desc' }
      });
      return res.json(events);
    }
  } catch (e) {
    console.error('Erreur GET /public/events (Prisma):', e.message);
  }
  // Fallback: retourner depuis state
  const events = (state.events || []).filter(e => e.status === 'PUBLISHED');
  res.json(events);
});

app.get('/public/events/:id', async (req, res) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, status: 'PUBLISHED' }
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (e) {
    console.error('Erreur GET /public/events/:id (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Public vehicles endpoint - avec fallback en mémoire
app.get('/public/vehicles', async (req, res) => {
  try {
    if (prismaAvailable) {
      const vehicles = await prisma.vehicle.findMany();
      return res.json(vehicles);
    }
  } catch (e) {
    console.error('Erreur GET /public/vehicles (Prisma):', e.message);
  }
  // Fallback: retourner depuis state
  res.json(state.vehicles || []);
});

app.get('/public/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { OR: [{ id: parseInt(req.params.id) || 0 }, { parc: req.params.id }] }
    });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (e) {
    console.error('Erreur GET /public/vehicles/:id (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/public/vehicles/:id/events', async (req, res) => {
  // Return empty array for now - would need to link vehicles to events
  res.json([]);
});

// Internal events endpoints (requireAuth) - PRISMA avec fallback
app.get(['/events','/api/events'], requireAuth, async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ events });
  } catch (e) {
    console.error('Erreur GET /events (Prisma):', e.message);
    res.json({ events: [] });
  }
});

app.get(['/events/:id','/api/events/:id'], requireAuth, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id }
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (e) {
    console.error('Erreur GET /events/:id (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

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
app.get(['/api/retro-news','/retro-news'], async (req, res) => {
  try {
    const news = await prisma.retroNews.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ news });
  } catch (e) {
    console.error('Erreur GET /retro-news (Prisma):', e.message);
    res.json({ news: state.retroNews || [] });
  }
});

app.post(['/api/retro-news','/retro-news'], requireAuth, async (req, res) => {
  try {
    const news = await prisma.retroNews.create({
      data: {
        title: req.body?.title || 'News',
        body: req.body?.body || '',
        status: 'published',
        publishedAt: new Date()
      }
    });
    console.log('✅ RetroNews créé:', news.id);
    res.status(201).json({ news });
  } catch (e) {
    console.error('Erreur POST /retro-news (Prisma):', e.message);
    // Fallback: créer en mémoire
    const item = { id: 'rn' + Date.now(), title: req.body?.title || 'News', body: req.body?.body || '', publishedAt: new Date().toISOString() };
    state.retroNews.unshift(item);
    res.status(201).json({ news: item });
  }
});

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

// VEHICLES - PRISMA avec fallback
app.get(['/vehicles','/api/vehicles'], requireAuth, async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany();
    res.json({ vehicles });
  } catch (e) {
    console.error('Erreur GET /vehicles (Prisma):', e.message);
    res.json({ vehicles: [] });
  }
});

app.get(['/vehicles/:parc','/api/vehicles/:parc'], requireAuth, async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { parc: req.params.parc }
    });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ vehicle });
  } catch (e) {
    console.error('Erreur GET /vehicles/:parc (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put(['/vehicles/:parc','/api/vehicles/:parc'], requireAuth, async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.update({
      where: { parc: req.params.parc },
      data: req.body
    });
    console.log('✅ Vehicle modifié:', vehicle.parc);
    res.json({ vehicle });
  } catch (e) {
    console.error('Erreur PUT /vehicles/:parc (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Usages (historique pointages) - PRISMA avec fallback
app.get(['/vehicles/:parc/usages','/api/vehicles/:parc/usages'], requireAuth, async (req, res) => {
  try {
    const usages = await prisma.vehicleUsage.findMany({
      where: { parc: req.params.parc },
      orderBy: { startedAt: 'desc' }
    });
    res.json(usages);
  } catch (e) {
    console.error('Erreur GET usages (Prisma):', e.message);
    res.json([]);
  }
});

app.post(['/vehicles/:parc/usages','/api/vehicles/:parc/usages'], requireAuth, async (req, res) => {
  try {
    const usage = await prisma.vehicleUsage.create({
      data: {
        parc: req.params.parc,
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
    const usage = await prisma.vehicleUsage.update({
      where: { id: req.params.id },
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
    const maintenance = await prisma.vehicleMaintenance.findMany({
      where: { parc: req.params.parc },
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
    const item = await prisma.vehicleMaintenance.create({
      data: {
        parc: req.params.parc,
        type: req.body?.type,
        description: req.body?.description,
        cost: req.body?.cost ? parseFloat(req.body.cost) : 0,
        status: req.body?.status || 'completed'
      }
    });
    console.log('✅ Maintenance créée:', item.id);
    res.status(201).json(item);
  } catch (e) {
    console.error('Erreur POST maintenance (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Service schedule - PRISMA avec fallback
app.get(['/vehicles/:parc/service-schedule','/api/vehicles/:parc/service-schedule'], requireAuth, async (req, res) => {
  try {
    const schedule = await prisma.vehicleServiceSchedule.findMany({
      where: { parc: req.params.parc },
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
    const item = await prisma.vehicleServiceSchedule.create({
      data: {
        parc: req.params.parc,
        serviceType: req.body?.serviceType,
        description: req.body?.description,
        frequency: req.body?.frequency,
        priority: req.body?.priority || 'normal',
        status: 'pending',
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
    const maintenance = await prisma.vehicleMaintenance.findMany({ where: { parc } });
    const schedule = await prisma.vehicleServiceSchedule.findMany({ where: { parc } });
    
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
app.get(['/vehicles/:parc/ct','/api/vehicles/:parc/ct'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const cts = state.vehicleControleTechnique.filter(c => c.parc === parc).sort((a, b) => new Date(b.ctDate) - new Date(a.ctDate));
  const latest = cts[0];
  
  if (!latest) return res.json({ parc, ctHistory: [], latestCT: null });
  
  res.json({ parc, ctHistory: cts, latestCT: latest });
});

app.post(['/vehicles/:parc/ct','/api/vehicles/:parc/ct'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const { attestationPath, ctDate, ctStatus, nextCtDate, mileage, notes } = req.body;
  
  const ct = {
    id: uid(),
    parc,
    attestationPath,
    ctDate: ctDate || new Date().toISOString(),
    ctStatus: ctStatus || 'passed', // 'passed' | 'contre-visite' | 'failed'
    nextCtDate: nextCtDate || null,
    mileage: mileage || null,
    notes: notes || ''
  };
  
  state.vehicleControleTechnique.push(ct);
  debouncedSave();
  res.status(201).json(ct);
});

// CERTIFICAT DE CESSION (une seule fois)
app.get(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const cert = state.vehicleCertificatCession.find(c => c.parc === parc);
  res.json(cert || { parc, certificatPath: null, dateImport: null, notes: '', imported: false });
});

app.post(['/vehicles/:parc/certificat-cession','/api/vehicles/:parc/certificat-cession'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  
  // Vérifier si déjà importé
  const existing = state.vehicleCertificatCession.find(c => c.parc === parc);
  if (existing && existing.imported) {
    return res.status(400).json({ error: 'Certificate already imported for this vehicle' });
  }
  
  const { certificatPath, notes } = req.body;
  let cert = existing || { id: uid(), parc };
  
  cert.certificatPath = certificatPath;
  cert.dateImport = new Date().toISOString();
  cert.notes = notes || '';
  cert.imported = true;
  
  if (!existing) state.vehicleCertificatCession.push(cert);
  
  debouncedSave();
  res.json(cert);
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
app.get(['/api/retro-requests'], requireAuth, (req, res) => {
  // Map RetroNews to retro-requests format
  const requests = state.retroNews.map(news => ({
    id: news.id,
    title: news.title,
    body: news.body,
    status: news.status || 'draft',
    createdAt: news.publishedAt || news.createdAt,
    author: news.author || 'anonyme',
    type: 'news'
  }));
  res.json(requests);
});

app.get(['/api/retro-requests/admin/all'], requireAuth, (req, res) => {
  // Return all retro requests with admin metadata
  const requests = state.retroNews.map(news => ({
    id: news.id,
    title: news.title,
    body: news.body,
    status: news.status || 'draft',
    createdAt: news.publishedAt || news.createdAt,
    author: news.author || 'anonyme',
    type: 'news',
    adminOnly: true
  }));
  res.json(requests);
});

app.post(['/api/retro-requests'], requireAuth, (req, res) => {
  const request = {
    id: uid(),
    title: req.body.title,
    body: req.body.body,
    status: req.body.status || 'draft',
    author: req.body.author || req.user?.id || 'anonyme',
    createdAt: new Date().toISOString(),
    type: 'news'
  };
  state.retroNews.push(request);
  debouncedSave();
  res.status(201).json(request);
});

app.put(['/api/retro-requests/:id'], requireAuth, (req, res) => {
  const idx = state.retroNews.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });
  
  state.retroNews[idx] = {
    ...state.retroNews[idx],
    title: req.body.title || state.retroNews[idx].title,
    body: req.body.body || state.retroNews[idx].body,
    status: req.body.status || state.retroNews[idx].status,
    author: req.body.author || state.retroNews[idx].author,
    updatedAt: new Date().toISOString()
  };
  debouncedSave();
  res.json(state.retroNews[idx]);
});

app.delete(['/api/retro-requests/:id'], requireAuth, (req, res) => {
  state.retroNews = state.retroNews.filter(r => r.id !== req.params.id);
  debouncedSave();
  res.json({ ok: true });
});

app.post(['/api/retro-requests/:id/status'], requireAuth, (req, res) => {
  const idx = state.retroNews.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });
  
  state.retroNews[idx].status = req.body.status;
  debouncedSave();
  res.json({ ok: true, news: state.retroNews[idx] });
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
app.get(['/api/members','/members'], requireAuth, (req, res) => {
  const limit = Number(req.query.limit || state.members.length);
  return res.json({ members: state.members.slice(0, limit) });
});
app.get(['/api/members/me'], requireAuth, (req, res) => {
  // stub current member from token
  const m = state.members[0] || null;
  return res.json({ member: m });
});
app.post(['/api/members','/members'], requireAuth, (req, res) => {
  const member = { id: uid(), status: 'active', createdAt: new Date().toISOString(), ...req.body };
  state.members.push(member);
  debouncedSave();
  res.status(201).json({ member });
});
app.put(['/api/members','/members'], requireAuth, (req, res) => {
  const { id } = req.body;
  state.members = state.members.map(m => m.id === id ? { ...m, ...req.body, updatedAt: new Date().toISOString() } : m);
  const member = state.members.find(m => m.id === id);
  debouncedSave();
  console.log(`✅ Adhérent ${id} modifié et sauvegardé`);
  res.json({ member });
});
app.patch(['/api/members','/members'], requireAuth, (req, res) => {
  const { id } = req.body;
  state.members = state.members.map(m => m.id === id ? { ...m, ...req.body, updatedAt: new Date().toISOString() } : m);
  const member = state.members.find(m => m.id === id);
  debouncedSave();
  console.log(`✅ Adhérent ${id} patchié et sauvegardé`);
  res.json({ member });
});
app.delete(['/api/members','/members'], requireAuth, (req, res) => {
  const { id } = req.body;
  state.members = state.members.filter(m => m.id !== id);
  debouncedSave();
  console.log(`✅ Adhérent ${id} supprimé et sauvegardé`);
  res.json({ ok: true });
});
app.post('/api/members/change-password', requireAuth, (req, res) => {
  res.json({ ok: true });
});
app.post('/api/members/:id/terminate', requireAuth, (req, res) => {
  const { id } = req.params;
  state.members = state.members.map(m => m.id === id ? { ...m, status: 'terminated', updatedAt: new Date().toISOString() } : m);
  debouncedSave();
  console.log(`✅ Adhérent ${id} terminé et sauvegardé`);
  res.json({ ok: true });
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
app.get('/api/members/:id', requireAuth, (req, res) => {
  const member = state.members.find(m => m.id === req.params.id);
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }
  res.json(member);
});

// PUT /api/members/:id - Update member
app.put(['/api/members/:id', '/members/:id'], requireAuth, (req, res) => {
  const { id } = req.params;
  const memberIndex = state.members.findIndex(m => m.id === id);
  
  if (memberIndex === -1) {
    return res.status(404).json({ error: 'Member not found' });
  }
  
  // Update member with provided data
  const updatedMember = {
    ...state.members[memberIndex],
    ...req.body,
    id: id, // Don't allow changing ID
    updatedAt: new Date().toISOString()
  };
  
  state.members[memberIndex] = updatedMember;
  
  // ✅ Sauvegarder les changements en persistant le backup
  debouncedSave();
  
  console.log(`✅ Adhérent ${id} mis à jour et sauvegardé`);
  
  res.json({ success: true, member: updatedMember });
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
app.put('/api/members/:id/permissions', requireAuth, (req, res) => {
  const { id } = req.params;
  const { permissions = [], membershipType } = req.body || {};
  
  const member = state.members.find(m => m.id === id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  
  // Update in state
  if (!state.userPermissions) state.userPermissions = {};
  
  state.userPermissions[id] = {
    id,
    email: member.email,
    membershipType: membershipType || member.membershipType || 'STANDARD',
    permissions: Array.isArray(permissions) ? permissions : [],
    linkedAt: state.userPermissions[id]?.linkedAt || member.createdAt,
    lastModified: new Date().toISOString()
  };
  
  // Also update member permissions
  state.members = state.members.map(m => 
    m.id === id ? { ...m, permissions: Array.isArray(permissions) ? permissions : [], updatedAt: new Date().toISOString() } : m
  );
  
  // ✅ Sauvegarder les changements
  debouncedSave();
  
  res.json({ 
    ok: true, 
    message: 'Permissions mises à jour',
    userPermissions: state.userPermissions[id]
  });
});

// POST add permission to member
app.post('/api/members/:id/permissions', requireAuth, (req, res) => {
  const { id } = req.params;
  const { resource, actions = ['READ'], expiresAt } = req.body || {};
  
  if (!resource) return res.status(400).json({ error: 'Resource required' });
  
  const member = state.members.find(m => m.id === id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  
  if (!state.userPermissions) state.userPermissions = {};
  if (!state.userPermissions[id]) {
    state.userPermissions[id] = {
      id,
      email: member.email,
      membershipType: member.membershipType || 'STANDARD',
      permissions: [],
      linkedAt: member.createdAt,
      lastModified: new Date().toISOString()
    };
  }
  
  // Add or update permission
  const permIndex = state.userPermissions[id].permissions.findIndex(p => p.resource === resource);
  const newPerm = { resource, actions, expiresAt };
  
  if (permIndex >= 0) {
    state.userPermissions[id].permissions[permIndex] = newPerm;
  } else {
    state.userPermissions[id].permissions.push(newPerm);
  }
  
  state.userPermissions[id].lastModified = new Date().toISOString();
  
  debouncedSave();
  res.json({ 
    ok: true, 
    message: 'Permission ajoutée',
    userPermissions: state.userPermissions[id]
  });
});

// DELETE permission from member
app.delete('/api/members/:id/permissions/:resource', requireAuth, (req, res) => {
  const { id, resource } = req.params;
  
  if (!state.userPermissions?.[id]) {
    return res.status(404).json({ error: 'User permissions not found' });
  }
  
  state.userPermissions[id].permissions = state.userPermissions[id].permissions.filter(
    p => p.resource !== resource
  );
  state.userPermissions[id].lastModified = new Date().toISOString();
  
  debouncedSave();
  res.json({ 
    ok: true, 
    message: 'Permission supprimée',
    userPermissions: state.userPermissions[id]
  });
});

// PERMISSIONS ENDPOINT - Lookup user role and permissions by memberId or userId
// Must come BEFORE the /api/user-permissions/:id endpoint with requireAuth
// because Express matches routes in order and both patterns match
app.get('/api/user-permissions/:userId', (req, res) => {
  const userId = req.params.userId;
  console.log(`🔍 Recherche permissions pour userId: ${userId}`);
  
  // Try direct lookup first (if userId is a site_users ID)
  let userPerms = state.userPermissions[userId];
  let siteUser = null;
  
  // If not found, try to find via linkedMemberId in site_users
  // This handles the case where userId is a memberId
  if (!userPerms && state.siteUsers) {
    console.log(`   🔄 Recherche dans site_users avec linkedMemberId...`);
    siteUser = state.siteUsers.find(u => u.linkedMemberId === userId);
    if (siteUser) {
      console.log(`   ✅ Trouvé site_user: ${siteUser.id}`);
      userPerms = state.userPermissions[siteUser.id];
    }
  }
  
  // If no permissions found, return empty with MEMBER role
  if (!userPerms || !userPerms.permissions || userPerms.permissions.length === 0) {
    console.log(`   ❌ Aucune permission trouvée - rôle par défaut: MEMBER`);
    return res.json({ permissions: [], role: 'MEMBER' });
  }
  
  // Build permissions array with resource + actions
  const permissions = userPerms.permissions.map(p => ({
    resource: p.resource,
    actions: p.actions
  }));
  
  // Determine role from permissions: if has ADMIN action in any resource, role is ADMIN
  const hasAdminPerms = userPerms.permissions.some(p => 
    p.actions.includes('ADMIN') || p.resource === 'admin'
  );
  
  const role = siteUser?.role || (hasAdminPerms ? 'ADMIN' : 'MEMBER');
  
  console.log(`   ✅ Permissions trouvées: ${permissions.length}, rôle: ${role}`);
  
  res.json({ permissions, role });
});

// GET all user permissions (admin endpoint)
app.get('/api/user-permissions', requireAuth, (req, res) => {
  const allPerms = Object.values(state.userPermissions || {});
  res.json(allPerms);
});

// DOCUMENTS
app.get('/api/documents/member/:memberId', requireAuth, (req, res) => {
  const list = state.documents.filter(d => d.memberId === req.params.memberId);
  res.json({ documents: list });
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

// EVENTS
app.get(['/events', '/api/events'], requireAuth, (req, res) => {
  res.json({ events: state.events });
});
app.get(['/events/:id', '/api/events/:id'], requireAuth, (req, res) => {
  const ev = state.events.find(e => e.id === req.params.id);
  if (!ev) return res.status(404).json({ error: 'Not found' });
  res.json({ event: ev });
});
// EVENTS CRUD - PRISMA avec fallback
app.post(['/events', '/api/events'], requireAuth, async (req, res) => {
  try {
    const event = await prisma.event.create({
      data: {
        title: req.body.title || 'Nouvel événement',
        description: req.body.description,
        date: req.body.date ? new Date(req.body.date) : null,
        status: req.body.status || 'DRAFT',
        extras: req.body.extras ? JSON.stringify(req.body.extras) : null
      }
    });
    console.log('✅ Event créé:', event.id, event.title);
    res.status(201).json({ event });
  } catch (e) {
    console.error('Erreur POST /events (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put(['/events/:id', '/api/events/:id'], requireAuth, async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.date) updateData.date = new Date(updateData.date);
    if (updateData.extras && typeof updateData.extras === 'object') {
      updateData.extras = JSON.stringify(updateData.extras);
    }
    
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: updateData
    });
    console.log('✅ Event modifié:', event.id, event.title);
    res.json({ event });
  } catch (e) {
    console.error('Erreur PUT /events/:id (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
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
    console.error('Erreur DELETE /events/:id (Prisma):', e.message);
    res.status(500).json({ error: 'Database error' });
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
app.get('/api/admin/users', requireAuth, (req, res) => {
  const users = state.members.map(m => ({
    id: m.id,
    email: m.email,
    firstName: m.firstName,
    lastName: m.lastName,
    status: m.status || 'active',
    permissions: m.permissions || [],
    createdAt: m.createdAt
  }));
  res.json(users);
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
// POST /api/admin/users/:userId/make-admin - Grant admin permissions to a user
app.post('/api/admin/users/:userId/make-admin', requireAuth, (req, res) => {
  const { userId } = req.params;
  
  console.log(`👤 Admin promotion request for user: ${userId}`);
  
  // Find the site_users entry for this memberId
  let siteUser = null;
  if (state.siteUsers) {
    siteUser = state.siteUsers.find(u => u.linkedMemberId === userId || u.id === userId);
  }
  
  if (!siteUser) {
    return res.status(400).json({ error: 'User not found in site_users' });
  }
  
  // Define admin resources
  const adminResources = ['members', 'vehicles', 'events', 'finance', 'transactions', 'reports', 'permissions', 'users', 'news', 'documents', 'maintenance', 'admin'];
  const adminActions = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ADMIN'];
  
  // Create permission records for this user
  state.userPermissions[siteUser.id] = { 
    permissions: adminResources.map(resource => ({
      id: uid(),
      resource: resource,
      actions: adminActions,
      grantedAt: new Date().toISOString(),
      grantedBy: 'api'
    }))
  };
  
  // Update role in siteUsers
  siteUser.role = 'ADMIN';
  
  debouncedSave();
  console.log(`✅ Admin permissions granted to ${siteUser.firstName} ${siteUser.lastName}`);
  
  res.json({
    success: true,
    message: `Admin permissions granted to user ${userId}`,
    user: {
      id: siteUser.id,
      linkedMemberId: siteUser.linkedMemberId,
      firstName: siteUser.firstName,
      lastName: siteUser.lastName,
      role: 'ADMIN'
    }
  });
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
    console.error('Erreur lecture échéancier:', e);
    res.status(500).json({ error: e.message });
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
    console.error('Erreur lecture échéancier global:', e);
    res.status(500).json({ error: e.message });
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
        dueDate,
        dueTime,
        priority: priority || 'normal',
        status: 'pending',
        notes
      }
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('Erreur création ligne échéancier:', e);
    res.status(500).json({ error: e.message });
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
    console.error('Erreur mise à jour échéancier:', e);
    res.status(500).json({ error: e.message });
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Arrêt du serveur...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Arrêt du serveur (SIGTERM)...');
  await prisma.$disconnect();
  process.exit(0);
});
