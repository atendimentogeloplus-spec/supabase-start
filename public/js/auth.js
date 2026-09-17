'use strict';

const Auth = (() => {
  const screen = () => document.getElementById('auth-screen');
  const card = () => document.getElementById('auth-card');

  function show() {
    screen().classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  }
  function hide() {
    screen().classList.add('hidden');
  }

  async function bootstrap() {
    show();
    card().innerHTML = `<div class="center muted">Carregando...</div>`;
    try {
      const data = await Api.get('/api/auth/me', { skipAuthRedirect: true });
      State.user = data.user;
      hide();
      App.start();
    } catch (err) {
      if (err.status === 403) {
        showStatus(err.code, err.message);
      } else {
        renderLogin();
      }
    }
  }

  function renderLogin(prefillEmail) {
    show();
    card().innerHTML = `
      <h1>Acessar o sistema</h1>
      <p class="brand-sub">Acompanhamento e gestao de leads de vendas</p>
      <div class="form-error hidden" id="login-error"></div>
      <form id="login-form" novalidate>
        <div class="field">
          <label for="li-email">E-mail</label>
          <input id="li-email" type="email" autocomplete="username" required value="${UI.esc(prefillEmail || '')}" placeholder="voce@empresa.com">
        </div>
        <div class="field">
          <label for="li-pass">Senha</label>
          <input id="li-pass" type="password" autocomplete="current-password" required placeholder="Sua senha">
        </div>
        <button class="btn block" type="submit" id="login-submit">Entrar</button>
      </form>
      <div class="auth-switch">
        Nao tem conta? <a href="#/register" id="to-register">Solicitar cadastro</a>
      </div>
      <div class="auth-switch">
        <a href="#/forgot" id="to-forgot">Esqueci minha senha</a>
      </div>
      <details class="mt small muted">
        <summary>Primeiro acesso</summary>
        <div class="mt">Administrador padrao: <b>admin@leadtrack.local</b> / <b>admin123</b></div>
      </details>
    `;
    card().querySelector('#to-register').onclick = (e) => { e.preventDefault(); renderRegister(); };
    card().querySelector('#to-forgot').onclick = (e) => { e.preventDefault(); renderForgot(); };
    card().querySelector('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      const errBox = card().querySelector('#login-error');
      const btn = card().querySelector('#login-submit');
      errBox.classList.add('hidden');
      btn.disabled = true;
      btn.textContent = 'Entrando...';
      try {
        const data = await Api.post('/api/auth/login', {
          email: card().querySelector('#li-email').value.trim(),
          password: card().querySelector('#li-pass').value
        });
        State.user = data.user;
        hide();
        App.start();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Entrar';
        if (err.status === 403) {
          showStatus((err.code === 'pending') ? 'pending' : err.code, err.message);
          return;
        }
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      }
    };
  }

  function renderRegister() {
    show();
    card().innerHTML = `
      <h1>Solicitar cadastro</h1>
      <p class="brand-sub">Seu acesso sera analisado pelo administrador</p>
      <div class="form-error hidden" id="reg-error"></div>
      <form id="reg-form" novalidate>
        <div class="field">
          <label for="rg-name">Nome completo</label>
          <input id="rg-name" required placeholder="Seu nome">
        </div>
        <div class="field">
          <label for="rg-email">E-mail</label>
          <input id="rg-email" type="email" required placeholder="voce@empresa.com">
        </div>
        <div class="field">
          <label for="rg-phone">Telefone</label>
          <input id="rg-phone" placeholder="(00) 00000-0000">
        </div>
        <div class="field">
          <label for="rg-pass">Senha</label>
          <input id="rg-pass" type="password" required placeholder="Minimo 6 caracteres">
        </div>
        <button class="btn block" type="submit" id="reg-submit">Enviar cadastro</button>
      </form>
      <div class="auth-switch">Ja tem conta? <a href="#/login" id="to-login">Entrar</a></div>
    `;
    card().querySelector('#to-login').onclick = (e) => { e.preventDefault(); renderLogin(); };
    card().querySelector('#reg-form').onsubmit = async (e) => {
      e.preventDefault();
      const errBox = card().querySelector('#reg-error');
      const btn = card().querySelector('#reg-submit');
      errBox.classList.add('hidden');
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      try {
        await Api.post('/api/auth/register', {
          name: card().querySelector('#rg-name').value.trim(),
          email: card().querySelector('#rg-email').value.trim(),
          phone: card().querySelector('#rg-phone').value.trim(),
          password: card().querySelector('#rg-pass').value
        }, { skipAuthRedirect: true });
        showStatus('pending', 'Cadastro enviado com sucesso. Aguarde a aprovacao do administrador.');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Enviar cadastro';
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      }
    };
  }

  function renderForgot() {
    show();
    card().innerHTML = `
      <h1>Recuperar senha</h1>
      <p class="brand-sub">Informe seu e-mail; um administrador sera avisado para liberar o acesso</p>
      <div class="form-error hidden" id="fg-error"></div>
      <div class="form-success hidden" id="fg-ok"></div>
      <form id="fg-form" novalidate>
        <div class="field">
          <label for="fg-email">E-mail cadastrado</label>
          <input id="fg-email" type="email" required placeholder="voce@empresa.com">
        </div>
        <button class="btn block" type="submit" id="fg-submit">Solicitar recuperacao</button>
      </form>
      <div class="auth-switch">Lembrou a senha? <a href="#/login" id="fg-back">Voltar ao login</a></div>
    `;
    card().querySelector('#fg-back').onclick = (e) => { e.preventDefault(); renderLogin(); };
    card().querySelector('#fg-form').onsubmit = async (e) => {
      e.preventDefault();
      const errBox = card().querySelector('#fg-error');
      const okBox = card().querySelector('#fg-ok');
      const btn = card().querySelector('#fg-submit');
      errBox.classList.add('hidden');
      okBox.classList.add('hidden');
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      try {
        const data = await Api.post('/api/auth/forgot-password', {
          email: card().querySelector('#fg-email').value.trim()
        }, { skipAuthRedirect: true });
        okBox.textContent = data.message;
        okBox.classList.remove('hidden');
        card().querySelector('#fg-form').reset();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Solicitar recuperacao';
      }
    };
  }

  function showStatus(code, message) {
    show();
    const titles = {
      pending: 'Aguardando aprovacao',
      rejected: 'Cadastro rejeitado',
      disabled: 'Conta desativada'
    };
    const glyphs = { pending: 'AGUARDANDO', rejected: 'REJEITADO', disabled: 'DESATIVADO' };
    card().innerHTML = `
      <div class="status-icon small">${UI.esc(glyphs[code] || 'AVISO')}</div>
      <h1 class="center">${UI.esc(titles[code] || 'Aviso')}</h1>
      <p class="center muted mt">${UI.esc(message || 'Aguarde o contato do administrador.')}</p>
      <div class="mt">
        <button class="btn block secondary" id="st-login">Ir para o login</button>
      </div>
    `;
    card().querySelector('#st-login').onclick = () => renderLogin();
  }

  async function logout() {
    try { await Api.post('/api/auth/logout', {}, { skipAuthRedirect: true }); } catch { /* ignore */ }
    State.user = null;
    State.unreadCount = 0;
    document.getElementById('app-shell').classList.add('hidden');
    renderLogin();
    if (location.hash) location.hash = '#/login';
  }

  return { bootstrap, renderLogin, renderRegister, renderForgot, showStatus, logout, show, hide };
})();
