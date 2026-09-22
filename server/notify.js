'use strict';

const { db } = require('./db');
const { now } = require('./util');

function createNotification({ userId, type, title, body = null, leadId = null, dedupeKey = null }) {
  if (!userId) return null;
  try {
    const info = db.prepare(`
      INSERT INTO notifications (user_id,type,title,body,lead_id,dedupe_key,created_at)
      VALUES (?,?,?,?,?,?,?)
    `).run(userId, type, title, body, leadId, dedupeKey, now());
    const id = info.lastInsertRowid;
    dispatchPush(userId, { id, type, title, body, leadId }).catch(() => {});
    return id;
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE')) return null;
    throw err;
  }
}

function adminIds() {
  return db.prepare("SELECT id FROM users WHERE role = 'admin' AND status = 'active'").all().map((r) => r.id);
}

function notifyAdmins(payload) {
  for (const id of adminIds()) {
    createNotification({ ...payload, userId: id });
  }
}

function unreadCount(userId) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0').get(userId);
  return row ? row.n : 0;
}

async function dispatchPush(userId, { id, type, title, body, leadId }) {
  const push = require('./push');
  const url = leadId ? `/#/leads/${leadId}` : '/#/notifications';
  await push.sendToUser(userId, {
    title: title || 'LeadTrack',
    body: body || '',
    url,
    leadId: leadId || null,
    notificationId: id,
    type,
    tag: type && id ? `${type}-${id}` : 'leadtrack'
  });
}

module.exports = { createNotification, notifyAdmins, adminIds, unreadCount, dispatchPush };
