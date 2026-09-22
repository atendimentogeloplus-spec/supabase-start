'use strict';

const App = (() => {
  let booted = false;
  let notifTimer = null;

  const NAV = [
    { id: 'dashboard', label: 'Painel', href: '#/dashboard', icon: 'dashboard', adminOnly: true },
    { id: 'kanban', label: 'Kanban', href: '#/kanban', icon: 'kanban' },
    { id: 'leads', label: 'Leads', href: '#/leads', icon: 'list' },
    { id: 'users', label: 'Usuarios', href: '#/users', icon: 'users', adminOnly: true },
    { id: 'settings', label: 'Config.', href: '#/settings', icon: 'settings', adminOnly: true },
    { id: 'notifications', label: 'Avisos', href: '#/notifications', icon: 'bell' }
  ];

  function navItems() {
    const isAdmin = State.user && State.user.role === 'admin';
    return NAV.filter((n) => !n.adminOnly || isAdmin);
  }

  function buildNav() {
    const sidebar = document.getElementById('sidebar');
    const tabbar = document.getElementById('tabbar');
    sidebar.innerHTML = navItems().map((n) => `
      <a href="${n.href}" data-nav="${n.id}">
        ${UI.icon(n.icon)}
        <span>${n.label}</span>
        ${n.id === 'notifications' ? '<span class="sb-badge hidden" data-badge></span>' : ''}
      </a>`).join('');
    tabbar.innerHTML = navItems().map((n) => `
      <a href="${n.href}" data-nav="${n.id}">
        ${UI.icon(n.icon)}
        <span>${n.label}</span>
        ${n.id === 'notifications' ? '<span class="tab-badge hidden" data-badge></span>' : ''}
      </a>`).join('');
  }

  function highlightNav(route) {
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const id = a.dataset.nav;
      const active = route.startsWith('/' + id) || (id === 'leads' && route.startsWith('/leads'));
      a.classList.toggle('active', active);
    });
  }

  async function start() {
    booted = true;
    document.getElementById('app-shell').classList.remove('hidden');
    document.getElementById('user-name').textContent = State.user.name;
    document.getElementById('user-role').textContent = UI.roleLabel(State.user.role);
    buildNav();
    try { await refreshConfig(); } catch { /* mantem defaults */ }
    loadNotifications();
    if (!notifTimer) notifTimer = setInterval(loadNotifications, 30000);
    route();
    if (State.user.mustChangePassword) openAccountModal({ forced: true });
    if (typeof PushNotify !== 'undefined') {
      setTimeout(() => PushNotify.maybePrompt().catch(() => {}), 1800);
      if (PushNotify.permission() === 'granted') {
        PushNotify.subscribePush().catch(() => {});
      }
    }
  }

  async function refreshConfig() {
    const [config, settings] = await Promise.all([
      Api.get('/api/config'),
      Api.get('/api/settings')
    ]);
    State.config = config;
    State.columns = config.columns || [];
    State.sources = settings.sources || [];
    if (settings.company_name) State.config.company_name = settings.company_name;
    State.config.stalled_days = settings.stalled_days;
    document.getElementById('brand-name').textContent = State.config.company_name || 'LeadTrack';
    document.title = `${State.config.company_name || 'LeadTrack'} - Acompanhamento de Leads`;
  }

  function onUnauthorized() {
    if (!booted) return;
    booted = false;
    if (notifTimer) { clearInterval(notifTimer); notifTimer = null; }
    State.user = null;
    document.getElementById('app-shell').classList.add('hidden');
    Auth.renderLogin();
    UI.toast('Sua sessao expirou. Entre novamente.', 'info');
  }

  async function loadNotifications() {
    if (!State.user) return;
    try {
      const data = await Api.get('/api/notifications?unread=1&limit=20', { skipAuthRedirect: true });
      State.unreadCount = data.unreadCount;
      updateBadges();
      if (typeof PushNotify !== 'undefined') {
        PushNotify.handleNewItems(data.notifications || [], data.unreadCount);
      }
    } catch { /* ignore polling errors */ }
  }

  function updateBadges() {
    const badge = document.getElementById('bell-badge');
    if (State.unreadCount > 0) {
      badge.textContent = State.unreadCount > 99 ? '99+' : State.unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
    document.querySelectorAll('[data-badge]').forEach((b) => {
      if (State.unreadCount > 0) {
        b.textContent = State.unreadCount > 99 ? '99+' : State.unreadCount;
        b.classList.remove('hidden');
      } else {
        b.classList.add('hidden');
      }
    });
  }

  function parseHash() {
    const raw = (location.hash || '').replace(/^#/, '');
    const parts = raw.split('/').filter(Boolean);
    return { parts, route: '/' + parts.join('/') };
  }

  async function route() {
    if (!State.user) return;
    const { parts, route } = parseHash();
    const isAdmin = State.user.role === 'admin';
    const view = document.getElementById('view');
    highlightNav(route || '/kanban');
    window.scrollTo(0, 0);

    if (parts.length === 0) {
      location.hash = isAdmin ? '#/dashboard' : '#/kanban';
      return;
    }

    const top = parts[0];
    try {
      if (top === 'kanban') { highlightNav('/kanban'); return Kanban.render(view); }
      if (top === 'leads' && parts[1]) { highlightNav('/leads'); return Leads.renderDetail(view, Number(parts[1])); }
      if (top === 'leads') { highlightNav('/leads'); return Leads.renderList(view); }
      if (top === 'dashboard') {
        if (!isAdmin) { location.hash = '#/kanban'; return; }
        return Dashboard.render(view);
      }
      if (top === 'users') {
        if (!isAdmin) { location.hash = '#/kanban'; return; }
        return Users.render(view);
      }
      if (top === 'settings') {
        if (!isAdmin) { location.hash = '#/kanban'; return; }
        return Settings.render(view);
      }
      if (top === 'notifications') return Notifications.render(view);
      if (top === 'login' || top === 'register') { Auth.renderLogin(); return; }
      view.innerHTML = `<div class="empty-state"><h3>Pagina nao encontrada</h3></div>`;
    } catch (err) {
      view.innerHTML = `<div class="panel"><div class="form-error">${UI.esc(err.message)}</div></div>`;
    }
  }

  function openAccountModal({ forced = false } = {}) {
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="form-error hidden" id="ac-error"></div>
      ${forced
        ? '<p class="mb">Sua senha atual e temporaria. Defina uma nova senha para continuar.</p>'
        : `<div class="flex small muted mb">Logado como <b>${UI.esc(State.user.email)}</b> - ${UI.esc(UI.roleLabel(State.user.role))}</div>`}
      <div class="field">
        <label for="ac-current">Senha atual</label>
        <input id="ac-current" type="password" autocomplete="current-password" required placeholder="Sua senha atual">
      </div>
      <div class="field">
        <label for="ac-new">Nova senha</label>
        <input id="ac-new" type="password" autocomplete="new-password" required placeholder="Minimo 6 caracteres">
      </div>
      <div class="field">
        <label for="ac-confirm">Confirmar nova senha</label>
        <input id="ac-confirm" type="password" autocomplete="new-password" required placeholder="Repita a nova senha">
      </div>
    `;

    const modal = UI.modal({
      title: forced ? 'Definir nova senha' : 'Minha conta',
      body: form,
      footer: forced
        ? `<button class="btn danger" data-act="logout">Sair</button>
           <button class="btn" data-act="save">Salvar nova senha</button>`
        : `<button class="btn secondary" data-act="cancel">Cancelar</button>
           <button class="btn" data-act="save">Alterar senha</button>`,
      onClose: forced ? () => { /* mantem sessao; usuario decide */ } : undefined
    });

    if (!forced && typeof PWA !== 'undefined' && PWA.isInstallable()) {
      const installRow = document.createElement('div');
      installRow.className = 'mt';
      installRow.innerHTML = '<button type="button" class="btn secondary block sm" id="ac-install">Instalar aplicativo no dispositivo</button>';
      form.appendChild(installRow);
      installRow.querySelector('#ac-install').onclick = () => PWA.promptInstall();
    }

    if (!forced && typeof PushNotify !== 'undefined' && PushNotify.supported()) {
      const pushRow = document.createElement('div');
      pushRow.className = 'mt';
      const granted = PushNotify.permission() === 'granted';
      pushRow.innerHTML = `
        <div class="small muted mb">${UI.esc(PushNotify.statusLabel())}</div>
        <button type="button" class="btn ${granted ? 'secondary' : ''} block sm" id="ac-push">
          ${granted ? 'Ativar / reinscrever avisos neste aparelho' : 'Ativar avisos no celular'}
        </button>
      `;
      form.appendChild(pushRow);
      pushRow.querySelector('#ac-push').onclick = async () => {
        try {
          await PushNotify.enable();
          UI.toast('Avisos ativados neste aparelho.', 'success');
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      };
    }

    const errBox = form.querySelector('#ac-error');
    const cancelBtn = modal.foot.querySelector('[data-act="cancel"]');
    if (cancelBtn) cancelBtn.onclick = () => modal.close();
    const logoutBtn = modal.foot.querySelector('[data-act="logout"]');
    if (logoutBtn) logoutBtn.onclick = () => { modal.close(); Auth.logout(); };

    modal.foot.querySelector('[data-act="save"]').onclick = async () => {
      errBox.classList.add('hidden');
      const current = form.querySelector('#ac-current').value;
      const next = form.querySelector('#ac-new').value;
      const confirm = form.querySelector('#ac-confirm').value;
      if (next.length < 6) { errBox.textContent = 'A nova senha deve ter ao menos 6 caracteres.'; errBox.classList.remove('hidden'); return; }
      if (next !== confirm) { errBox.textContent = 'A confirmacao nao confere com a nova senha.'; errBox.classList.remove('hidden'); return; }
      const btn = modal.foot.querySelector('[data-act="save"]');
      btn.disabled = true;
      try {
        await Api.post('/api/auth/change-password', { current_password: current, new_password: next });
        State.user.mustChangePassword = false;
        modal.close();
        UI.toast('Senha alterada com sucesso.', 'success');
      } catch (err) {
        btn.disabled = false;
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      }
    };
  }

  function pageHead(title, actions = '') {
    return `<div class="page-head"><h2>${UI.esc(title)}</h2><div class="spacer"></div>${actions}</div>`;
  }

  function loading(view) {
    view.innerHTML = `<div class="empty-state">Carregando...</div>`;
  }

  function init() {
    document.getElementById('logout-btn').addEventListener('click', async () => {
      if (await UI.confirm('Deseja sair do sistema?', { okLabel: 'Sair' })) Auth.logout();
    });
    document.getElementById('bell-btn').addEventListener('click', () => { location.hash = '#/notifications'; });
    document.getElementById('user-chip').addEventListener('click', () => openAccountModal());
    window.addEventListener('hashchange', route);
    Auth.bootstrap();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    start, route, onUnauthorized, refreshConfig, loadNotifications, updateBadges,
    pageHead, loading, openAccountModal
  };
})();
