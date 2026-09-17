'use strict';

const fs = require('fs');
const path = require('path');

loadEnvFile(path.resolve(__dirname, '..', '.env'));

const express = require('express');
const { db, migrate, seed, bootstrapAdmin, getSetting, getColumns } = require('./db');
const { requireAuth } = require('./auth');
const { notifyAdmins } = require('./notify');
const { daysSince, now } = require('./util');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const { router: leadRoutes } = require('./routes/leads');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');

migrate();
seed();
bootstrapAdmin();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: now() });
});

app.get('/api/config', requireAuth, (req, res) => {
  res.json({
    company_name: getSetting('company_name', 'Minha Empresa'),
    stalled_days: Number.parseInt(getSetting('stalled_days', '7'), 10),
    columns: getColumns(),
    isAdmin: req.user.role === 'admin'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// O manifest e o service worker precisam de Content-Type e cache corretos.
app.get('/manifest.webmanifest', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'manifest.webmanifest'));
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(PUBLIC_DIR, 'sw.js'));
});

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = Number(process.env.PORT) || 3000;

function cleanupSessions() {
  try {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  } catch (err) {
    console.error('[sessions] falha na limpeza:', err.message);
  }
}

function checkStalledLeads() {
  try {
    if (getSetting('stalled_alert_enabled', '1') !== '1') return;
    const threshold = Number.parseInt(getSetting('stalled_days', '7'), 10) || 7;
    const leads = db.prepare(`
      SELECT l.id, l.contact_name, l.company, l.updated_at, u.name AS owner_name
      FROM leads l
      LEFT JOIN kanban_columns c ON c.key = l.status
      LEFT JOIN users u ON u.id = l.owner_id
      WHERE c.is_won = 0 AND c.is_lost = 0
    `).all();
    const today = now().slice(0, 10);
    for (const lead of leads) {
      const days = daysSince(lead.updated_at);
      if (days < threshold) continue;
      notifyAdmins({
        type: 'lead_stalled',
        title: 'Lead sem movimentacao',
        body: `${lead.contact_name}${lead.company ? ' - ' + lead.company : ''} esta parado ha ${days} dias` +
              (lead.owner_name ? ` (resp.: ${lead.owner_name}).` : ' (sem responsavel).'),
        leadId: lead.id,
        dedupeKey: `stalled:${lead.id}:${today}`
      });
    }
  } catch (err) {
    console.error('[stalled] falha na verificacao:', err.message);
  }
}

function startServer(port = PORT, host = '0.0.0.0') {
  const server = app.listen(port, host, () => {
    const actual = server.address();
    const shown = actual && typeof actual === 'object' ? actual.port : port;
    console.log(`LeadTrack rodando em http://localhost:${shown}`);
    cleanupSessions();
    checkStalledLeads();
  });

  const sessionTimer = setInterval(cleanupSessions, 60 * 60 * 1000);
  const stalledTimer = setInterval(checkStalledLeads, 30 * 60 * 1000);
  if (typeof sessionTimer.unref === 'function') sessionTimer.unref();
  if (typeof stalledTimer.unref === 'function') stalledTimer.unref();
  server.on('close', () => {
    clearInterval(sessionTimer);
    clearInterval(stalledTimer);
  });
  return server;
}

if (require.main === module) {
  const server = startServer();
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}

module.exports = { app, startServer, checkStalledLeads, cleanupSessions };

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
