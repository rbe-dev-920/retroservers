import 'dotenv/config';  // Charge les variables d'environnement
import express from 'express'
import cors from 'cors'
import multer from 'multer';             // npm i multer csv-parse
import { parse } from 'csv-parse/sync';
import { Parser } from 'json2csv'; // npm i json2csv
import nodemailer from 'nodemailer';
import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const upload = multer({ storage: multer.memoryStorage() });

// ------- ADD THIS: uploadReport (multer disk storage for files) -------
const uploadReport = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // multer will store temporarily in a ./uploads folder at project root
      cb(null, path.join(process.cwd(), 'uploads'));
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    }
  })
});
// --------------------------------------------------------------------

const app = express()

// Configuration de synchronisation avec le site public
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || 'https://www.association-rbe.fr/api';
const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY; // Clé d'API pour authentifier les requêtes

// Fonction pour synchroniser un véhicule avec le site public
async function syncVehicleToPublic(vehicleData, action = 'update') {
  if (!PUBLIC_API_KEY) {
    console.warn('PUBLIC_API_KEY non configurée - synchronisation désactivée');
    return { success: false, reason: 'No API key' };
  }

  try {
    const url = `${PUBLIC_API_BASE}/vehicles/${vehicleData.parc}`;
    const options = {
      method: action === 'delete' ? 'DELETE' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUBLIC_API_KEY}`,
        'User-Agent': 'RBE-Intranet-Sync/1.0'
      }
    };

    if (action !== 'delete') {
      options.body = JSON.stringify({
        parc: vehicleData.parc,
        immat: vehicleData.immat,
        modele: vehicleData.modele,
        type: vehicleData.type,
        etat: vehicleData.etat,
        energie: vehicleData.energie,
        miseEnCirculation: vehicleData.miseEnCirculation,
        // Données supplémentaires pour le site public
        publique: true, // Marquer comme visible publiquement
        synced_from: 'intranet',
        last_sync: new Date().toISOString()
      });
    }

    const response = await fetch(url, options);
    
    if (response.ok) {
      console.log(`✅ Véhicule ${vehicleData.parc} synchronisé avec le site public (${action})`);
      return { success: true, action, parc: vehicleData.parc };
    } else {
      const errorText = await response.text();
      console.error(`❌ Erreur sync véhicule ${vehicleData.parc}:`, response.status, errorText);
      return { success: false, error: errorText, status: response.status };
    }
  } catch (error) {
    console.error(`❌ Erreur réseau sync véhicule ${vehicleData.parc}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Fonction pour synchroniser tous les véhicules (utile pour la migration initiale)
async function syncAllVehiclesToPublic() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        // Synchroniser seulement les véhicules "publics" (pas les brouillons)
        etat: { in: ['Service', 'Préservé'] }
      }
    });

    console.log(`🔄 Début synchronisation de ${vehicles.length} véhicules vers le site public...`);
    
    const results = [];
    for (const vehicle of vehicles) {
      const result = await syncVehicleToPublic(vehicle, 'update');
      results.push(result);
      // Petite pause pour éviter de surcharger l'API publique
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successful = results.filter(r => r.success).length;
    console.log(`✅ Synchronisation terminée: ${successful}/${vehicles.length} véhicules synchronisés`);
    
    return results;
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation globale:', error);
    return [];
  }
}

app.use(express.json())
app.use(cors({ 
  origin: [
    'http://localhost:5173',
    'https://www.retrobus-interne.fr',
    'https://retrobus-interne.fr'
  ] 
}))

// ensure retromail dir exists
const RETRO_DIR = path.resolve(process.cwd(), 'retromail');
(async () => {
  try {
    await fsp.mkdir(RETRO_DIR, { recursive: true });
    // also ensure uploads dir exists so multer can write there
    await fsp.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
  } catch (e) {
    console.error('could not create retromail/uploads dir', e);
  }
})();

