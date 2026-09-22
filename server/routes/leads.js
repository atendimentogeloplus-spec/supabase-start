'use strict';

const express = require('express');
const { db, getColumn, firstColumn, getSetting } = require('../db');
const { requireAuth } = require('../auth');
const { createNotification, adminIds, notifyAdmins } = require('../notify');
const { now, str, intOrNull, numberOrNull, daysSince, minutesSince, addMinutes, likeParam } = require('../util');

const router = express.Router();

const INTERACTION_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'visit', 'other'];

const LEAD_SELECT = `
  SELECT l.*,
          u.name AS owner_name,
          u.phone AS owner_phone,
          u.role AS owner_role,
         s.name AS source_name,
         c.label AS status_label,
         c.color AS status_color,
         c.position AS status_position,
         c.is_won AS is_won,
         c.is_lost AS is_lost,
         COALESCE(ic.n, 0) AS interaction_count
  FROM leads l
  LEFT JOIN users u ON u.id = l.owner_id
  LEFT JOIN sources s ON s.id = l.source_id
  LEFT JOIN kanban_columns c ON c.key = l.status
  LEFT JOIN (SELECT lead_id, COUNT(*) AS n FROM interactions GROUP BY lead_id) ic ON ic.lead_id = l.id
`;

function stalledDays() {
  const n = Number.parseInt(getSetting('stalled_days', '7'), 10);
  return Number.isFinite(n) && n >= 0 ? n : 7;
}

function parseSlaMinutes(value) {
  const n = intOrNull(value);
  if (n === null) return null;
  if (n < 1) return null;
  return Math.min(n, 7 * 24 * 60);
}

function defaultSlaMinutes() {
  return parseSlaMinutes(getSetting('default_response_sla_minutes', '30')) || 30;
}

function decorate(lead, threshold = stalledDays()) {
  if (!lead) return lead;
  const base = lead.updated_at || lead.created_at;
  const days = daysSince(base);
  const sla = decorateSla(lead);
  return {
    ...lead,
    days_stalled: days,
    stalled: !lead.is_won && !lead.is_lost && days >= threshold,
    ...sla
  };
}

function decorateSla(lead) {
  const minutes = intOrNull(lead.response_sla_minutes);
  const assignedAt = lead.assigned_at || null;
  const firstResponseAt = lead.first_response_at || null;
  if (!minutes || !assignedAt) {
    return {
      sla_minutes: minutes,
      sla_deadline: null,
      sla_remaining_minutes: null,
      sla_elapsed_minutes: null,
      sla_status: firstResponseAt ? 'met' : 'none'
    };
  }
  const deadline = addMinutes(assignedAt, minutes);
  const elapsed = minutesSince(assignedAt);
  const remaining = minutes - elapsed;
  if (firstResponseAt) {
    const responseElapsed = minutesSince(assignedAt) - minutesSince(firstResponseAt);
    const met = new Date(firstResponseAt).getTime() <= new Date(deadline).getTime();
    return {
      sla_minutes: minutes,
      sla_deadline: deadline,
      sla_remaining_minutes: 0,
      sla_elapsed_minutes: Math.max(0, elapsed - minutesSince(firstResponseAt)),
      sla_status: met ? 'met' : 'late'
    };
  }
  return {
    sla_minutes: minutes,
    sla_deadline: deadline,
    sla_remaining_minutes: remaining,
    sla_elapsed_minutes: elapsed,
    sla_status: remaining < 0 ? 'overdue' : (remaining <= Math.max(5, Math.ceil(minutes * 0.2)) ? 'due_soon' : 'open')
  };
}

