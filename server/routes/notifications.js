'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const { unreadCount } = require('../notify');
const { getPublicKey, saveSubscription, removeSubscription, sendToUser } = require('../push');
const { intOrNull, str } = require('../util');

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

router.get('/push/public-key', (req, res) => {
  res.json({ publicKey: getPublicKey(), supported: true });
});

router.get('/push/status', (req, res) => {
  const rows = db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?').get(req.user.id);
  res.json({ subscribed: !!(rows && rows.n), count: rows ? rows.n : 0 });
});

router.post('/push/subscribe', (req, res) => {
  const endpoint = str(req.body?.endpoint);
  const keys = req.body?.keys || {};
  if (!endpoint || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'Inscricao de push incompleta.' });
  }
  try {
    saveSubscription(req.user.id, {
      endpoint,
      keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) },
      userAgent: req.headers['user-agent'] || null
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Nao foi possivel salvar a inscricao.' });
  }
  res.json({ ok: true });
});

router.post('/push/unsubscribe', (req, res) => {
  const endpoint = str(req.body?.endpoint);
  if (!endpoint) return res.status(400).json({ error: 'Informe o endpoint.' });
  removeSubscription(endpoint, req.user.id);
  res.json({ ok: true });
});

router.post('/push/test', async (req, res) => {
  try {
    const result = await sendToUser(req.user.id, {
      title: 'LeadTrack',
      body: 'Teste de notificacao no celular. Se voce esta vendo isto, os avisos do sistema estao ativos.',
      url: '/#/notifications',
      type: 'push_test',
      tag: 'push-test'
    });
    if (!result.sent) {
      return res.status(400).json({ error: 'Nenhum dispositivo inscrito. Ative os avisos neste aparelho primeiro.' });
    }
    res.json({ ok: true, sent: result.sent });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Falha ao enviar o teste.' });
  }
});

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ ok: true, unreadCount: 0 });
});

router.post('/:id/read', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.user.id);
  res.json({ ok: true, unreadCount: unreadCount(req.user.id) });
});

module.exports = router;