// Configure nodemailer transporter from env if provided
let transporter = null;
const SMTP_HOST = process.env.SMTP_HOST;
if (SMTP_HOST) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: (process.env.SMTP_SECURE === 'true'), // true for 465, false for other ports
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
      // if no auth provided transporter will attempt unauthenticated connection
    });
    // optional verify
    transporter.verify().then(()=>console.log('SMTP transporter ready')).catch(err=>console.warn('SMTP verify failed', err.message));
  } catch (e) {
    console.warn('failed to init transporter', e);
    transporter = null;
  }
} else {
  console.log('SMTP not configured (SMTP_HOST not set) — mails will not be sent, only saved locally in retromail/');
}

// Test
app.get('/health', (_, res) => res.json({ ok: true }))

// Liste véhicules
app.get('/vehicles', async (_, res) => {
  const items = await prisma.vehicle.findMany({ orderBy: { parc: 'asc' } })
  res.json(items)
})

// Détail par parc
app.get('/vehicles/:parc', async (req, res) => {
  const v = await prisma.vehicle.findUnique({ where: { parc: req.params.parc } })
  if (!v) return res.status(404).json({ error: 'Not found' })
  res.json(v)
})
const allowedCreators = (process.env.ALLOWED_CREATORS || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function requireCreator(req, res, next) {
  const who = (req.header("x-user-matricule") || "").toLowerCase();
  if (!who || !allowedCreators.includes(who)) {
    return res.status(403).json({ error: "Forbidden: creator not allowed" });
  }
  next();
}

// Créer un véhicule (import CSV)
app.post('/vehicles/import-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
    const text = req.file.buffer.toString('utf8');
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      delimiter: /[;,]/,   // accepte ; ou ,
      trim: true
    });
    const upserts = [];
    for (const r of records) {
      const parc = (r.parc || r.Parc || r.PARC || '').trim();
      if (!parc) continue;
      const data = {
        parc,
        immat: r.immat || r.Immat || null,
        modele: r.modele || r.Modèle || r.MODELE || '',
        type: r.type || 'Bus',
        etat: (r.etat || 'Préservé').toUpperCase().replace('À','A') === 'A VENIR' ? 'A VENIR' : 'Préservé',
        energie: r.energie || null,
        miseEnCirculation: r.miseEnCirculation ? new Date(r.miseEnCirculation) : null,
      };
      upserts.push(
        prisma.vehicle.upsert({ where: { parc }, update: data, create: data })
      );
    }
    const result = await Promise.all(upserts);
    res.json({ imported: result.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Import impossible' });
  }
});

app.get('/vehicles/export.csv', async (_req, res) => {
  const rows = await prisma.vehicle.findMany({ orderBy: { parc: 'asc' } });
  const fields = ['parc','immat','modele','type','etat','energie','miseEnCirculation'];
  const parser = new Parser({ fields });
  const csv = parser.parse(rows.map(r => ({
    ...r,
    miseEnCirculation: r.miseEnCirculation ? new Date(r.miseEnCirculation).toISOString().slice(0,10) : ''
  })));
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="vehicules.csv"');
  res.send(csv);
});

