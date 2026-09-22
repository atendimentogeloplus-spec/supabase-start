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

    const pushOk = typeof PushNotify !== 'undefined' && PushNotify.supported();
    const pushState = pushOk ? await PushNotify.getState() : null;
    const pushGranted = !!(pushState && pushState.permission === 'granted');
    const pushDenied = !!(pushState && pushState.permission === 'denied');
    const needIosInstall = !!(pushState && pushState.ios && !pushState.standalone);
    const notSubscribed = !!(pushState && pushGranted && !pushState.subscribed);

    view.innerHTML = `
      ${App.pageHead('Notificacoes', `<button class="btn secondary sm" id="nt-readall" ${data.unreadCount ? '' : 'disabled'}>Marcar todas como lidas</button>`)}
      ${pushOk ? `
      <div class="panel mb" id="push-panel">
        <h3 class="panel-title">Avisos no celular / PWA</h3>
        <p class="small muted mb">${UI.esc(PushNotify.statusLabel(pushState))}.</p>
        ${needIosInstall ? `
        <div class="form-error mb">
          Voce esta no Safari, nao no app instalado. No iPhone: Compartilhar &gt; Adicionar a Tela de Inicio, depois abra o icone do LeadTrack e toque em Ativar avisos.
        </div>` : ''}
        ${notSubscribed && !needIosInstall ? `
        <div class="form-error mb">A permissao esta liberada, mas este aparelho ainda nao foi inscrito no servidor. Toque em Ativar avisos.</div>` : ''}
        <div class="flex flex-wrap">
          <button class="btn sm" id="nt-enable">${pushState && pushState.subscribed ? 'Reativar neste aparelho' : 'Ativar avisos'}</button>
          <button class="btn secondary sm" id="nt-test" ${pushGranted || !needIosInstall ? '' : 'disabled'}>Enviar teste</button>
        </div>
        ${pushDenied ? '<div class="form-error mt">O navegador bloqueou as notificacoes. Libere-as em Ajustes &gt; Notificacoes e recarregue.</div>' : ''}
      </div>` : ''}
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

    const enableBtn = view.querySelector('#nt-enable');
    if (enableBtn) enableBtn.onclick = async () => {
      try {
        await PushNotify.enable();
        UI.toast('Avisos ativados neste aparelho.', 'success');
        render(view);
      } catch (err) { UI.toast(err.message, 'error'); }
    };
    const testBtn = view.querySelector('#nt-test');
    if (testBtn) testBtn.onclick = async () => {
      testBtn.disabled = true;
      try {
        const result = await PushNotify.sendTest();
        UI.toast(result.message, result.remote ? 'success' : 'info');
        if (!result.remote) render(view);
      } catch (err) {
        UI.toast(err.message, 'error');
      } finally {
        testBtn.disabled = false;
      }
    };

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
