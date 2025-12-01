import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLatestBackup } from '../backup-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 4000;
const pathRoot = process.cwd();

// PostgreSQL connection for data recovery (optional) - DÉSACTIVÉ
let pgClient = null;
let pgAvailable = false;
let postgresDataImported = false;  // Flag pour tracker si import déjà fait
const LOAD_FROM_BACKUP = true;  // ✅ Charger depuis backup au lieu de PostgreSQL

// Déterminer si on est sur Railway
const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME !== undefined;

// Try to load pg package dynamically
async function initPgClient() {
  // ✅ Mode local-only: désactiver PostgreSQL et utiliser uniquement les backups
  // Cela évite les conflits de synchronisation entre DB et serveur en mémoire
  console.log('📦 Mode LOCAL - Données serveur chargées depuis backup JSON');
  console.log('⚠️  PostgreSQL DÉSACTIVÉ - Les écritures ne persistent pas à chaque redémarrage');
  pgAvailable = false;
  return;
  
  /* Code PostgreSQL désactivé pour éviter les conflits de sync
  try {
    const { default: pg } = await import('pg');
    const { Client } = pg;
    
    // Utiliser l'URL interne si on est sur Railway, sinon l'URL publique
    let connectionConfig;
    
    if (isRailway) {
      // En production Railway: utiliser la connexion interne (plus rapide et sûre)
      connectionConfig = {
        host: process.env.DB_HOST || 'postgres.railway.internal',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
        database: process.env.DB_NAME || 'railway',
        ssl: false
      };
      console.log('🚀 Utilisation de la connexion PostgreSQL interne Railway');
    } else {
      // En développement local: utiliser le proxy public
      connectionConfig = {
        host: process.env.DB_HOST || 'yamanote.proxy.rlwy.net',
        port: process.env.DB_PORT || 18663,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
        database: process.env.DB_NAME || 'railway',
        ssl: false
      };
      console.log('💻 Utilisation de la connexion PostgreSQL publique');
    }
    
    pgClient = new Client(connectionConfig);
    pgAvailable = true;
    console.log('✅ Client PostgreSQL initialisé avec succès');
  } catch (error) {
    console.warn('⚠️  Paquet PostgreSQL non disponible:', error.message);
    pgAvailable = false;
  }
  */
}

// Initialize immediately
await initPgClient();

// In-memory stores (reconstruction). À migrer vers Prisma ensuite.
const state = {
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
  ],
  transactions: [],
  scheduled: [],
  expenseReports: [],
  events: [],
  members: [
    { id: 'm1', email: 'admin@rbe.test', firstName: 'Admin', lastName: 'RBE', status: 'active', permissions: ['drive_vehicles','access_myrbe'], createdAt: new Date().toISOString() }
  ],
  documents: [],
  devisLines: [],          // Lignes de devis
  quoteTemplates: [],      // Templates de devis
  financialDocuments: [],  // Documents financiers
  flashes: [
    { id: 'f1', title: 'Maintenance serveur', message: 'Redémarrage 02:00 CET', active: true, createdAt: new Date().toISOString() },
    { id: 'f2', title: 'Nouvelle page', message: 'Photothèque RBE', active: false, createdAt: new Date().toISOString() }
  ],
  retroNews: [
    { id: 'rn1', title: 'Bienvenue sur RétroBus', body: 'Plateforme reconstruite.', publishedAt: new Date().toISOString() }
  ],
  notifications: [
    { id: 'n1', type: 'info', message: 'Serveur API reconstruit', createdAt: new Date().toISOString(), read: false }
  ],
  vehicles: [
    { parc: 'RBE-001', marque: 'Renault', modele: 'Master', etat: 'disponible', fuel: 70, caracteristiques: [{ label: 'Niveau gasoil', value: '70' }] },
    { parc: 'RBE-002', marque: 'Iveco', modele: 'Daily', etat: 'maintenance', fuel: 45, caracteristiques: [] }
  ],
  vehicleUsages: [
    // { id, parc, startedAt, endedAt?, conducteur, note }
  ],
  vehicleMaintenance: [
    // { id, parc, type, description, cost, mileage, performedBy, location, status, date, nextDueDate }
  ],
  vehicleServiceSchedule: [
    // { id, parc, serviceType, description, frequency, priority, status, plannedDate }
  ],
  userPermissions: {}  // { userId: { permissions: [...], membershipType, linkedAt } }
};

