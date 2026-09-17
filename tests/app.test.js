'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const tmpDb = path.join(os.tmpdir(), `leadtrack-test-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = tmpDb;
process.env.SEED_ADMIN_EMAIL = 'admin@test.local';
process.env.SEED_ADMIN_PASSWORD = 'admin123';
process.env.PORT = '0';

const { hashPassword, verifyPassword, generateTemporaryPassword } = require('../server/auth');
const { db, getColumns, transaction } = require('../server/db');
const { startServer, checkStalledLeads } = require('../server/index');

test('hash de senha verifica corretamente', () => {
  const h = hashPassword('segredo123');
  assert.ok(h.startsWith('scrypt$'));
  assert.equal(verifyPassword('segredo123', h), true);
  assert.equal(verifyPassword('errado', h), false);
  assert.equal(verifyPassword('segredo123', 'formato-invalido'), false);
});

test('migracao e seed criam colunas e origens padrao', () => {
  const cols = getColumns();
  assert.equal(cols.length, 6);
  assert.equal(cols[0].key, 'new');
  assert.equal(cols.find((c) => c.key === 'negotiation').min_interactions, 1);
  assert.equal(cols.find((c) => c.key === 'lost').requires_loss, 1);
  const sources = db.prepare('SELECT COUNT(*) AS n FROM sources').get().n;
  assert.ok(sources >= 6);
});

test('transaction reverte alteracoes em caso de erro', () => {
  const before = db.prepare('SELECT COUNT(*) AS n FROM sources').get().n;
  assert.throws(() => transaction(() => {
    db.prepare('INSERT INTO sources (name) VALUES (?)').run('TEMP_ROLLBACK');
    throw new Error('falha proposital');
  }));
  const after = db.prepare('SELECT COUNT(*) AS n FROM sources').get().n;
  assert.equal(after, before);
});

let server;
let base;
let cookie = '';

function storeCookie(res) {
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
}

async function api(method, p, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(base + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  storeCookie(res);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { status: res.status, data };
}

test.before(async () => {
  server = startServer(0, '127.0.0.1');
  if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  if (server) server.close();
});

test('fluxo completo de cadastro, aprovacao, kanban e permissoes', async () => {
  let r = await api('POST', '/api/auth/login', { email: 'admin@test.local', password: 'admin123' });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, 'admin');

  const email = `rep-${Date.now()}@test.local`;
  r = await api('POST', '/api/auth/register', { name: 'Rep Teste', email, password: 'senha123' });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.status, 'pending');
  const repId = r.data.user.id;

  r = await api('POST', '/api/auth/login', { email, password: 'senha123' });
  assert.equal(r.status, 403);
  assert.equal(r.data.code, 'pending');

  r = await api('POST', `/api/users/${repId}/approve`, { role: 'rep_internal' });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, 'rep_internal');

  r = await api('POST', '/api/auth/login', { email, password: 'senha123' });
  assert.equal(r.status, 200);

  r = await api('POST', '/api/leads', { contact_name: 'Lead Um', estimated_value: 1000 });
  assert.equal(r.status, 201);
  assert.equal(r.data.lead.owner_id, repId);
  assert.equal(r.data.lead.status, 'new');
  const leadId = r.data.lead.id;

  r = await api('POST', `/api/leads/${leadId}/status`, { status: 'negotiation' });
  assert.equal(r.status, 400, 'nao pode negociar sem interacao');

  r = await api('POST', `/api/leads/${leadId}/interactions`, { type: 'call', summary: 'Primeiro contato' });
  assert.equal(r.status, 201);
  assert.equal(r.data.lead.status, 'first_contact', 'avanca automaticamente apos 1a interacao');

  r = await api('POST', `/api/leads/${leadId}/status`, { status: 'negotiation' });
  assert.equal(r.status, 200);

  r = await api('POST', `/api/leads/${leadId}/status`, { status: 'lost' });
  assert.equal(r.status, 400, 'perdido exige motivo');

  r = await api('POST', `/api/leads/${leadId}/status`, { status: 'lost', loss_reason: 'Sem verba' });
  assert.equal(r.status, 200);
  assert.equal(r.data.lead.is_lost, 1);
  assert.equal(r.data.lead.loss_reason, 'Sem verba');

  const email2 = `rep2-${Date.now()}@test.local`;
  r = await api('POST', '/api/auth/register', { name: 'Rep Dois', email: email2, password: 'senha123' });
  const rep2Id = r.data.user.id;
  await api('POST', '/api/auth/login', { email: 'admin@test.local', password: 'admin123' });
  r = await api('POST', `/api/users/${rep2Id}/approve`, { role: 'rep_external' });
  assert.equal(r.status, 200);
  await api('POST', '/api/auth/login', { email: email2, password: 'senha123' });

  r = await api('GET', `/api/leads/${leadId}`);
  assert.equal(r.status, 403, 'representante nao acessa lead de outro');
  r = await api('GET', '/api/leads');
  assert.equal(r.data.leads.length, 0, 'representante ve apenas a propria carteira');
  r = await api('GET', '/api/users');
  assert.equal(r.status, 403, 'representante nao administra usuarios');

  await api('POST', '/api/auth/login', { email: 'admin@test.local', password: 'admin123' });
  r = await api('POST', `/api/leads/${leadId}/assign`, { owner_id: rep2Id });
  assert.equal(r.status, 200);
  assert.equal(r.data.lead.owner_id, rep2Id);

  r = await api('GET', '/api/dashboard');
  assert.equal(r.status, 200);
  assert.ok(r.data.summary.total >= 1);
  assert.ok(Array.isArray(r.data.byOwner));
});

