import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 4000;
const pathRoot = process.cwd();

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
  ]
};

// Helpers
const uid = () => (global.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`);
const today = () => new Date().toISOString().split('T')[0];

// CORS strict (Railway + domaine prod + dev local)
const allowedOrigins = [
  'https://www.retrobus-interne.fr',
  'https://retrobus-interne.fr',
  'https://attractive-kindness-rbe-serveurs.up.railway.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, origin || true);
    return cb(new Error('CORS bloque: origine non autorisée'));
  },
  credentials: true,
  allowedHeaders: ['Authorization','Content-Type','Accept'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS']
}));
// Préflight OPTIONS (compat Express 5 sans pattern *)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
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
  // Stub: toujours OK
  const token = 'stub.' + Buffer.from(email).toString('base64');
  res.json({ token, user: { id: member.id, email: member.email, firstName: member.firstName, permissions: member.permissions || [] } });
});
app.get(['/auth/me','/api/auth/me'], requireAuth, (req, res) => {
  const member = state.members[0] || null;
  res.json({ user: member ? { id: member.id, email: member.email, permissions: member.permissions || [] } : null });
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
  res.json({ ok: true, link: `https://example.com/access/${req.params.id}` });
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
app.get('/events', requireAuth, (req, res) => {
  res.json({ events: state.events });
});
app.get('/events/:id', requireAuth, (req, res) => {
  const ev = state.events.find(e => e.id === req.params.id);
  if (!ev) return res.status(404).json({ error: 'Not found' });
  res.json({ event: ev });
});
app.post('/events', requireAuth, (req, res) => {
  const ev = { id: uid(), status: 'draft', createdAt: today(), ...req.body };
  state.events.push(ev);
  res.status(201).json({ event: ev });
});
app.put('/events/:id', requireAuth, (req, res) => {
  state.events = state.events.map(e => e.id === req.params.id ? { ...e, ...req.body } : e);
  const ev = state.events.find(e => e.id === req.params.id);
  res.json({ event: ev });
});
app.delete('/events/:id', requireAuth, (req, res) => {
  state.events = state.events.filter(e => e.id !== req.params.id);
  res.json({ ok: true });
});

// FINANCE
app.get('/finance/stats', requireAuth, (req, res) => {
  const revenue = state.transactions.filter(t => t.type === 'recette').reduce((s,t)=>s+t.amount,0);
  const expenses = state.transactions.filter(t => t.type === 'depense').reduce((s,t)=>s+t.amount,0);
  res.json({ data: { monthlyRevenue: revenue, monthlyExpenses: expenses, currentBalance: state.bankBalance, membershipRevenue: 0, activeMembers: state.members.length, revenueGrowth: 0 } });
});
app.get('/finance/bank-balance', requireAuth, (req, res) => {
  res.json({ data: { balance: state.bankBalance } });
});
app.post('/finance/bank-balance', requireAuth, (req, res) => {
  state.bankBalance = Number(req.body.balance || 0);
  res.json({ data: { balance: state.bankBalance } });
});

// Scheduled expenses
app.get('/finance/scheduled-expenses', requireAuth, (req, res) => {
  const { eventId } = req.query;
  let list = state.scheduled;
  if (eventId) list = list.filter(x => x.eventId === eventId);
  res.json({ operations: list });
});
app.post('/finance/scheduled-expenses', requireAuth, (req, res) => {
  const op = { id: uid(), ...req.body };
  state.scheduled.push(op);
  res.status(201).json(op);
});
app.put('/finance/scheduled-expenses/:id', requireAuth, (req, res) => {
  state.scheduled = state.scheduled.map(o => o.id === req.params.id ? { ...o, ...req.body } : o);
  const op = state.scheduled.find(o => o.id === req.params.id);
  res.json(op);
});
app.delete('/finance/scheduled-expenses/:id', requireAuth, (req, res) => {
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
app.get('/finance/transactions', requireAuth, (req, res) => {
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

app.get('/finance/categories', requireAuth, (req, res) => {
  res.json({ categories: state.categories });
});
app.get('/finance/category-breakdown', requireAuth, (req, res) => {
  res.json({ period: req.query.period || 'month', breakdown: [], total: 0 });
});

// Expense Reports (notes de frais)
app.get('/finance/expense-reports', requireAuth, (req, res) => {
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
app.get('/finance/export', requireAuth, (req, res) => {
  res.header('Content-Type','text/csv');
  res.send('Date,Type,Description,Montant\n');
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API reconstruction server running on port ${PORT}`);
});