// Helpers
const uid = () => (global.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`);
const today = () => new Date().toISOString().split('T')[0];

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

// Function to load data from backup
async function initializeFromBackup() {
  // ⚠️ Ne faire l'import qu'une seule fois au démarrage du serveur
  if (postgresDataImported) {
    console.log('📌 Données déjà chargées - conservées en mémoire');
    return;
  }
  
  try {
    console.log('🔄 Chargement des données depuis le backup...');
    
    const latestBackup = getLatestBackup();
    
    if (!latestBackup) {
      console.log('⚠️  Aucun backup trouvé - utilisation des données par défaut');
      return;
    }
    
    const backupDir = path.join(__dirname, '..', 'backups');
    const backupPath = path.join(backupDir, latestBackup.name, 'data.json');
    
    if (!fs.existsSync(backupPath)) {
      console.log('⚠️  Fichier de backup introuvable - utilisation des données par défaut');
      return;
    }
    
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    console.log(`✅ Backup chargé: ${latestBackup.name}`);
    
    // Load members
    if (backupData.tables.members?.data) {
      state.members = backupData.tables.members.data.map(m => ({
        id: m.id,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        status: m.membershipStatus || 'active',
        permissions: ['view_dashboard', 'view_vehicles'],
        createdAt: m.createdAt || new Date().toISOString()
      }));
      console.log(`   👥 ${state.members.length} membres restaurés`);
    }
    
    // Load vehicles
    if (backupData.tables.Vehicle?.data) {
      state.vehicles = backupData.tables.Vehicle.data.map(v => ({
        parc: v.parc,
        marque: v.marque,
        modele: v.modele,
        etat: v.etat,
        fuel: v.fuel || 0,
        caracteristiques: [{ label: 'Niveau carburant', value: String(v.fuel || 0) }],
        id: v.id,
        createdAt: v.createdAt || new Date().toISOString()
      }));
      console.log(`   🚌 ${state.vehicles.length} véhicules restaurés`);
    }
    
    // Load events
    if (backupData.tables.Event?.data) {
      state.events = backupData.tables.Event.data.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date,
        status: e.status,
        createdAt: e.createdAt || new Date().toISOString()
      }));
      console.log(`   📅 ${state.events.length} événements restaurés`);
    }
    
    // Load financial categories
    if (backupData.tables.finance_categories?.data && backupData.tables.finance_categories.data.length > 0) {
      state.categories = backupData.tables.finance_categories.data.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type || 'depense'
      }));
      console.log(`   💰 ${state.categories.length} catégories financières restaurées`);
    }
    
    // Load financial transactions
    if (backupData.tables.finance_transactions?.data) {
      state.transactions = backupData.tables.finance_transactions.data.map(t => ({
        id: t.id,
        category: t.category,
        type: t.type,
        amount: t.amount,
        description: t.description,
        date: t.date,
        createdAt: t.createdAt || new Date().toISOString()
      }));
      console.log(`   📊 ${state.transactions.length} transactions restaurées`);
    }
    
    // Load financial balance
    if (backupData.tables.finance_balances?.data?.length > 0) {
      state.bankBalance = backupData.tables.finance_balances.data[0].balance || 0;
      console.log(`   🏦 Solde: ${state.bankBalance}€`);
    }
    
    // Load expense reports
    if (backupData.tables.finance_expense_reports?.data) {
      state.expenseReports = backupData.tables.finance_expense_reports.data.map(e => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        status: e.status,
        date: e.date,
        createdAt: e.createdAt || new Date().toISOString()
      }));
      console.log(`   📋 ${state.expenseReports.length} rapports de dépenses restaurés`);
    }
    
    // Load user permissions (CRITICAL!)
    if (backupData.tables.user_permissions?.data) {
      backupData.tables.user_permissions.data.forEach(p => {
        if (!state.userPermissions[p.userId]) {
          state.userPermissions[p.userId] = { permissions: [] };
        }
        state.userPermissions[p.userId].permissions.push({
          id: p.id,
          resource: p.resource,
          actions: Array.isArray(p.actions) ? p.actions : (typeof p.actions === 'string' ? JSON.parse(p.actions) : []),
          grantedAt: p.grantedAt || p.createdAt
        });
      });
      console.log(`   🔐 ${Object.keys(state.userPermissions).length} utilisateurs avec permissions restaurés`);
    }
    
    // Load RetroNews
    if (backupData.tables.RetroNews?.data) {
      state.retroNews = backupData.tables.RetroNews.data.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        excerpt: n.excerpt,
        imageUrl: n.imageUrl,
        author: n.author,
        published: n.published,
        featured: n.featured,
        createdAt: n.createdAt || new Date().toISOString()
      }));
      console.log(`   📰 ${state.retroNews.length} actualités restaurées`);
    }
    
    // Load Flashes
    if (backupData.tables.Flash?.data) {
      state.flashes = backupData.tables.Flash.data.map(f => ({
        id: f.id,
        content: f.content,
        type: f.type,
        active: f.active,
        createdAt: f.createdAt || new Date().toISOString()
      }));
      console.log(`   ⚡ ${state.flashes.length} flashes restaurées`);
    }
    
    // Load Documents
    if (backupData.tables.Document?.data && backupData.tables.Document.data.length > 0) {
      state.documents = backupData.tables.Document.data.map(d => ({
        id: d.id,
        fileName: d.fileName,
        filePath: d.filePath,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        type: d.type,
        status: d.status,
        uploadedAt: d.uploadedAt || new Date().toISOString()
      }));
      console.log(`   📄 ${state.documents.length} documents restaurés`);
    }

    // Load Devis Lines
    if (backupData.tables.DevisLine?.data && backupData.tables.DevisLine.data.length > 0) {
      state.devisLines = backupData.tables.DevisLine.data;
      console.log(`   ✍️  ${state.devisLines.length} lignes de devis restaurées`);
    }

    // Load Quote Templates
    if (backupData.tables.QuoteTemplate?.data && backupData.tables.QuoteTemplate.data.length > 0) {
      state.quoteTemplates = backupData.tables.QuoteTemplate.data;
      console.log(`   📋 ${state.quoteTemplates.length} templates de devis restaurés`);
    }

    // Load Financial Documents
    if (backupData.tables.financial_documents?.data && backupData.tables.financial_documents.data.length > 0) {
      state.financialDocuments = backupData.tables.financial_documents.data;
      console.log(`   💰 ${state.financialDocuments.length} documents financiers restaurés`);
    }
    
    // Load Vehicle Maintenance
    if (backupData.tables.vehicle_maintenance?.data && backupData.tables.vehicle_maintenance.data.length > 0) {
      state.vehicleMaintenance = backupData.tables.vehicle_maintenance.data.map(m => ({
        id: m.id,
        vehicleId: m.vehicleId,
        type: m.type,
        description: m.description,
        cost: m.cost,
        status: m.status,
        date: m.date
      }));
      console.log(`   🔧 ${state.vehicleMaintenance.length} maintenances de véhicules restaurées`);
    }
    
    // Load Vehicle Service Schedule
    if (backupData.tables.vehicle_service_schedule?.data && backupData.tables.vehicle_service_schedule.data.length > 0) {
      state.vehicleServiceSchedule = backupData.tables.vehicle_service_schedule.data.map(s => ({
        id: s.id,
        vehicleId: s.vehicleId,
        serviceType: s.serviceType,
        description: s.description,
        frequency: s.frequency,
        status: s.status
      }));
      console.log(`   📅 ${state.vehicleServiceSchedule.length} services programmés restaurés`);
    }
    
    // Load site_users for memberId → site_users ID mapping
    if (backupData.tables.site_users?.data) {
      state.siteUsers = backupData.tables.site_users.data.map(u => ({
        id: u.id,
        linkedMemberId: u.linkedMemberId,
        email: u.email,
        role: u.role
      }));
      console.log(`   👤 ${state.siteUsers.length} utilisateurs site chargés`);
    }
    
    // ✅ Marquer l'import comme terminé
    postgresDataImported = true;
    console.log('✅ Initialisation depuis backup terminée - données verrouillées en mémoire');
    
  } catch (error) {
    console.error('❌ Erreur lors du chargement du backup:', error.message);
    console.log('📝 Utilisation des données par défaut en mémoire');
  }
}

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

// Public events endpoint
app.get('/public/events', (req, res) => {
  const publicEvents = state.events.filter(e => e.status === 'PUBLISHED').map(e => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date,
    status: e.status,
    createdAt: e.createdAt
  }));
  res.json(publicEvents);
});

app.get('/public/events/:id', (req, res) => {
  const event = state.events.find(e => e.id === req.params.id && e.status === 'PUBLISHED');
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
});

// Public vehicles endpoint
app.get('/public/vehicles', (req, res) => {
  const publicVehicles = state.vehicles.map(v => ({
    id: v.id || v.parc,
    parc: v.parc,
    marque: v.marque,
    modele: v.modele,
    etat: v.etat,
    fuel: v.fuel,
    caracteristiques: v.caracteristiques
  }));
  res.json(publicVehicles);
});

app.get('/public/vehicles/:id', (req, res) => {
  const vehicle = state.vehicles.find(v => v.id === req.params.id || v.parc === req.params.id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(vehicle);
});

app.get('/public/vehicles/:id/events', (req, res) => {
  // Return empty array for now - would need to link vehicles to events
  res.json([]);
});

// FLASHES
app.get(['/flashes','/api/flashes'], (req, res) => {
  res.json(state.flashes.filter(f => f.active));
});
app.get(['/flashes/all','/api/flashes/all'], (req, res) => {
  res.json(state.flashes);
});
app.post(['/flashes','/api/flashes'], requireAuth, (req, res) => {
  const { title, message, active = false } = req.body || {};
  const item = { id: 'f' + Date.now(), title, message, active: !!active, createdAt: new Date().toISOString() };
  state.flashes.unshift(item);
  res.status(201).json(item);
});
app.put(['/flashes/:id','/api/flashes/:id'], requireAuth, (req, res) => {
  const idx = state.flashes.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Flash introuvable' });
  state.flashes[idx] = { ...state.flashes[idx], ...req.body };
  res.json(state.flashes[idx]);
});
app.delete(['/flashes/:id','/api/flashes/:id'], requireAuth, (req, res) => {
  const before = state.flashes.length;
  state.flashes = state.flashes.filter(f => f.id !== req.params.id);
  if (before === state.flashes.length) return res.status(404).json({ error: 'Flash introuvable' });
  res.json({ ok: true });
});

// RETRO NEWS
app.get(['/api/retro-news','/retro-news'], (req, res) => {
  res.json({ news: state.retroNews });
});
app.post(['/api/retro-news','/retro-news'], requireAuth, (req, res) => {
  const item = { id: 'rn' + Date.now(), title: req.body?.title || 'News', body: req.body?.body || '', publishedAt: new Date().toISOString() };
  state.retroNews.unshift(item);
  res.status(201).json({ news: item });
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
  res.status(201).json({ notification: n });
});
app.post(['/api/notifications/:id/read','/notifications/:id/read'], requireAuth, (req, res) => {
  state.notifications = state.notifications.map(n => n.id === req.params.id ? { ...n, read: true } : n);
  const n = state.notifications.find(n => n.id === req.params.id);
  res.json({ notification: n });
});

// VEHICLES
app.get(['/vehicles','/api/vehicles'], requireAuth, (req, res) => {
  res.json({ vehicles: state.vehicles });
});
app.get(['/vehicles/:parc','/api/vehicles/:parc'], requireAuth, (req, res) => {
  const { parc } = req.params;
  const v = state.vehicles.find(v => v.parc === parc);
  if (!v) return res.status(404).json({ error: 'Vehicle not found' });
  res.json({ vehicle: v });
});
app.put(['/vehicles/:parc','/api/vehicles/:parc'], requireAuth, (req, res) => {
  const { parc } = req.params;
  state.vehicles = state.vehicles.map(v => (v.parc === parc ? { ...v, ...req.body } : v));
  const v = state.vehicles.find(v => v.parc === parc);
  res.json({ vehicle: v });
});
// Usages (historique pointages)
app.get(['/vehicles/:parc/usages','/api/vehicles/:parc/usages'], requireAuth, (req, res) => {
  const list = state.vehicleUsages.filter(u => u.parc === req.params.parc);
  res.json(list);
});
app.post(['/vehicles/:parc/usages','/api/vehicles/:parc/usages'], requireAuth, (req, res) => {
  const usage = { id: uid(), parc: req.params.parc, startedAt: new Date().toISOString(), conducteur: req.body?.conducteur || 'Conducteur', note: req.body?.note || '' };
  state.vehicleUsages.push(usage);
  res.status(201).json(usage);
});
app.post(['/vehicles/:parc/usages/:id/end','/api/vehicles/:parc/usages/:id/end'], requireAuth, (req, res) => {
  state.vehicleUsages = state.vehicleUsages.map(u => u.id === req.params.id ? { ...u, endedAt: new Date().toISOString() } : u);
  const u = state.vehicleUsages.find(u => u.id === req.params.id);
  res.json(u);
});
// Maintenance
app.get(['/vehicles/:parc/maintenance','/api/vehicles/:parc/maintenance'], requireAuth, (req, res) => {
  const list = state.vehicleMaintenance.filter(m => m.parc === req.params.parc);
  res.json(list);
});
app.post(['/vehicles/:parc/maintenance','/api/vehicles/:parc/maintenance'], requireAuth, (req, res) => {
  const item = { id: uid(), parc: req.params.parc, date: new Date().toISOString(), status: req.body?.status || 'completed', ...req.body };
  state.vehicleMaintenance.unshift(item);
  res.status(201).json(item);
});
// Service schedule
app.get(['/vehicles/:parc/service-schedule','/api/vehicles/:parc/service-schedule'], requireAuth, (req, res) => {
  const list = state.vehicleServiceSchedule.filter(s => s.parc === req.params.parc);
  res.json(list);
});
app.post(['/vehicles/:parc/service-schedule','/api/vehicles/:parc/service-schedule'], requireAuth, (req, res) => {
  const item = { id: uid(), parc: req.params.parc, status: 'pending', plannedDate: new Date().toISOString(), ...req.body };
  state.vehicleServiceSchedule.unshift(item);
  res.status(201).json(item);
});
// Maintenance summary
app.get(['/vehicles/:parc/maintenance-summary','/api/vehicles/:parc/maintenance-summary'], requireAuth, (req, res) => {
  const parc = req.params.parc;
  const maint = state.vehicleMaintenance.filter(m => m.parc === parc);
  const schedule = state.vehicleServiceSchedule.filter(s => s.parc === parc);
  const totalCost = maint.reduce((s,m)=> s + (Number(m.cost)||0),0);
  const maintenanceCount = maint.length;
  const overdueTasks = schedule.filter(s => s.status === 'overdue').length;
  const pendingTasks = schedule.filter(s => s.status === 'pending').length;
  res.json({ totalCost, maintenanceCount, overdueTasks, pendingTasks });
});
// Gallery / background placeholders
app.get(['/vehicles/:parc/gallery','/api/vehicles/:parc/gallery'], requireAuth, (req, res) => {
  res.json([]);
});
app.get(['/vehicles/:parc/background','/api/vehicles/:parc/background'], requireAuth, (req, res) => {
  res.json({ background: null });
});
app.get(['/vehicles/:parc/reports','/api/vehicles/:parc/reports'], requireAuth, (req, res) => {
  // Return expense reports potentially related to this vehicle
  res.json({ reports: state.expenseReports.filter(r => r.parc === req.params.parc || !r.parc) });
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
  res.status(201).json({ member });
});
app.put(['/api/members','/members'], requireAuth, (req, res) => {
  const { id } = req.body;
  state.members = state.members.map(m => m.id === id ? { ...m, ...req.body } : m);
  const member = state.members.find(m => m.id === id);
  res.json({ member });
});
app.patch(['/api/members','/members'], requireAuth, (req, res) => {
  const { id } = req.body;
  state.members = state.members.map(m => m.id === id ? { ...m, ...req.body } : m);
  const member = state.members.find(m => m.id === id);
  res.json({ member });
});
app.delete(['/api/members','/members'], requireAuth, (req, res) => {
  const { id } = req.body;
  state.members = state.members.filter(m => m.id !== id);
  res.json({ ok: true });
});
app.post('/api/members/change-password', requireAuth, (req, res) => {
  res.json({ ok: true });
});
app.post('/api/members/:id/terminate', requireAuth, (req, res) => {
  const { id } = req.params;
  state.members = state.members.map(m => m.id === id ? { ...m, status: 'terminated' } : m);
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
    m.id === id ? { ...m, permissions: Array.isArray(permissions) ? permissions : [] } : m
  );
  
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
  res.json({ ok: true });
});
app.put('/api/documents/:id/status', requireAuth, (req, res) => {
  const { id } = req.params; const { status } = req.body;
  state.documents = state.documents.map(d => d.id === id ? { ...d, status } : d);
  const doc = state.documents.find(d => d.id === id);
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
app.post(['/events', '/api/events'], requireAuth, (req, res) => {
  const ev = { id: uid(), status: 'draft', createdAt: today(), ...req.body };
  state.events.push(ev);
  res.status(201).json({ event: ev });
});
app.put(['/events/:id', '/api/events/:id'], requireAuth, (req, res) => {
  state.events = state.events.map(e => e.id === req.params.id ? { ...e, ...req.body } : e);
  const ev = state.events.find(e => e.id === req.params.id);
  res.json({ event: ev });
});
app.delete(['/events/:id', '/api/events/:id'], requireAuth, (req, res) => {
  state.events = state.events.filter(e => e.id !== req.params.id);
  res.json({ ok: true });
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
  res.status(201).json(op);
});
app.put(['/finance/scheduled-expenses/:id', '/api/finance/scheduled-expenses/:id'], requireAuth, (req, res) => {
  state.scheduled = state.scheduled.map(o => o.id === req.params.id ? { ...o, ...req.body } : o);
  const op = state.scheduled.find(o => o.id === req.params.id);
  res.json(op);
});
app.delete(['/finance/scheduled-expenses/:id', '/api/finance/scheduled-expenses/:id'], requireAuth, (req, res) => {
  state.scheduled = state.scheduled.filter(o => o.id !== req.params.id);
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
  res.status(201).json(tx);
});
app.put('/finance/transactions/:id', requireAuth, (req, res) => {
  state.transactions = state.transactions.map(t => t.id === req.params.id ? { ...t, ...req.body } : t);
  const tx = state.transactions.find(t => t.id === req.params.id);
  res.json(tx);
});
app.delete('/finance/transactions/:id', requireAuth, (req, res) => {
  state.transactions = state.transactions.filter(t => t.id !== req.params.id);
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
  res.status(201).json({ report });
});
app.put('/finance/expense-reports/:id', requireAuth, (req, res) => {
  state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, ...req.body } : r);
  const report = state.expenseReports.find(r => r.id === req.params.id);
  res.json({ report });
});
app.post('/finance/expense-reports/:id/close', requireAuth, (req, res) => {
  state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, status: 'closed', closedAt: new Date().toISOString() } : r);
  const report = state.expenseReports.find(r => r.id === req.params.id);
  res.json({ report });
});
app.post('/finance/expense-reports/:id/reimburse', requireAuth, (req, res) => {
  state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, status: 'reimbursed', reimbursedAt: new Date().toISOString() } : r);
  const report = state.expenseReports.find(r => r.id === req.params.id);
  res.json({ report });
});
app.post('/finance/expense-reports/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  state.expenseReports = state.expenseReports.map(r => r.id === req.params.id ? { ...r, status } : r);
  const report = state.expenseReports.find(r => r.id === req.params.id);
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
  res.json({ documents: state.documents || [] });
});

// Quote templates endpoint (returns empty array - stored locally in frontend)
app.get('/api/quote-templates', requireAuth, (req, res) => {
  res.json([]);
});
app.post('/api/quote-templates', requireAuth, (req, res) => {
  const template = { id: uid(), ...req.body };
  res.status(201).json(template);
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

// Generic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`API reconstruction server running on port ${PORT}`);
  // Initialize data from backup (with permissions)
  await initializeFromBackup();
});