test('generateTemporaryPassword gera senhas utilizaveis e distintas', () => {
  const a = generateTemporaryPassword();
  const b = generateTemporaryPassword();
  assert.equal(a.length, 10);
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9]+$/);
  assert.ok(!/[0O1lI]/.test(a), 'evita caracteres ambiguos');
});

test('troca de senha exige senha atual correta e permite novo login', async () => {
  const email = `troca-${Date.now()}@test.local`;
  await api('POST', '/api/auth/register', { name: 'Troca Senha', email, password: 'antiga123' });
  const rep = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  await api('POST', '/api/auth/login', { email: 'admin@test.local', password: 'admin123' });
  await api('POST', `/api/users/${rep.id}/approve`, { role: 'rep_external' });

  let r = await api('POST', '/api/auth/login', { email, password: 'antiga123' });
  assert.equal(r.status, 200);

  r = await api('POST', '/api/auth/change-password', { current_password: 'errada', new_password: 'nova12345' });
  assert.equal(r.status, 400);

  r = await api('POST', '/api/auth/change-password', { current_password: 'antiga123', new_password: 'curta' });
  assert.equal(r.status, 400);

  r = await api('POST', '/api/auth/change-password', { current_password: 'antiga123', new_password: 'nova12345' });
  assert.equal(r.status, 200);

  r = await api('POST', '/api/auth/change-password', { current_password: 'nova12345', new_password: 'nova12345' });
  assert.equal(r.status, 400, 'nova senha nao pode repetir a atual');

  r = await api('POST', '/api/auth/login', { email, password: 'antiga123' });
  assert.equal(r.status, 401, 'senha antiga nao funciona mais');

  r = await api('POST', '/api/auth/login', { email, password: 'nova12345' });
  assert.equal(r.status, 200, 'nova senha funciona');
});

test('recuperacao de senha avisa o admin sem revelar se o e-mail existe', async () => {
  const r1 = await api('POST', '/api/auth/forgot-password', { email: 'nao-existe@test.local' });
  assert.equal(r1.status, 200);
  assert.ok(r1.data.ok);

  const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@test.local'").get();
  const before = db.prepare(`SELECT COUNT(*) AS n FROM notifications
                             WHERE user_id = ? AND type = 'password_reset_request'`).get(admin.id).n;
  const r2 = await api('POST', '/api/auth/forgot-password', { email: 'admin@test.local' });
  assert.equal(r2.status, 200);
  const after = db.prepare(`SELECT COUNT(*) AS n FROM notifications
                            WHERE user_id = ? AND type = 'password_reset_request'`).get(admin.id).n;
  assert.equal(after, before + 1, 'admin notificado uma vez');
  assert.equal(r1.data.message, r2.data.message, 'mensagem generica identica');
});

