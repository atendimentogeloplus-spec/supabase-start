'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH
  ? path.resolve(ROOT, process.env.DB_PATH)
  : path.join(ROOT, 'data', 'leadtrack.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      phone         TEXT,
      role          TEXT NOT NULL DEFAULT 'rep_external'
                    CHECK (role IN ('admin','rep_internal','rep_external')),
      status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','rejected','disabled')),
      approved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_at   TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kanban_columns (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      key               TEXT NOT NULL UNIQUE,
      label             TEXT NOT NULL,
      position          INTEGER NOT NULL,
      color             TEXT NOT NULL DEFAULT '#64748b',
      min_interactions  INTEGER NOT NULL DEFAULT 0,
      requires_loss     INTEGER NOT NULL DEFAULT 0,
      is_won            INTEGER NOT NULL DEFAULT 0,
      is_lost           INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sources (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS leads (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_name       TEXT NOT NULL,
      company            TEXT,
      phone              TEXT,
      email              TEXT,
      source_id          INTEGER REFERENCES sources(id) ON DELETE SET NULL,
      owner_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status             TEXT NOT NULL DEFAULT 'new',
      estimated_value    REAL,
      notes              TEXT,
      loss_reason        TEXT,
      created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      last_interaction_at TEXT
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      type       TEXT NOT NULL
                 CHECK (type IN ('call','whatsapp','email','meeting','visit','other')),
      summary    TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lead_audit (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action     TEXT NOT NULL,
      detail     TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT,
      lead_id    INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      dedupe_key TEXT UNIQUE,
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_owner    ON leads(owner_id);
    CREATE INDEX IF NOT EXISTS idx_leads_status   ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_updated  ON leads(updated_at);
    CREATE INDEX IF NOT EXISTS idx_int_lead       ON interactions(lead_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notif_user     ON notifications(user_id, is_read);
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_push_user      ON push_subscriptions(user_id);
  `);

  // Colunas adicionadas em versoes posteriores (migrations idempotentes).
  ensureColumn('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('leads', 'response_sla_minutes', 'INTEGER');
  ensureColumn('leads', 'assigned_at', 'TEXT');
  ensureColumn('leads', 'first_response_at', 'TEXT');
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const DEFAULT_COLUMNS = [
  { key: 'new', label: 'Novo lead', position: 1, color: '#3b82f6', min_interactions: 0, requires_loss: 0, is_won: 0, is_lost: 0 },
  { key: 'first_contact', label: 'Primeiro contato feito', position: 2, color: '#06b6d4', min_interactions: 0, requires_loss: 0, is_won: 0, is_lost: 0 },
  { key: 'negotiation', label: 'Em negociacao', position: 3, color: '#f59e0b', min_interactions: 1, requires_loss: 0, is_won: 0, is_lost: 0 },
  { key: 'proposal', label: 'Proposta enviada', position: 4, color: '#8b5cf6', min_interactions: 1, requires_loss: 0, is_won: 0, is_lost: 0 },
  { key: 'won', label: 'Fechado (ganho)', position: 5, color: '#22c55e', min_interactions: 1, requires_loss: 0, is_won: 1, is_lost: 0 },
  { key: 'lost', label: 'Perdido', position: 6, color: '#ef4444', min_interactions: 1, requires_loss: 1, is_won: 0, is_lost: 1 }
];

const DEFAULT_SOURCES = ['Indicacao', 'Site', 'Redes sociais', 'Evento', 'Prospeccao ativa', 'Outro'];

function seed() {
  const now = new Date().toISOString();

  const cols = db.prepare('SELECT COUNT(*) AS n FROM kanban_columns').get().n;
  if (cols === 0) {
    const stmt = db.prepare(`INSERT INTO kanban_columns
      (key,label,position,color,min_interactions,requires_loss,is_won,is_lost)
      VALUES (?,?,?,?,?,?,?,?)`);
    for (const c of DEFAULT_COLUMNS) {
      stmt.run(c.key, c.label, c.position, c.color, c.min_interactions, c.requires_loss, c.is_won, c.is_lost);
    }
  }

  const src = db.prepare('SELECT COUNT(*) AS n FROM sources').get().n;
  if (src === 0) {
    const stmt = db.prepare('INSERT INTO sources (name) VALUES (?)');
    for (const s of DEFAULT_SOURCES) stmt.run(s);
  }

  const defaults = {
    stalled_days: '7',
    stalled_alert_enabled: '1',
    company_name: 'Minha Empresa',
    default_response_sla_minutes: '30'
  };
  const setIfAbsent = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
  for (const [k, v] of Object.entries(defaults)) setIfAbsent.run(k, v);
}

function bootstrapAdmin() {
  const { hashPassword } = require('./auth');
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@leadtrack.local').trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return;

  const now = new Date().toISOString();
  db.prepare(`INSERT INTO users (name,email,password_hash,phone,role,status,approved_at,created_at,updated_at)
              VALUES (?,?,?,?, 'admin', 'active', ?, ?, ?)`)
    .run(
      process.env.SEED_ADMIN_NAME || 'Administrador',
      email,
      hashPassword(process.env.SEED_ADMIN_PASSWORD || 'admin123'),
      null,
      now, now, now
    );
}

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(`INSERT INTO settings (key,value) VALUES (?,?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value));
}

function getColumns() {
  return db.prepare('SELECT * FROM kanban_columns ORDER BY position ASC').all();
}

function getColumn(key) {
  return db.prepare('SELECT * FROM kanban_columns WHERE key = ?').get(key);
}

function firstColumn() {
  return db.prepare('SELECT * FROM kanban_columns ORDER BY position ASC LIMIT 1').get();
}

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }
}

module.exports = {
  db,
  DB_PATH,
  migrate,
  seed,
  bootstrapAdmin,
  getSetting,
  setSetting,
  getColumns,
  getColumn,
  firstColumn,
  transaction,
  DEFAULT_SOURCES
};
