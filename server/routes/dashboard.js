'use strict';

const express = require('express');
const { requireAuth } = require('../auth');
const { getColumns, getSetting } = require('../db');
const { LEAD_SELECT, decorate, stalledDays } = require('./leads');
const { db } = require('../db');
const { str } = require('../util');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const user = req.user;
  const where = [];
  const params = [];

  let ownerId = null;
  if (user.role !== 'admin') {
    ownerId = user.id;
  } else if (req.query.owner_id && req.query.owner_id !== 'all') {
    ownerId = Number(req.query.owner_id);
  }
  if (ownerId) { where.push('l.owner_id = ?'); params.push(ownerId); }

  const from = str(req.query.from);
  const to = str(req.query.to);
  if (from) { where.push('date(l.created_at) >= date(?)'); params.push(from); }
  if (to) { where.push('date(l.created_at) <= date(?)'); params.push(to); }

  const sql = `${LEAD_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
  const raw = db.prepare(sql).all(...params);
  const threshold = stalledDays();
  const leads = raw.map((l) => decorate(l, threshold));

  const columns = getColumns();
  const statusCounts = new Map();
  for (const c of columns) statusCounts.set(c.key, 0);
  for (const l of leads) statusCounts.set(l.status, (statusCounts.get(l.status) || 0) + 1);

  const byStatus = columns.map((c) => ({
    key: c.key,
    label: c.label,
    color: c.color,
    isWon: !!c.is_won,
    isLost: !!c.is_lost,
    count: statusCounts.get(c.key) || 0
  }));

  const total = leads.length;
  const won = leads.filter((l) => l.is_won).length;
  const lost = leads.filter((l) => l.is_lost).length;
  const open = total - won - lost;
  const conversionRate = total > 0 ? Math.round((won / total) * 1000) / 10 : 0;

  const stalled = leads
    .filter((l) => l.stalled)
    .sort((a, b) => b.days_stalled - a.days_stalled);

  const bySource = {};
  for (const l of leads) {
    const key = l.source_name || 'Sem origem';
    bySource[key] = (bySource[key] || 0) + 1;
  }

  const response = {
    period: { from: from || null, to: to || null },
    ownerId,
    stalledDays: threshold,
    summary: { total, won, lost, open, conversionRate },
    byStatus,
    bySource: Object.entries(bySource).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    stalled: { count: stalled.length, leads: stalled.slice(0, 200) }
  };

  if (user.role === 'admin') {
    const reps = db.prepare(`
      SELECT id,name,email,role FROM users
      WHERE role IN ('rep_internal','rep_external') AND status = 'active'
      ORDER BY name COLLATE NOCASE
    `).all();
    const byOwner = reps.map((r) => {
      const own = leads.filter((l) => l.owner_id === r.id);
      const w = own.filter((l) => l.is_won).length;
      return {
        id: r.id,
        name: r.name,
        role: r.role,
        total: own.length,
        won: w,
        lost: own.filter((l) => l.is_lost).length,
        stalled: own.filter((l) => l.stalled).length,
        conversionRate: own.length ? Math.round((w / own.length) * 1000) / 10 : 0
      };
    }).sort((a, b) => b.total - a.total);

    const unassigned = leads.filter((l) => !l.owner_id).length;
    response.byOwner = byOwner;
    response.unassigned = unassigned;
    response.alertEnabled = getSetting('stalled_alert_enabled', '1') === '1';
  }

  res.json(response);
});

module.exports = router;