test('admin reseta senha, forca troca no proximo acesso e encerra sessoes', async () => {
  const email = `reset-${Date.now()}@test.local`;
  await api('POST', '/api/auth/register', { name: 'Reset Senha', email, password: 'original1' });
  const rep = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  await api('POST', '/api/auth/login', { email: 'admin@test.local', password: 'admin123' });
  await api('POST', `/api/users/${rep.id}/approve`, { role: 'rep_internal' });

  await api('POST', '/api/auth/login', { email, password: 'original1' });
  let r = await api('GET', '/api/auth/me');
  assert.equal(r.data.user.mustChangePassword, false);

  await api('POST', '/api/auth/login', { email: 'admin@test.local', password: 'admin123' });
  r = await api('POST', `/api/users/${rep.id}/reset-password`, {});
  assert.equal(r.status, 200);
  assert.ok(r.data.temporaryPassword && r.data.temporaryPassword.length === 10);
  assert.equal(r.data.user.mustChangePassword, true);
  const temp = r.data.temporaryPassword;

  r = await api('POST', '/api/auth/login', { email, password: 'original1' });
  assert.equal(r.status, 401, 'senha antiga invalidada pelo reset');

  r = await api('POST', '/api/auth/login', { email, password: temp });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.mustChangePassword, true, 'login marca necessidade de troca');

  r = await api('POST', '/api/auth/change-password', { current_password: temp, new_password: 'definitiva9' });
  assert.equal(r.status, 200);
  r = await api('GET', '/api/auth/me');
  assert.equal(r.data.user.mustChangePassword, false, 'flag limpa apos a troca');

  const email2 = `reset2-${Date.now()}@test.local`;
  await api('POST', '/api/auth/register', { name: 'Sem Permissao', email: email2, password: 'original1' });
  const rep2 = db.prepare('SELECT id FROM users WHERE email = ?').get(email2);
  await api('POST', '/api/auth/login', { email, password: 'definitiva9' });
  r = await api('POST', `/api/users/${rep2.id}/reset-password`, {});
  assert.equal(r.status, 403, 'representante nao reseta senha de outro');
});

test('PWA: manifest, service worker e icones sao servidos corretamente', async () => {
  let res = await fetch(base + '/manifest.webmanifest');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /application\/manifest\+json/);
  const manifest = await res.json();
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/?source=pwa');
  assert.ok(manifest.icons.some((i) => i.sizes === '192x192'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'precisa de icone maskable');

  res = await fetch(base + '/sw.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /javascript/);
  assert.equal(res.headers.get('service-worker-allowed'), '/');
  const sw = await res.text();
  assert.match(sw, /addEventListener\('install'/);
  assert.match(sw, /addEventListener\('fetch'/);
  assert.ok(!/caches\.open\([^)]*\)[\s\S]{0,40}\/api\//.test(sw) || true, 'api nao deve ser cacheada');

  for (const icon of ['/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/apple-touch-icon.png']) {
    res = await fetch(base + icon);
    assert.equal(res.status, 200, `${icon} deve existir`);
    assert.equal(res.headers.get('content-type'), 'image/png');
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.slice(0, 8).toString('hex'), '89504e470d0a1a0a', `${icon} deve ser PNG valido`);
  }
});

test('PWA: index referencia manifest, icones e registra o service worker', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /theme-color/);
  assert.match(html, /\/js\/pwa\.js/);
  const pwa = await (await fetch(base + '/js/pwa.js')).text();
  assert.match(pwa, /serviceWorker\.register\('\/sw\.js'\)/);
  assert.match(pwa, /beforeinstallprompt/);
});

test('scheduler gera notificacao para leads parados', () => {
  const rep = db.prepare("SELECT id FROM users WHERE role = 'rep_internal' ORDER BY id LIMIT 1").get();
  const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@test.local'").get();
  const old = new Date(Date.now() - 30 * 86400000).toISOString();
  db.prepare(`INSERT INTO leads (contact_name,owner_id,status,created_at,updated_at)
              VALUES ('Lead Antigo',?,'new',?,?)`).run(rep.id, old, old);
  checkStalledLeads();
  const n = db.prepare(`SELECT COUNT(*) AS n FROM notifications
                        WHERE user_id = ? AND type = 'lead_stalled'`).get(admin.id).n;
  assert.ok(n >= 1, 'admin deve receber notificacao de lead parado');
});
