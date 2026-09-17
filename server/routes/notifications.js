'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const { unreadCount } = require('../notify');
const { intOrNull } = require('../util');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const unreadOnly = req.query.unread === '1';
  const limit = Math.min(intOrNull(req.query.limit) || 50, 200);
  const sql = `
    SELECT n.*, l.contact_name AS lead_contact
    FROM notifications n LEFT JOIN leads l ON l.id = n.lead_id
    WHERE n.user_id = ? ${unreadOnly ? 'AND n.is_read = 0' : ''}
    ORDER BY n.created_at DESC, n.id DESC LIMIT ?
  `;
  const rows = db.prepare(sql).all(req.user.id, limit);
  res.json({ notifications: rows, unreadCount: unreadCount(req.user.id) });
});

router.post('/:id/read', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.user.id);
  res.json({ ok: true, unreadCount: unreadCount(req.user.id) });
});

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ ok: true, unreadCount: 0 });
});

module.exports = router;