// Mettre à jour un véhicule (etat, immat, energie, miseEnCirculation, modele, type)
app.put('/vehicles/:parc', async (req, res) => {
  try {
    const { parc } = req.params;
    const { etat, immat, energie, miseEnCirculation, modele, type } = req.body || {};
    const data = {};
    if (etat) data.etat = etat;
    if (typeof immat !== 'undefined') data.immat = immat || null;
    if (typeof energie !== 'undefined') data.energie = energie || null;
    if (typeof modele !== 'undefined') data.modele = modele || null;
    if (typeof type !== 'undefined') data.type = type || null;
    if (typeof miseEnCirculation !== 'undefined')
      data.miseEnCirculation = miseEnCirculation ? new Date(miseEnCirculation) : null;

    // Mettre à jour en base locale
    const updatedVehicle = await prisma.vehicle.update({ where: { parc }, data });
    
    // Synchronisation automatique avec le site public (asynchrone)
    if (updatedVehicle.etat === 'Service' || updatedVehicle.etat === 'Préservé') {
      // Synchroniser seulement les véhicules visibles publiquement
      syncVehicleToPublic(updatedVehicle, 'update').catch(error => {
        console.error(`Erreur sync véhicule ${parc}:`, error);
      });
    }
    
    res.json({
      ...updatedVehicle,
      _syncStatus: 'pending' // Indiquer que la sync est en cours
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Update failed' });
  }
});

// Supprimer un véhicule
app.delete('/vehicles/:parc', requireCreator, async (req, res) => {
  try {
    const { parc } = req.params;
    
    // Vérifier si le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({ where: { parc } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }
    
    // Supprimer d'abord tous les éléments liés (cascade)
    await prisma.$transaction([
      // Supprimer les usages
      prisma.usage.deleteMany({ where: { parc } }),
      // Supprimer les événements
      prisma.event.deleteMany({ where: { parc } }),
      // Supprimer le véhicule
      prisma.vehicle.delete({ where: { parc } })
    ]);
    
    // Synchronisation de la suppression avec le site public (asynchrone)
    syncVehicleToPublic(vehicle, 'delete').catch(error => {
      console.error(`Erreur sync suppression véhicule ${parc}:`, error);
    });
    
    res.json({ 
      message: 'Véhicule supprimé avec succès',
      _syncStatus: 'pending'
    });
  } catch (e) {
    console.error('Erreur suppression véhicule:', e);
    res.status(500).json({ error: 'Impossible de supprimer le véhicule' });
  }
});

// === ENDPOINTS DE SYNCHRONISATION ===

// Synchroniser tous les véhicules avec le site public
app.post('/sync/vehicles/all', requireCreator, async (req, res) => {
  try {
    console.log('🔄 Début synchronisation manuelle de tous les véhicules...');
    const results = await syncAllVehiclesToPublic();
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json({
      message: `Synchronisation terminée`,
      total: results.length,
      successful,
      failed,
      details: results
    });
  } catch (error) {
    console.error('Erreur synchronisation globale:', error);
    res.status(500).json({ error: 'Erreur lors de la synchronisation' });
  }
});

// Synchroniser un véhicule spécifique avec le site public
app.post('/sync/vehicles/:parc', requireCreator, async (req, res) => {
  try {
    const { parc } = req.params;
    
    // Récupérer le véhicule
    const vehicle = await prisma.vehicle.findUnique({ where: { parc } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }
    
    // Synchroniser
    const result = await syncVehicleToPublic(vehicle, 'update');
    
    res.json({
      message: `Synchronisation du véhicule ${parc}`,
      success: result.success,
      details: result
    });
  } catch (error) {
    console.error(`Erreur sync véhicule ${req.params.parc}:`, error);
    res.status(500).json({ error: 'Erreur lors de la synchronisation' });
  }
});

// Vérifier le statut de la synchronisation
app.get('/sync/status', requireCreator, async (req, res) => {
  res.json({
    publicApiConfigured: !!PUBLIC_API_KEY,
    publicApiBase: PUBLIC_API_BASE,
    timestamp: new Date().toISOString(),
    message: PUBLIC_API_KEY 
      ? 'Synchronisation activée' 
      : 'Synchronisation désactivée (PUBLIC_API_KEY manquante)'
  });
});

// Création d'un usage (pointage start)
// NOTE: requireCreator applique une restriction si ALLOWED_CREATORS est configuré.
app.post('/vehicles/:parc/usages', requireCreator, async (req,res) => {
  try {
    const { conducteur, participants, note, startedAt, endedAt, relatedTo } = req.body || {};
    const created = await prisma.usage.create({
      data: {
        parc: req.params.parc,
        conducteur: conducteur || null,
        participants: participants ? JSON.stringify(participants) : null,
        note: note || null,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        endedAt: endedAt ? new Date(endedAt) : null,
        relatedTo: relatedTo || null
      }
    });
    res.json({ id: created.id, startedAt: created.startedAt, endedAt: created.endedAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'create usage failed' });
  }
});

// Mise à jour d'un usage (pointage end)
app.patch('/vehicles/:parc/usages/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { endedAt, note, participants } = req.body || {};
    const data = {};
    if (typeof endedAt !== 'undefined') data.endedAt = endedAt ? new Date(endedAt) : null;
    if (typeof note !== 'undefined') data.note = note;
    if (typeof participants !== 'undefined') data.participants = Array.isArray(participants) ? JSON.stringify(participants) : participants;
    const updated = await prisma.usage.update({
      where: { id },
      data
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(404).json({ error: 'Not found' });
  }
});

// Reports receive (form-data) -> save meta, generate PDF with images, save videos separately, send mail with PDF+JSON attachment
app.post('/vehicles/:parc/reports', uploadReport.array('files'), async (req, res) => {
  try {
    const { description, usageId, startedAt, endedAt, conducteur, participants } = req.body || {};
    const files = (req.files || []).map(f => ({ filename: f.filename, originalname: f.originalname, size: f.size, mime: f.mimetype, path: f.path }));

    // Ensure directories
    const uploadsDir = path.join(RETRO_DIR, 'uploads');
    const pdfsDir = RETRO_DIR; // reports PDFs saved at retromail/
    await fsp.mkdir(uploadsDir, { recursive: true });

    // Move uploaded files (multer stored them in server ./uploads) into retromail/uploads
    const movedFiles = [];
    for (const f of req.files || []) {
      const src = f.path; // multer diskStorage path
      const dest = path.join(uploadsDir, f.filename);
      try {
        // rename is fine if same FS; fallback to copy if rename fails
        await fsp.rename(src, dest).catch(async () => {
          const data = await fsp.readFile(src);
          await fsp.writeFile(dest, data);
          await fsp.unlink(src).catch(()=>{});
        });
        movedFiles.push({ filename: f.filename, originalname: f.originalname, size: f.size, mime: f.mimetype, dest });
      } catch (e) {
        console.warn("failed to move uploaded file", f.originalname, e);
      }
    }

    // Create DB entry for report (metadata)
    const created = await prisma.report.create({
      data: {
        parc: req.params.parc,
        usageId: usageId ? Number(usageId) : null,
        description: description || null,
        filesMeta: JSON.stringify(movedFiles)
      }
    });

    // Build reportPayload (for JSON file + email)
    const reportPayload = {
      id: created.id,
      parc: req.params.parc,
      usageId: usageId ? Number(usageId) : null,
      conducteur: conducteur || null,
      participants: participants ? (typeof participants === 'string' ? JSON.parse(participants) : participants) : [],
      startedAt: startedAt || null,
      endedAt: endedAt || null,
      description: description || null,
      files: movedFiles,
      createdAt: created.createdAt || new Date().toISOString()
    };

    // Save JSON copy in retromail/
    try {
      const jsonFilename = `report-${created.id}.json`;
      const jsonDest = path.join(RETRO_DIR, jsonFilename);
      await fsp.writeFile(jsonDest, JSON.stringify(reportPayload, null, 2), 'utf8');
    } catch (e) {
      console.warn('failed to write report JSON to retromail dir', e);
    }

    // Generate PDF containing the report info + embedded images (if any)
    const pdfFilename = `report-${created.id}.pdf`;
    const pdfDestPath = path.join(pdfsDir, pdfFilename);
    try {
      await new Promise(async (resolvePdf, rejectPdf) => {
        const doc = new PDFDocument({ autoFirstPage: false });
        const stream = fs.createWriteStream(pdfDestPath);
        doc.pipe(stream);

        // Title page
        doc.addPage({ size: 'A4', margin: 50 });
        doc.fontSize(18).text(`Fiche de pointage — Parc ${req.params.parc}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`ID: ${created.id}`);
        doc.text(`Conducteur: ${reportPayload.conducteur || '-'}`);
        doc.text(`Participants: ${(reportPayload.participants || []).join(', ') || '-'}`);
        doc.text(`Début: ${reportPayload.startedAt || '-'}`);
        doc.text(`Fin: ${reportPayload.endedAt || '-'}`);
        doc.moveDown();
        doc.fontSize(12).text('Description :');
        doc.fontSize(11).text(reportPayload.description || '-', { align: 'left' });

        // Add image pages
        const imageFiles = movedFiles.filter(f => (f.mime || '').startsWith('image/'));
        for (const img of imageFiles) {
          try {
            // add a new page for each image to keep layout clean
            doc.addPage({ size: 'A4', margin: 40 });
            // fit into box approx 500x700
            const opts = { fit: [480, 640], align: 'center', valign: 'center' };
            doc.image(img.dest, opts);
          } catch (eImg) {
            console.warn('pdf image add failed for', img.dest, eImg);
          }
        }

        // Videos section
        const videoFiles = movedFiles.filter(f => (f.mime || '').startsWith('video/') || /\.(mp4|mov|avi|mkv)$/i.test(f.originalname || f.filename));
        doc.addPage({ size: 'A4', margin: 50 });
        doc.fontSize(14).text('Vidéos jointes (si analyse de sécurité réussie)', { underline: true });
        doc.moveDown();
        if (videoFiles.length > 0) {
          doc.fontSize(10).text('Fichiers non inclus (vidéos) :', { underline: true });
          for (const v of videoFiles) {
            doc.text(`- ${v.originalname || v.filename} (taille: ${(v.size/1024|0)} KB)`);
          }
        } else {
          doc.text('Aucune vidéo jointe.');
        }

        // Footer / meta
        doc.addPage({ size: 'A4', margin: 50 });
        const pageCount = doc.bufferedPageRange ? doc.bufferedPageRange().count : 0;
        if (pageCount > 0) {
          for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).text(`Page ${i+1} sur ${pageCount}`, { align: 'center' });
          }
        }

        stream.on('error', rejectPdf);
        stream.on('finish', resolvePdf);
        doc.end();
      });
    } catch (e) {
      console.warn('PDF generation failed', e);
    }

    // Send report by email
    try {
      const RETROMAIL_TO = process.env.RETROMAIL_TO || 'retromail@example.org';
      if (transporter) {
        // Send email with attachments (PDF + JSON) if transporter configured, do NOT attach videos
        const attachments = [];
        try {
          // attach PDF if exists
          const pdfBuf = await fsp.readFile(pdfDestPath);
          attachments.push({ filename: pdfFilename, content: pdfBuf, contentType: 'application/pdf' });
        } catch (e) {
          console.warn('pdf read failed for attachment', e);
        }
        try {
          // attach JSON
          const jsonBuf = Buffer.from(JSON.stringify(reportPayload, null, 2), 'utf8');
          attachments.push({ filename: `report-${created.id}.json`, content: jsonBuf, contentType: 'application/json' });
        } catch (e) {
          console.warn('json attach failed', e);
        }
        const publicBase = process.env.PUBLIC_BASE || `http://localhost:${process.env.PORT || 4000}`;
        // For videos, include download links in the message body but do not attach them
        const videoLinks = (movedFiles.filter(f => (f.mime || '').startsWith('video/') || /\.(mp4|mov|avi|mkv)$/i.test(f.originalname || f.filename))).map(v => {
          return `${publicBase.replace(/\/$/,'')}/retromail/uploads/${encodeURIComponent(v.filename)}`;
        });
        const textLines = [
          `Rétromail - Fiche pointage véhicule ${req.params.parc} (report ${created.id})`,
          '',
          `ID: ${created.id}`,
          `Conducteur: ${reportPayload.conducteur || '-'}`,
          `Participants: ${(reportPayload.participants || []).join(', ') || '-'}`,
          `Début: ${reportPayload.startedAt || '-'}`,
          `Fin: ${reportPayload.endedAt || '-'}`,
          '',
          `Description: ${reportPayload.description || '-'}`,
          '',
          `Fiche de pointage pour le parc ${req.params.parc} (id ${created.id})`,
          '',
          'Vidéos (téléchargement manuel après analyse de sécurité):',
          ...videoLinks.map(l => `- ${l}`),
        ];
        await transporter.sendMail({
          to: RETROMAIL_TO,
          from: process.env.RETROMAIL_FROM || 'no-reply@retrobus-essonne.fr',
          subject: `Rétromail - Fiche pointage véhicule ${req.params.parc} (report ${created.id})`,
          text: textLines.join('\n'),
          attachments
        });
      } else {
        console.log('SMTP not configured, skipped sending mail for report', created.id);
      }
    } catch (e) {
      console.warn('failed to send report email', e);
    }

    // final response
    res.json({ id: created.id });
  } catch (e) {
    res.status(500).json({ error: 'create report failed' });
    console.error(e);
  }
});

// expose retromail list and static files (downloads)
app.get('/retromail/list', async (req,res) => {
  try {
    const files = await fsp.readdir(RETRO_DIR);
    const json = files.filter(f => /\.(json|pdf)$/i.test(f)).sort().reverse();
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: 'retromail list failed' });
  }
});
app.use('/retromail/uploads', express.static(path.join(RETRO_DIR,'uploads')));
app.use('/retromail', express.static(RETRO_DIR));

// ===== FLASH INFO API =====

// GET /flashes - Récupérer tous les flashs actifs
app.get('/flashes', async (req, res) => {
  try {
    const now = new Date();
    const flashes = await prisma.flash.findMany({
      where: {
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(flashes);
  } catch (e) {
    console.error('GET /flashes error:', e);
    res.status(500).json({ error: 'Failed to load flashes' });
  }
});

// GET /flashes/all - Récupérer tous les flashs (pour admin)
app.get('/flashes/all', async (req, res) => {
  try {
    const flashes = await prisma.flash.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(flashes);
  } catch (e) {
    console.error('GET /flashes/all error:', e);
    res.status(500).json({ error: 'Failed to load all flashes' });
  }
});

// POST /flashes - Créer un nouveau flash (admin only)
app.post('/flashes', async (req, res) => {
  try {
    const { id, message, category = 'INFO', active = true, expiresAt } = req.body;
    
    const flash = await prisma.flash.create({
      data: {
        id: id || `flash-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        message,
        category,
        active,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });
    
    res.json(flash);
  } catch (e) {
    console.error('POST /flashes error:', e);
    res.status(500).json({ error: 'Failed to create flash' });
  }
});

// PUT /flashes/:id - Modifier un flash (admin only)
app.put('/flashes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, category, active, expiresAt } = req.body;
    
    const data = {};
    if (message !== undefined) data.message = message;
    if (category !== undefined) data.category = category;
    if (active !== undefined) data.active = active;
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    
    const flash = await prisma.flash.update({
      where: { id },
      data
    });
    
    res.json(flash);
  } catch (e) {
    console.error('PUT /flashes/:id error:', e);
    if (e.code === 'P2025') {
      res.status(404).json({ error: 'Flash not found' });
    } else {
      res.status(500).json({ error: 'Failed to update flash' });
    }
  }
});

// DELETE /flashes/:id - Supprimer un flash (admin only)
app.delete('/flashes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.flash.delete({
      where: { id }
    });
    
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /flashes/:id error:', e);
    if (e.code === 'P2025') {
      res.status(404).json({ error: 'Flash not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete flash' });
    }
  }
});

// ===== FIN FLASH INFO API =====

// ------- Démarrage serveur (local) ou export pour Vercel -------
const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`API dispo sur http://localhost:${PORT}`));
}

// Export pour Vercel
export default app;

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://retronet-essonne-git-main-assorbes-projects.vercel.app'  // URL réelle
  : 'http://localhost:4000';
