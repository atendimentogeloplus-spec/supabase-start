'use strict';

const webpush = require('web-push');
const { db, getSetting, setSetting } = require('./db');
const { now } = require('./util');

let configured = false;
let publicKey = null;

function getVapidKeys() {
  const fromEnvPub = process.env.VAPID_PUBLIC_KEY;
  const fromEnvPriv = process.env.VAPID_PRIVATE_KEY;
  if (fromEnvPub && fromEnvPriv) {
    return { publicKey: fromEnvPub, privateKey: fromEnvPriv };
  }
  let storedPub = getSetting('vapid_public');
  let storedPriv = getSetting('vapid_private');
  if (!storedPub || !storedPriv) {
    const generated = webpush.generateVAPIDKeys();
    storedPub = generated.publicKey;
    storedPriv = generated.privateKey;
    setSetting('vapid_public', storedPub);
    setSetting('vapid_private', storedPriv);
  }
  return { publicKey: storedPub, privateKey: storedPriv };
}

function ensureConfigured() {
  if (configured) return publicKey;
  const keys = getVapidKeys();
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@leadtrack.local';
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  publicKey = keys.publicKey;
  configured = true;
  return publicKey;
}

function getPublicKey() {
  return ensureConfigured();
}

function saveSubscription(userId, { endpoint, keys, userAgent }) {
  if (!userId || !endpoint || !keys || !keys.p256dh || !keys.auth) {
    throw new Error('Inscricao de push incompleta.');
  }
  const ts = now();
  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      updated_at = excluded.updated_at
  `).run(userId, endpoint, keys.p256dh, keys.auth, userAgent || null, ts, ts);
}

function removeSubscription(endpoint, userId) {
  if (!endpoint) return 0;
  if (userId) {
    return db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, userId).changes;
  }
  return db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint).changes;
}

function listForUser(userId) {
  return db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
}

async function sendToUser(userId, payload) {
  ensureConfigured();
  const rows = listForUser(userId);
  if (!rows.length) return { sent: 0, failed: 0 };
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  await Promise.all(rows.map(async (row) => {
    try {
      await webpush.sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth }
      }, body, { TTL: 60 * 60 * 12, urgency: 'high' });
      sent++;
    } catch (err) {
      failed++;
      const status = err && (err.statusCode || err.status);
      if (status === 404 || status === 410) {
        removeSubscription(row.endpoint);
      }
    }
  }));
  return { sent, failed };
}

module.exports = {
  getPublicKey,
  saveSubscription,
  removeSubscription,
  listForUser,
  sendToUser
};
