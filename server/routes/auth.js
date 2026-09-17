'use strict';

const express = require('express');
const { db } = require('../db');
const {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  revokeOtherSessions,
  parseCookies,
  sessionCookie,
  clearCookie,
  publicUser,
  userFromRequest,
  requireAuth,
  SESSION_COOKIE,
  SESSION_TTL_MS
} = require('../auth');
const { notifyAdmins } = require('../notify');
const { now, str, isEmail } = require('../util');

const MIN_PASSWORD_LENGTH = 6;

function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > 200) {
    return 'A senha e muito longa.';
  }
  return null;
}

const router = express.Router();

const PUBLIC_FIELDS = 'id,name,email,phone,role,status,approved_at,created_at';

router.post('/register', (req, res) => {
  const name = str(req.body?.name);
  const email = str(req.body?.email);
  const password = String(req.body?.password ?? '');
  const phone = str(req.body?.phone);

  if (!name) return res.status(400).json({ error: 'Informe o nome.' });
  if (!email || !isEmail(email)) return res.status(400).json({ error: 'Informe um e-mail valido.' });
  const passwordError = validateNewPassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const existing = db.prepare('SELECT id,status FROM users WHERE email = ?').get(email);
  if (existing) {
    if (existing.status === 'pending') {
      return res.status(409).json({ error: 'Ja existe um cadastro pendente para este e-mail.' });
    }
    return res.status(409).json({ error: 'Este e-mail ja esta cadastrado.' });
  }

  const ts = now();
  const info = db.prepare(`
    INSERT INTO users (name,email,password_hash,phone,role,status,created_at,updated_at)
    VALUES (?,?,?,?, 'rep_external', 'pending', ?, ?)
  `).run(name, email, hashPassword(password), phone, ts, ts);

  const userId = info.lastInsertRowid;

  notifyAdmins({
    type: 'user_pending',
    title: 'Novo cadastro aguardando aprovacao',
    body: `${name} (${email}) solicitou acesso ao sistema.`,
    dedupeKey: `user_pending:${userId}`
  });

  return res.status(201).json({
    message: 'Cadastro enviado. Aguarde a aprovacao do administrador.',
    user: publicUser(db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(userId))
  });
});

router.post('/login', (req, res) => {
  const email = str(req.body?.email);
  const password = String(req.body?.password ?? '');
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha invalidos.' });
  }
  if (row.status === 'pending') {
    return res.status(403).json({ code: 'pending', error: 'Sua conta ainda aguarda aprovacao do administrador.' });
  }
  if (row.status === 'rejected') {
    return res.status(403).json({ code: 'rejected', error: 'Seu cadastro foi rejeitado. Contate o administrador.' });
  }
  if (row.status === 'disabled') {
    return res.status(403).json({ code: 'disabled', error: 'Sua conta esta desativada. Contate o administrador.' });
  }

  const { token } = createSession(row.id);
  res.setHeader('Set-Cookie', sessionCookie(token, Math.floor(SESSION_TTL_MS / 1000)));
  return res.json({ user: publicUser(row) });
});

router.post('/logout', (req, res) => {
  const cookies = parseCookies(req);
  destroySession(cookies[SESSION_COOKIE]);
  res.setHeader('Set-Cookie', clearCookie());
  return res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const { user, inactive } = userFromRequest(req);
  if (user) return res.json({ user });
  if (inactive) return res.status(403).json({ code: inactive.status, error: 'Conta sem acesso ativo.', user: inactive });
  return res.status(401).json({ error: 'Nao autenticado.' });
});

router.post('/change-password', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'Usuario nao encontrado.' });

  const currentPassword = String(req.body?.current_password ?? '');
  const newPassword = String(req.body?.new_password ?? '');

  if (!currentPassword) return res.status(400).json({ error: 'Informe a senha atual.' });
  if (!verifyPassword(currentPassword, row.password_hash)) {
    return res.status(400).json({ error: 'A senha atual esta incorreta.' });
  }
  const passwordError = validateNewPassword(newPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (verifyPassword(newPassword, row.password_hash)) {
    return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual.' });
  }

  const ts = now();
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?')
    .run(hashPassword(newPassword), ts, row.id);

  const cookies = parseCookies(req);
  revokeOtherSessions(row.id, cookies[SESSION_COOKIE]);

  res.json({ ok: true, message: 'Senha alterada com sucesso.' });
});

router.post('/forgot-password', (req, res) => {
  const email = str(req.body?.email);
  const genericResponse = {
    ok: true,
    message: 'Se o e-mail estiver cadastrado, um administrador foi avisado e entrara em contato para liberar o acesso.'
  };
  if (!email || !isEmail(email)) return res.json(genericResponse);

  const row = db.prepare('SELECT id,name,email,status FROM users WHERE email = ?').get(email);
  if (row && row.status !== 'rejected') {
    const today = now().slice(0, 10);
    notifyAdmins({
      type: 'password_reset_request',
      title: 'Solicitacao de recuperacao de senha',
      body: `${row.name} (${row.email}) solicitou a recuperacao de senha.`,
      dedupeKey: `password_reset:${row.id}:${today}`
    });
  }

  return res.json(genericResponse);
});

module.exports = router;
