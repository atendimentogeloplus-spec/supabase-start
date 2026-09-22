'use strict';

const PushNotify = (() => {
  const STORAGE_KEY = 'lt_push_prompted';
  let lastUnread = 0;
  let lastSeenIds = new Set();
  let ready = false;
  let subscribed = false;

  function isIos() {
    if (typeof PWA !== 'undefined' && typeof PWA.isIos === 'function') return PWA.isIos();
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    if (typeof PWA !== 'undefined' && typeof PWA.isStandalone === 'function') return PWA.isStandalone();
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function supported() {
    return typeof window !== 'undefined'
      && 'Notification' in window
      && 'serviceWorker' in navigator;
  }

  function pushSupported() {
    return supported() && 'PushManager' in window;
  }

  function permission() {
    if (!supported()) return 'unsupported';
    return Notification.permission;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }

  function bufferToBase64Url(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function subscriptionPayload(sub) {
    if (!sub) return null;
    const json = typeof sub.toJSON === 'function' ? sub.toJSON() : {};
    const endpoint = json.endpoint || sub.endpoint;
    let p256dh = json.keys && json.keys.p256dh;
    let auth = json.keys && json.keys.auth;
    if ((!p256dh || !auth) && typeof sub.getKey === 'function') {
      const pKey = sub.getKey('p256dh');
      const aKey = sub.getKey('auth');
      if (pKey) p256dh = bufferToBase64Url(pKey);
      if (aKey) auth = bufferToBase64Url(aKey);
    }
    if (!endpoint || !p256dh || !auth) return null;
    return { endpoint, keys: { p256dh, auth } };
  }

  async function registration() {
    if (!('serviceWorker' in navigator)) return null;
    if (!navigator.serviceWorker.controller) {
      try { await navigator.serviceWorker.register('/sw.js'); } catch { /* ignore */ }
    }
    return navigator.serviceWorker.ready;
  }

  async function enable() {
    if (!supported()) throw new Error('Este navegador nao suporta notificacoes.');
    if (isIos() && !isStandalone()) {
      if (typeof PWA !== 'undefined') PWA.promptInstall();
      throw new Error('No iPhone, o aviso com o app fechado so funciona pelo icone da Tela de Inicio. Instale, abra o icone e toque em Ativar avisos.');
    }
    const result = await Notification.requestPermission();
    if (result !== 'granted') throw new Error('Permissao de notificacao recusada.');
    const ok = await subscribePush();
    if (!ok) {
      if (isIos()) {
        throw new Error('Permissao liberada, mas o iPhone nao concluiu a inscricao de push. Abra o app pelo icone da Tela de Inicio (nao pelo Safari) e toque em Ativar avisos.');
      }
      throw new Error('Nao foi possivel inscrever este aparelho para avisos remotos.');
    }
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    return true;
  }

  async function subscribePush() {
    if (!pushSupported()) return false;
    const reg = await registration();
    if (!reg || !reg.pushManager) return false;
    let key = State.config && State.config.vapidPublicKey;
    if (!key) {
      const data = await Api.get('/api/notifications/push/public-key');
      key = data.publicKey;
      if (State.config) State.config.vapidPublicKey = key;
    }
    if (!key) return false;
    try {
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key)
        });
      }
      let payload = subscriptionPayload(sub);
      if (!payload) {
        try { await sub.unsubscribe(); } catch { /* ignore */ }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key)
        });
        payload = subscriptionPayload(sub);
      }
      if (!payload) return false;
      await Api.post('/api/notifications/push/subscribe', {
        endpoint: payload.endpoint,
        keys: payload.keys
      });
      subscribed = true;
      return true;
    } catch (err) {
      console.warn('[push] inscricao falhou:', err && err.message);
      return false;
    }
  }

  async function disable() {
    const reg = await registration();
    if (!reg || !reg.pushManager) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      try {
        await Api.post('/api/notifications/push/unsubscribe', { endpoint: sub.endpoint });
      } catch { /* ignore */ }
      try { await sub.unsubscribe(); } catch { /* ignore */ }
    }
    subscribed = false;
  }

  async function showLocal(title, body, data) {
    if (!supported() || Notification.permission !== 'granted') return false;
    const payload = {
      title: title || 'LeadTrack',
      body: body || '',
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/favicon-32.png',
      tag: (data && data.tag) || 'leadtrack-local',
      data: data || { url: '/#/notifications' }
    };
    const reg = await registration();
    if (reg && reg.showNotification) {
      await reg.showNotification(payload.title, payload);
      return true;
    }
    try {
      new Notification(payload.title, { body: payload.body, tag: payload.tag });
      return true;
    } catch {
      return false;
    }
  }

  async function sendTest() {
    if (permission() !== 'granted') {
      await enable();
    } else if (pushSupported()) {
      try { await subscribePush(); } catch { /* tenta o teste mesmo assim */ }
    }

    try {
      await Api.post('/api/notifications/push/test', {});
      return { remote: true, local: false, message: 'Teste enviado. Confira a barra de notificacoes do aparelho.' };
    } catch (err) {
      const showed = await showLocal(
        'LeadTrack',
        'Teste neste aparelho. Se voce esta vendo isto, os avisos locais estao ativos.',
        { tag: 'push-test-local', url: '/#/notifications' }
      );
      if (showed) {
        const extra = isIos() && !isStandalone()
          ? ' No iPhone, instale o app na Tela de Inicio e abra pelo icone para receber aviso com o app fechado.'
          : ' O envio remoto ainda nao esta inscrito neste aparelho. Toque em Ativar avisos e tente de novo.';
        return { remote: false, local: true, message: 'Aviso local enviado.' + extra };
      }
      throw err;
    }
  }

  async function maybePrompt() {
    if (!supported() || Notification.permission !== 'default') return;
    try { if (localStorage.getItem(STORAGE_KEY)) return; } catch { /* ignore */ }
    const body = document.createElement('div');
    body.innerHTML = isIos() && !isStandalone()
      ? `<p class="mb">No iPhone, primeiro instale o LeadTrack na Tela de Inicio (Safari &gt; Compartilhar &gt; Adicionar a Tela de Inicio) e abra pelo icone. So assim os avisos chegam com o app fechado.</p>`
      : `<p class="mb">Ative os avisos neste aparelho para receber alerta quando um lead for atribuido, ficar parado ou houver cadastro pendente — mesmo com o app fechado (Android/Chrome e iPhone com o app na Tela de Inicio).</p>`;
    const modal = UI.modal({
      title: 'Ativar avisos no celular',
      body,
      footer: `<button class="btn secondary" data-act="later">Agora nao</button>
               <button class="btn" data-act="ok">${isIos() && !isStandalone() ? 'Como instalar' : 'Ativar avisos'}</button>`
    });
    modal.foot.querySelector('[data-act="later"]').onclick = () => {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
      modal.close();
    };
    modal.foot.querySelector('[data-act="ok"]').onclick = async () => {
      if (isIos() && !isStandalone() && typeof PWA !== 'undefined') {
        modal.close();
        PWA.promptInstall();
        return;
      }
      try {
        await enable();
        modal.close();
        UI.toast('Avisos ativados neste aparelho.', 'success');
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    };
  }

  async function handleNewItems(items, unreadCount) {
    if (!items || !items.length) {
      lastUnread = unreadCount || 0;
      return;
    }
    const fresh = items.filter((n) => !lastSeenIds.has(n.id));
    if (!ready) {
      items.forEach((n) => lastSeenIds.add(n.id));
      lastUnread = unreadCount || 0;
      ready = true;
      return;
    }
    if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      const newest = fresh[0];
      if (newest) {
        const extra = fresh.length > 1 ? ` e mais ${fresh.length - 1}` : '';
        await showLocal(newest.title, (newest.body || '') + extra, {
          url: newest.lead_id ? `/#/leads/${newest.lead_id}` : '/#/notifications',
          leadId: newest.lead_id || null,
          tag: newest.type || 'leadtrack-local'
        });
      }
    }
    fresh.forEach((n) => lastSeenIds.add(n.id));
    if (lastSeenIds.size > 200) {
      lastSeenIds = new Set([...lastSeenIds].slice(-100));
    }
    lastUnread = unreadCount || 0;
  }

  async function getState() {
    let hasSub = subscribed;
    if (pushSupported()) {
      try {
        const reg = await registration();
        const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
        hasSub = !!sub;
        subscribed = hasSub;
      } catch { /* ignore */ }
    }
    try {
      const remote = await Api.get('/api/notifications/push/status');
      if (remote && remote.subscribed) hasSub = true;
    } catch { /* ignore */ }
    subscribed = hasSub;
    return {
      permission: permission(),
      pushSupported: pushSupported(),
      ios: isIos(),
      standalone: isStandalone(),
      subscribed: hasSub
    };
  }

  function statusLabel(state) {
    const s = state || {
      permission: permission(),
      pushSupported: pushSupported(),
      ios: isIos(),
      standalone: isStandalone(),
      subscribed
    };
    if (s.permission === 'unsupported') return 'Nao suportado neste navegador';
    if (s.permission === 'denied') return 'Bloqueado pelo navegador';
    if (s.ios && !s.standalone) {
      return 'No iPhone, instale o app na Tela de Inicio e abra pelo icone. Sem isso o aviso nao chega com o app fechado';
    }
    if (s.permission === 'granted' && s.subscribed) return 'Avisos ativos neste aparelho (push inscrito)';
    if (s.permission === 'granted') return 'Permissao liberada, mas este aparelho ainda nao esta inscrito no push. Toque em Ativar avisos';
    return 'Ainda nao ativado';
  }

  function init() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'OPEN_URL' && event.data.url) {
        location.href = event.data.url;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    supported, pushSupported, permission, enable, disable,
    subscribePush, maybePrompt, handleNewItems, statusLabel, showLocal,
    sendTest, getState, isIos, isStandalone
  };
})();
