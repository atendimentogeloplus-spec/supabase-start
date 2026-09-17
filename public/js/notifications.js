'use strict';

const Notifications = (() => {
  const TYPE_LETTERS = {
    user_pending: 'N',
    account_approved: 'OK',
    account_rejected: 'X',
    account_updated: 'A',
    lead_assigned: 'L',
    lead_stalled: '!',
    lead_won: 'W',
    lead_lost: 'P',
    assistance_request: '?',
    password_reset_request: 'S',
    password_reset: 'S'
  };

  async function render(view) {
    App.loading(view);
    const data = await Api.get('/api/notifications?limit=100');
    const items = data.notifications;
    State.unreadCount = data.unreadCount;
    App.updateBadges();

    view.innerHTML = `
      ${App.pageHead('Notificacoes', `<button class="btn secondary sm" id="nt-readall" ${data.unreadCount ? '' : 'disabled'}>Marcar todas como lidas</button>`)}
      <div class="panel">
        ${items.length ? items.map((n) => `
          <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" data-lead="${n.lead_id || ''}" style="cursor:pointer">
            <div class="tl-icon">${TYPE_LETTERS[n.type] || 'N'}</div>
            <div class="n-body">
              <div class="n-title">${UI.esc(n.title)} ${n.is_read ? '' : '<span class="badge-dot red"></span>'}</div>
              ${n.body ? `<div class="n-text">${UI.esc(n.body)}</div>` : ''}
              <div class="n-time">${UI.fmtDateTime(n.created_at)}${n.lead_contact ? ' - lead: ' + UI.esc(n.lead_contact) : ''}</div>
            </div>
          </div>`).join('')
          : '<div class="empty-state"><h3>Sem notificacoes</h3><p>Voce esta em dia.</p></div>'}
      </div>
    `;

    const readAll = view.querySelector('#nt-readall');
    if (readAll) readAll.onclick = async () => {
      await Api.post('/api/notifications/read-all', {});
      State.unreadCount = 0;
      App.updateBadges();
      render(view);
    };

    view.querySelectorAll('.notif-item').forEach((item) => {
      item.onclick = async () => {
        const id = item.dataset.id;
        const leadId = item.dataset.lead;
        try { await Api.post(`/api/notifications/${id}/read`, {}); } catch { /* ignore */ }
        State.unreadCount = Math.max(0, State.unreadCount - 1);
        App.updateBadges();
        if (leadId) location.hash = `#/leads/${leadId}`;
        else render(view);
      };
    });
  }

  return { render };
})();
