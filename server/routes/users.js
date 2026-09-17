'use strict';

const express = require('express');
const { db } = require('../db');
const {
  publicUser,
  requireAdmin,
  requireAuth,
  hashPassword,
  generateTemporaryPassword,
  revokeOtherSessions
} = require('../auth');
const { createNotification } = require('../notify');
const { now, str } = require('../util');

const router = express.Router();

const ROLES = ['admin', 'rep_internal', 'rep_external'];
const STATUSES = ['pending', 'active', 'rejected', 'disabled'];

function countActiveAdmins() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'").get().n;
}

router.get('/', requireAuth, requireAdmin, (req, res) => {
  const status = str(req.query.status);
  const role = str(req.query.role);
  const q = str(req.query.q);

  const where = [];
  const params = [];
  if (status && STATUSES.includes(status)) { where.push('status = ?'); params.push(status); }
  if (role && ROLES.includes(role)) { where.push('role = ?'); params.push(role); }
  if (q) { where.push('(name LIKE ? OR email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  const sql = `SELECT id,name,email,phone,role,status,must_change_password,approved_at,created_at,updated_at
               FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, name COLLATE NOCASE`;
  const rows = db.prepare(sql).all(...params);
  const pendingCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'pending'").get().n;
  res.json({ users: rows.map(publicUser), pendingCount });
});

router.get('/representatives', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id,name,email,phone,role,status
    FROM users
    WHERE role IN ('rep_internal','rep_external') AND status = 'active'
    ORDER BY name COLLATE NOCASE
  `).all();
  res.json({ representatives: rows });
});

router.get('/:id', requireAuth, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  const stats = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN c.is_won = 1 THEN 1 ELSE 0 END) AS won
    FROM leads l JOIN kanban_columns c ON c.key = l.status
    WHERE l.owner_id = ?
  `).get(row.id);
  res.json({ user: publicUser(row), stats: { total: stats.total || 0, won: stats.won || 0 } });
});

router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Usuario nao encontrado.' });

  const name = 'name' in req.body ? str(req.body.name) : row.name;
  const phone = 'phone' in req.body ? str(req.body.phone) : row.phone;
  const role = 'role' in req.body ? str(req.body.role) : row.role;
  const status = 'status' in req.body ? str(req.body.status) : row.status;

  if (!name) return res.status(400).json({ error: 'Nome nao pode ficar vazio.' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Perfil invalido.' });
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status invalido.' });

  const losingAdmin = row.role === 'admin' && row.status === 'active'
    && (role !== 'admin' || status !== 'active');
  if (losingAdmin && countActiveAdmins() <= 1) {
    return res.status(400).json({ error: 'O sistema precisa de ao menos um administrador ativo.' });
  }
  if (id === req.user.id && status !== 'active') {
    return res.status(400).json({ error: 'Voce nao pode desativar a propria conta.' });
  }

  const ts = now();
  const approvedAt = status === 'active' && !row.approved_at ? ts : row.approved_at;
  const approvedBy = status === 'active' && !row.approved_by ? req.user.id : row.approved_by;

  db.prepare(`
    UPDATE users SET name=?, phone=?, role=?, status=?, approved_at=?, approved_by=?, updated_at=?
    WHERE id=?
  `).run(name, phone, role, status, approvedAt, approvedBy, ts, id);

  if (row.status === 'pending' && status === 'active') {
    createNotification({
      userId: id,
      type: 'account_approved',
      title: 'Sua conta foi aprovada',
      body: 'Seu acesso ao sistema foi liberado.'
    });
  }
  if (row.role !== role || row.status !== status) {
    createNotification({
      userId: id,
      type: 'account_updated',
      title: 'Seu cadastro foi atualizado',
      body: `Perfil: ${role}. Status: ${status}.`
    });
  }

  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

router.post('/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const role = str(req.body?.role) || 'rep_external';
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Perfil invalido.' });
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Usuario nao encontrado.' });

  const ts = now();
  db.prepare(`UPDATE users SET role=?, status='active', approved_by=?, approved_at=?, updated_at=? WHERE id=?`)
    .run(role, req.user.id, ts, ts, id);

  createNotification({
    userId: id,
    type: 'account_approved',
    title: 'Sua conta foi aprovada',
    body: `Bem-vindo! Seu perfil de acesso e ${role}.`
  });
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

router.post('/:id/reset-password', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Usuario nao encontrado.' });

  const temporaryPassword = generateTemporaryPassword();
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?')
    .run(hashPassword(temporaryPassword), now(), id);

  // Encerra todas as sessoes do usuario para forcar o uso da senha temporaria.
  revokeOtherSessions(id, null);

  createNotification({
    userId: id,
    type: 'password_reset',
    title: 'Sua senha foi redefinida',
    body: 'O administrador gerou uma senha temporaria. Altere-a apos entrar.'
  });

  res.json({
    user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)),
    temporaryPassword,
    message: 'Senha temporaria gerada. Informe-a ao usuario; ele devera altera-la no proximo acesso.'
  });
});

router.post('/:id/reject', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  if (id === req.user.id) return res.status(400).json({ error: 'Voce nao pode rejeitar a propria conta.' });

  db.prepare(`UPDATE users SET status='rejected', updated_at=? WHERE id=?`).run(now(), id);
  createNotification({
    userId: id,
    type: 'account_rejected',
    title: 'Cadastro nao aprovado',
    body: 'Seu acesso ao sistema nao foi aprovado. Contate o administrador.'
  });
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

module.exports = router;