function notifyOwnerOfAssignment(leadId, ownerId, contactName, company, slaMinutes, assignedByName) {
  if (!ownerId) return;
  const slaTxt = slaMinutes
    ? ` Prazo para assumir e registrar a primeira resposta: ${slaMinutes} minuto(s).`
    : '';
  createNotification({
    userId: ownerId,
    type: 'lead_assigned',
    title: 'Novo lead atribuido a voce',
    body: `${contactName}${company ? ' - ' + company : ''}.${slaTxt}${assignedByName ? ' Atribuido por ' + assignedByName + '.' : ''}`,
    leadId
  });
}

function canAccess(user, lead) {
  return user.role === 'admin' || lead.owner_id === user.id;
}

function getLead(id) {
  return db.prepare(`${LEAD_SELECT} WHERE l.id = ?`).get(id);
}

function audit(leadId, userId, action, detail) {
  db.prepare('INSERT INTO lead_audit (lead_id,user_id,action,detail,created_at) VALUES (?,?,?,?,?)')
    .run(leadId, userId, action, detail || null, now());
}

function activeRepExists(id) {
  const row = db.prepare(`SELECT id FROM users WHERE id = ? AND status = 'active'
                          AND role IN ('rep_internal','rep_external')`).get(id);
  return !!row;
}

router.use(requireAuth);

router.get('/', (req, res) => {
  const user = req.user;
  const where = [];
  const params = [];

  if (user.role !== 'admin') {
    where.push('l.owner_id = ?');
    params.push(user.id);
  } else if (req.query.owner_id === 'none') {
    where.push('l.owner_id IS NULL');
  } else if (req.query.owner_id) {
    where.push('l.owner_id = ?');
    params.push(Number(req.query.owner_id));
  }

  const status = str(req.query.status);
  if (status) {
    const keys = status.split(',').map((s) => s.trim()).filter(Boolean);
    if (keys.length) {
      where.push(`l.status IN (${keys.map(() => '?').join(',')})`);
      params.push(...keys);
    }
  }

  if (req.query.source_id) {
    where.push('l.source_id = ?');
    params.push(Number(req.query.source_id));
  }

  const q = str(req.query.q);
  if (q) {
    where.push('(l.contact_name LIKE ? ESCAPE \'\\\' OR l.company LIKE ? ESCAPE \'\\\' OR l.email LIKE ? ESCAPE \'\\\' OR l.phone LIKE ? ESCAPE \'\\\')');
    const p = likeParam(q);
    params.push(p, p, p, p);
  }

  if (req.query.from) { where.push('date(l.created_at) >= date(?)'); params.push(str(req.query.from)); }
  if (req.query.to) { where.push('date(l.created_at) <= date(?)'); params.push(str(req.query.to)); }

  const ownerFilter = req.query.owner_id;
  const sql = `${LEAD_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.updated_at DESC`;
  let leads = db.prepare(sql).all(...params).map((l) => decorate(l));

  if (req.query.stalled === '1') leads = leads.filter((l) => l.stalled);

  const limit = Math.min(intOrNull(req.query.limit) || 500, 1000);
  const total = leads.length;
  leads = leads.slice(0, limit);

  res.json({
    leads,
    total,
    stalledDays: stalledDays(),
    ownerFilter: ownerFilter === undefined ? null : ownerFilter
  });
});

function findLeadByName(name, excludeId) {
  const normalized = str(name);
  if (!normalized) return null;
  if (excludeId) {
    return db.prepare(`${LEAD_SELECT} WHERE LOWER(TRIM(l.contact_name)) = LOWER(?) AND l.id != ? LIMIT 1`)
      .get(normalized, excludeId);
  }
  return db.prepare(`${LEAD_SELECT} WHERE LOWER(TRIM(l.contact_name)) = LOWER(?) LIMIT 1`).get(normalized);
}

