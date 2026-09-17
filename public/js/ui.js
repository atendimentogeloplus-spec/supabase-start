'use strict';

const UI = (() => {
  const ICONS = {
    kanban: '<path d="M4 4h4v16H4z"></path><path d="M10 4h4v10h-4z"></path><path d="M16 4h4v7h-4z"></path>',
    list: '<path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path>',
    dashboard: '<rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path>',
    plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
    back: '<path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"></path>',
    check: '<path d="M20 6L9 17l-5-5"></path>',
    x: '<path d="M18 6L6 18"></path><path d="M6 6l12 12"></path>',
    clock: '<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"></path>',
    chart: '<path d="M3 3v18h18"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path>'
  };

  function icon(name, cls = 'icon') {
    const path = ICONS[name] || '';
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  }

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function el(tag, attrs = {}, html = '') {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else node.setAttribute(k, v);
    }
    if (html) node.innerHTML = html;
    return node;
  }

  function toast(message, type = 'info') {
    const box = document.getElementById('toast');
    const node = el('div', { class: `toast ${type}` }, esc(message));
    box.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity .25s';
      node.style.opacity = '0';
      setTimeout(() => node.remove(), 260);
    }, 3600);
  }

  function modal({ title, body, footer, onClose } = {}) {
    const root = document.getElementById('modal-root');
    const backdrop = el('div', { class: 'modal-backdrop' });
    const card = el('div', { class: 'modal' });
    const head = el('div', { class: 'modal-head' },
      `<h3>${esc(title || '')}</h3><button class="modal-close" aria-label="Fechar">&times;</button>`);
    const bodyNode = el('div', { class: 'modal-body' });
    if (body instanceof HTMLElement) bodyNode.appendChild(body);
    else bodyNode.innerHTML = body || '';
    card.appendChild(head);
    card.appendChild(bodyNode);
    if (footer) {
      const foot = el('div', { class: 'modal-foot' });
      if (footer instanceof HTMLElement) foot.appendChild(footer);
      else foot.innerHTML = footer;
      card.appendChild(foot);
    }
    backdrop.appendChild(card);
    root.appendChild(backdrop);

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      if (typeof onClose === 'function') onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    head.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey);

    return { close, backdrop, card, body: bodyNode, foot: card.querySelector('.modal-foot') };
  }

  function confirm(message, { title = 'Confirmar', okLabel = 'Confirmar', danger = false } = {}) {
    return new Promise((resolve) => {
      const m = modal({
        title,
        body: `<p>${esc(message)}</p>`,
        footer: `
          <button class="btn secondary" data-act="cancel">Cancelar</button>
          <button class="btn ${danger ? 'danger' : ''}" data-act="ok">${esc(okLabel)}</button>`
      });
      m.foot.querySelector('[data-act="cancel"]').onclick = () => { m.close(); resolve(false); };
      m.foot.querySelector('[data-act="ok"]').onclick = () => { m.close(); resolve(true); };
    });
  }

  const ROLE_LABELS = {
    admin: 'Administrador',
    rep_internal: 'Representante Interno',
    rep_external: 'Representante Externo'
  };
  const STATUS_LABELS = {
    pending: 'Pendente',
    active: 'Ativo',
    rejected: 'Rejeitado',
    disabled: 'Desativado'
  };
  const INTERACTION_LABELS = {
    call: 'Ligacao',
    whatsapp: 'WhatsApp',
    email: 'E-mail',
    meeting: 'Reuniao',
    visit: 'Visita',
    other: 'Outro'
  };
  const INTERACTION_GLYPHS = {
    call: 'L',
    whatsapp: 'W',
    email: 'E',
    meeting: 'R',
    visit: 'V',
    other: 'O'
  };

  function roleLabel(role) { return ROLE_LABELS[role] || role || '-'; }
  function statusLabel(status) { return STATUS_LABELS[status] || status || '-'; }
  function interactionLabel(type) { return INTERACTION_LABELS[type] || type || '-'; }
  function interactionGlyph(type) { return INTERACTION_GLYPHS[type] || 'O'; }

  const dtf = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const df = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  function fmtDateTime(iso) { return iso ? dtf.format(new Date(iso)) : '-'; }
  function fmtDate(iso) { return iso ? df.format(new Date(iso)) : '-'; }
  function currency(value) {
    if (value === null || value === undefined || value === '') return '';
    return money.format(Number(value));
  }

  function timeAgo(iso) {
    if (!iso) return 'sem registros';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `ha ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `ha ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ha 1 dia';
    if (days < 30) return `ha ${days} dias`;
    const months = Math.floor(days / 30);
    if (months < 12) return `ha ${months} ${months === 1 ? 'mes' : 'meses'}`;
    return `ha ${Math.floor(months / 12)} ano(s)`;
  }

  function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    return ((parts[0][0] || '') + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function daysLabel(days) {
    if (days <= 0) return 'hoje';
    if (days === 1) return '1 dia';
    return `${days} dias`;
  }

  function stallLevel(days, threshold) {
    if (days >= threshold) return 'red';
    if (threshold > 0 && days >= Math.ceil(threshold * 0.6)) return 'amber';
    return 'green';
  }

  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function options(list, selected, valueKey = 'value', labelKey = 'label') {
    return list.map((item) => {
      const value = typeof item === 'object' ? item[valueKey] : item;
      const label = typeof item === 'object' ? item[labelKey] : item;
      const sel = String(value) === String(selected) ? ' selected' : '';
      return `<option value="${esc(value)}"${sel}>${esc(label)}</option>`;
    }).join('');
  }

  return {
    icon, esc, el, toast, modal, confirm,
    roleLabel, statusLabel, interactionLabel, interactionGlyph,
    fmtDateTime, fmtDate, currency, timeAgo, initials, daysLabel, stallLevel,
    debounce, options
  };
})();
