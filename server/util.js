'use strict';

function now() {
  return new Date().toISOString();
}

function str(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  return v === '' ? null : v;
}

function intOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function boolInt(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  return 0;
}

function daysSince(iso) {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.floor((Date.now() - then) / 86400000);
}

function toIsoDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function likeParam(q) {
  const escaped = String(q).replace(/[\\%_]/g, (m) => `\\${m}`);
  return `%${escaped}%`;
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatDate(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

module.exports = {
  now,
  str,
  intOrNull,
  numberOrNull,
  boolInt,
  daysSince,
  toIsoDateOnly,
  likeParam,
  isEmail,
  formatDate
};