router.get('/suggest', (req, res) => {
  const q = str(req.query.q);
  const excludeId = intOrNull(req.query.exclude_id);
  if (!q || q.length < 1) return res.json({ leads: [], duplicate: null });
  const where = ['(l.contact_name LIKE ? ESCAPE \'\\\' OR l.company LIKE ? ESCAPE \'\\\')'];
  const params = [likeParam(q), likeParam(q)];
  if (excludeId) {
    where.push('l.id != ?');
    params.push(excludeId);
  }
  if (req.user.role !== 'admin') {
    where.push('l.owner_id = ?');
    params.push(req.user.id);
  }
  const rows = db.prepare(`${LEAD_SELECT} WHERE ${where.join(' AND ')} ORDER BY l.updated_at DESC LIMIT 8`)
    .all(...params)
    .map((l) => decorate(l));
  const duplicate = findLeadByName(q, excludeId);
  res.json({ leads: rows, duplicate: duplicate ? decorate(duplicate) : null });
});

router.post('/', (req, res) => {
  const user = req.user;
  const contactName = str(req.body?.contact_name);
  if (!contactName) return res.status(400).json({ error: 'Informe o nome do contato ou empresa.' });
  const duplicate = findLeadByName(contactName);
  if (duplicate) {
    return res.status(409).json({ error: 'Lead ja cadastrado com esse nome.', existingId: duplicate.id });
  }

  const column = req.body?.status ? getColumn(str(req.body.status)) : firstColumn();
  if (!column) return res.status(400).json({ error: 'Status inicial invalido.' });

  let ownerId = null;
  if (user.role === 'admin') {
    ownerId = intOrNull(req.body?.owner_id);
    if (ownerId && !activeRepExists(ownerId)) {
      return res.status(400).json({ error: 'Representante invalido ou inativo.' });
    }
  } else {
    ownerId = user.id;
  }

  let sourceId = intOrNull(req.body?.source_id);
  if (sourceId && !db.prepare('SELECT id FROM sources WHERE id = ?').get(sourceId)) sourceId = null;

  const ts = now();
  const info = db.prepare(`
    INSERT INTO leads (contact_name,company,phone,email,source_id,owner_id,status,estimated_value,notes,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    contactName,
    str(req.body?.company),
    str(req.body?.phone),
    str(req.body?.email),
    sourceId,
    ownerId,
    column.key,
    numberOrNull(req.body?.estimated_value),
    str(req.body?.notes),
    user.id,
    ts,
    ts
  );

  const leadId = info.lastInsertRowid;
  audit(leadId, user.id, 'created', `Lead criado com status "${column.label}".`);

  if (ownerId && ownerId !== user.id) {
    createNotification({
      userId: ownerId,
      type: 'lead_assigned',
      title: 'Novo lead atribuido a voce',
      body: `${contactName}`,
      leadId
    });
  }

  res.status(201).json({ lead: decorate(getLead(leadId)) });
});

router.get('/:id', (req, res) => {
  const lead = getLead(Number(req.params.id));
  if (!lead) return res.status(404).json({ error: 'Lead nao encontrado.' });
  if (!canAccess(req.user, lead)) return res.status(403).json({ error: 'Voce nao tem acesso a este lead.' });
  res.json({ lead: decorate(lead), stalledDays: stalledDays() });
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const lead = getLead(id);
  if (!lead) return res.status(404).json({ error: 'Lead nao encontrado.' });
  if (!canAccess(req.user, lead)) return res.status(403).json({ error: 'Voce nao tem acesso a este lead.' });

  const contactName = 'contact_name' in req.body ? str(req.body.contact_name) : lead.contact_name;
  if (!contactName) return res.status(400).json({ error: 'Nome do contato nao pode ficar vazio.' });
  const duplicate = findLeadByName(contactName, id);
  if (duplicate) {
    return res.status(409).json({ error: 'Lead ja cadastrado com esse nome.', existingId: duplicate.id });
  }

  let sourceId = lead.source_id;
  if ('source_id' in req.body) {
    sourceId = intOrNull(req.body.source_id);
    if (sourceId && !db.prepare('SELECT id FROM sources WHERE id = ?').get(sourceId)) sourceId = null;
  }

  const estimated = 'estimated_value' in req.body ? numberOrNull(req.body.estimated_value) : lead.estimated_value;

  db.prepare(`
    UPDATE leads SET contact_name=?, company=?, phone=?, email=?, source_id=?, estimated_value=?, notes=?, updated_at=?
    WHERE id=?
  `).run(
    contactName,
    'company' in req.body ? str(req.body.company) : lead.company,
    'phone' in req.body ? str(req.body.phone) : lead.phone,
    'email' in req.body ? str(req.body.email) : lead.email,
    sourceId,
    estimated,
    'notes' in req.body ? str(req.body.notes) : lead.notes,
    now(),
    id
  );

  audit(id, req.user.id, 'updated', 'Dados do lead atualizados.');
  res.json({ lead: decorate(getLead(id)) });
});

router.post('/:id/assign', (req, res) => {
  const id = Number(req.params.id);
  const lead = getLead(id);
  if (!lead) return res.status(404).json({ error: 'Lead nao encontrado.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas o administrador pode reatribuir leads.' });

  const ownerId = intOrNull(req.body?.owner_id);
  if (ownerId && !activeRepExists(ownerId)) {
    return res.status(400).json({ error: 'Representante invalido ou inativo.' });
  }
  if (ownerId === lead.owner_id) return res.json({ lead: decorate(lead) });

  db.prepare('UPDATE leads SET owner_id=?, updated_at=? WHERE id=?').run(ownerId, now(), id);
  audit(id, req.user.id, 'assigned', `Lead atribuido a ${ownerId ? '(id ' + ownerId + ')' : 'ninguem'}.`);

  if (ownerId) {
    createNotification({
      userId: ownerId,
      type: 'lead_assigned',
      title: lead.owner_id ? 'Um lead foi transferido para voce' : 'Novo lead atribuido a voce',
      body: `${lead.contact_name}${lead.company ? ' - ' + lead.company : ''}`,
      leadId: id
    });
  }

  res.json({ lead: decorate(getLead(id)) });
});

router.post('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const lead = getLead(id);
  if (!lead) return res.status(404).json({ error: 'Lead nao encontrado.' });
  if (!canAccess(req.user, lead)) return res.status(403).json({ error: 'Voce nao tem acesso a este lead.' });

  const column = getColumn(str(req.body?.status));
  if (!column) return res.status(400).json({ error: 'Status invalido.' });
  if (column.key === lead.status) return res.json({ lead: decorate(lead), unchanged: true });

  const interactionCount = lead.interaction_count || 0;
  if (interactionCount < column.min_interactions) {
    return res.status(400).json({
      error: `Para mover para "${column.label}" registre ao menos ${column.min_interactions} interacao(oes) no historico do lead.`
    });
  }

  let lossReason = str(req.body?.loss_reason);
  if (column.requires_loss && !lossReason) {
    return res.status(400).json({ error: 'Informe o motivo da perda para mover o lead para esta etapa.' });
  }
  if (!column.is_lost) lossReason = null;

  db.prepare('UPDATE leads SET status=?, loss_reason=?, updated_at=? WHERE id=?')
    .run(column.key, lossReason, now(), id);
  audit(id, req.user.id, 'status', `Status alterado de "${lead.status_label}" para "${column.label}".`);

  if (column.is_won) {
    notifyAdmins({
      type: 'lead_won',
      title: 'Lead fechado (ganho)',
      body: `${lead.contact_name}${lead.company ? ' - ' + lead.company : ''} fechado por ${req.user.name}.`,
      leadId: id
    });
  }
  if (column.is_lost) {
    notifyAdmins({
      type: 'lead_lost',
      title: 'Lead marcado como perdido',
      body: `${lead.contact_name}: ${lossReason}`,
      leadId: id
    });
  }

  res.json({ lead: decorate(getLead(id)) });
});

router.get('/:id/interactions', (req, res) => {
  const lead = getLead(Number(req.params.id));
  if (!lead) return res.status(404).json({ error: 'Lead nao encontrado.' });
  if (!canAccess(req.user, lead)) return res.status(403).json({ error: 'Voce nao tem acesso a este lead.' });

  const rows = db.prepare(`
    SELECT i.*, u.name AS author_name, u.role AS author_role
    FROM interactions i LEFT JOIN users u ON u.id = i.user_id
    WHERE i.lead_id = ? ORDER BY i.created_at DESC, i.id DESC
  `).all(lead.id);
  res.json({ interactions: rows });
});

router.post('/:id/interactions', (req, res) => {
  const id = Number(req.params.id);
  const lead = getLead(id);
  if (!lead) return res.status(404).json({ error: 'Lead nao encontrado.' });
  if (!canAccess(req.user, lead)) return res.status(403).json({ error: 'Voce nao tem acesso a este lead.' });

  const type = str(req.body?.type);
  const summary = str(req.body?.summary);
  if (!type || !INTERACTION_TYPES.includes(type)) return res.status(400).json({ error: 'Tipo de interacao invalido.' });
  if (!summary) return res.status(400).json({ error: 'Descreva o que foi feito na interacao.' });

  const ts = now();
  const info = db.prepare('INSERT INTO interactions (lead_id,user_id,type,summary,created_at) VALUES (?,?,?,?,?)')
    .run(id, req.user.id, type, summary, ts);

  let autoMovedTo = null;
  let newStatus = lead.status;
  if (lead.status === 'new') {
    const next = getColumn('first_contact');
    if (next) {
      newStatus = next.key;
      autoMovedTo = next.label;
      audit(id, req.user.id, 'status', `Status movido automaticamente para "${next.label}" apos o primeiro registro.`);
    }
  }

  db.prepare('UPDATE leads SET last_interaction_at=?, updated_at=?, status=? WHERE id=?').run(ts, ts, newStatus, id);
  audit(id, req.user.id, 'interaction', `Interacao registrada (${type}).`);

  res.status(201).json({
    interaction: db.prepare(`
      SELECT i.*, u.name AS author_name, u.role AS author_role
      FROM interactions i LEFT JOIN users u ON u.id = i.user_id WHERE i.id = ?
    `).get(info.lastInsertRowid),
    lead: decorate(getLead(id)),
    autoMovedTo
  });
});

router.post('/:id/request-assistance', (req, res) => {
  const id = Number(req.params.id);
  const lead = getLead(id);
  if (!lead) return res.status(404).json({ error: 'Lead nao encontrado.' });
  if (!canAccess(req.user, lead)) return res.status(403).json({ error: 'Voce nao tem acesso a este lead.' });

  const message = str(req.body?.message) || 'Solicitacao de apoio sem detalhes.';
  for (const adminId of adminIds()) {
    createNotification({
      userId: adminId,
      type: 'assistance_request',
      title: `Solicitacao de ajuda: ${lead.contact_name}`,
      body: `${req.user.name}: ${message}`,
      leadId: id
    });
  }
  audit(id, req.user.id, 'assistance', `Solicitacao de ajuda enviada ao admin: ${message}`);
  res.json({ ok: true, message: 'Solicitacao enviada ao administrador.' });
});

router.get('/:id/audit', (req, res) => {
  const lead = getLead(Number(req.params.id));
  if (!lead) return res.status(404).json({ error: 'Lead nao encontrado.' });
  if (!canAccess(req.user, lead)) return res.status(403).json({ error: 'Voce nao tem acesso a este lead.' });
  const rows = db.prepare(`
    SELECT a.*, u.name AS author_name FROM lead_audit a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.lead_id = ? ORDER BY a.created_at DESC, a.id DESC
  `).all(lead.id);
  res.json({ audit: rows });
});

module.exports = { router, decorate, stalledDays, getLead, LEAD_SELECT };
