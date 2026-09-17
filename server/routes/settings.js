'use strict';

const express = require('express');
const { db, getSetting, setSetting, getColumns } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { str, intOrNull, boolInt } = require('../util');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json({
    company_name: getSetting('company_name', 'Minha Empresa'),
    stalled_days: Number.parseInt(getSetting('stalled_days', '7'), 10),
    stalled_alert_enabled: getSetting('stalled_alert_enabled', '1') === '1',
    columns: getColumns(),
    sources: db.prepare('SELECT id,name,active FROM sources ORDER BY name COLLATE NOCASE').all()
  });
});

router.patch('/', requireAuth, requireAdmin, (req, res) => {
  const body = req.body || {};
  if ('company_name' in body) {
    const name = str(body.company_name);
    if (!name) return res.status(400).json({ error: 'Nome da empresa nao pode ficar vazio.' });
    setSetting('company_name', name);
  }
  if ('stalled_days' in body) {
    const days = intOrNull(body.stalled_days);
    if (days === null || days < 1 || days > 365) {
      return res.status(400).json({ error: 'O prazo de dias deve estar entre 1 e 365.' });
    }
    setSetting('stalled_days', days);
  }
  if ('stalled_alert_enabled' in body) {
    setSetting('stalled_alert_enabled', boolInt(body.stalled_alert_enabled));
  }
  res.json({
    company_name: getSetting('company_name', 'Minha Empresa'),
    stalled_days: Number.parseInt(getSetting('stalled_days', '7'), 10),
    stalled_alert_enabled: getSetting('stalled_alert_enabled', '1') === '1'
  });
});

function columnExists(key) {
  return !!db.prepare('SELECT id FROM kanban_columns WHERE key = ?').get(key);
}

router.post('/columns', requireAuth, requireAdmin, (req, res) => {
  const label = str(req.body?.label);
  let key = str(req.body?.key);
  if (!label) return res.status(400).json({ error: 'Informe o nome da coluna.' });
  if (!key) key = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key) return res.status(400).json({ error: 'Nao foi possivel gerar uma chave para a coluna.' });
  if (columnExists(key)) return res.status(409).json({ error: 'Ja existe uma coluna com esta chave.' });

  const max = db.prepare('SELECT COALESCE(MAX(position),0) AS p FROM kanban_columns').get().p;
  const color = str(req.body?.color) || '#64748b';
  const minInteractions = intOrNull(req.body?.min_interactions);
  const requiresLoss = boolInt(req.body?.requires_loss);
  db.prepare(`INSERT INTO kanban_columns (key,label,position,color,min_interactions,requires_loss,is_won,is_lost)
              VALUES (?,?,?,?,?,?,0,0)`)
    .run(key, label, max + 1, color, minInteractions && minInteractions > 0 ? minInteractions : 0, requiresLoss);
  res.status(201).json({ columns: getColumns() });
});

router.patch('/columns/:key', requireAuth, requireAdmin, (req, res) => {
  const key = req.params.key;
  const col = db.prepare('SELECT * FROM kanban_columns WHERE key = ?').get(key);
  if (!col) return res.status(404).json({ error: 'Coluna nao encontrada.' });
  const body = req.body || {};

  const label = 'label' in body ? str(body.label) : col.label;
  if (!label) return res.status(400).json({ error: 'Nome da coluna nao pode ficar vazio.' });
  const color = 'color' in body ? str(body.color) || col.color : col.color;
  let minInteractions = col.min_interactions;
  if ('min_interactions' in body) {
    const n = intOrNull(body.min_interactions);
    if (n === null || n < 0) return res.status(400).json({ error: 'Valor minimo de interacoes invalido.' });
    minInteractions = n;
  }
  let requiresLoss = col.requires_loss;
  if ('requires_loss' in body) requiresLoss = boolInt(body.requires_loss);
  let position = col.position;
  if ('position' in body) {
    const n = intOrNull(body.position);
    if (n !== null && n > 0) position = n;
  }

  db.prepare(`UPDATE kanban_columns SET label=?, color=?, min_interactions=?, requires_loss=?, position=? WHERE key=?`)
    .run(label, color, minInteractions, requiresLoss, position, key);
  res.json({ columns: getColumns() });
});

router.post('/columns/reorder', requireAuth, requireAdmin, (req, res) => {
  const order = Array.isArray(req.body?.order) ? req.body.order : null;
  if (!order) return res.status(400).json({ error: 'Envie a lista "order" com as chaves das colunas.' });
  const stmt = db.prepare('UPDATE kanban_columns SET position=? WHERE key=?');
  order.forEach((key, index) => stmt.run(index + 1, String(key)));
  res.json({ columns: getColumns() });
});

router.post('/sources', requireAuth, requireAdmin, (req, res) => {
  const name = str(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Informe o nome da origem.' });
  const exists = db.prepare('SELECT id FROM sources WHERE name = ?').get(name);
  if (exists) return res.status(409).json({ error: 'Origem ja cadastrada.' });
  db.prepare('INSERT INTO sources (name) VALUES (?)').run(name);
  res.status(201).json({ sources: db.prepare('SELECT id,name,active FROM sources ORDER BY name COLLATE NOCASE').all() });
});

router.patch('/sources/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const src = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
  if (!src) return res.status(404).json({ error: 'Origem nao encontrada.' });
  const name = 'name' in req.body ? str(req.body.name) : src.name;
  if (!name) return res.status(400).json({ error: 'Nome da origem nao pode ficar vazio.' });
  const active = 'active' in req.body ? boolInt(req.body.active) : src.active;
  db.prepare('UPDATE sources SET name=?, active=? WHERE id=?').run(name, active, id);
  res.json({ sources: db.prepare('SELECT id,name,active FROM sources ORDER BY name COLLATE NOCASE').all() });
});

module.exports = router;
