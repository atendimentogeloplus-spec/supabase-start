'use strict';

const PWA = (() => {
  let deferredPrompt = null;
  let installed = false;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  }

  function installButton() {
    return document.getElementById('install-btn');
  }

  function isInstallable() {
    if (installed || isStandalone()) return false;
    // iOS nao dispara beforeinstallprompt; oferecemos instrucoes manuais.
    return !!deferredPrompt || isIos();
  }

  function showInstallButton() {
    const installable = isInstallable();
    const btn = installButton();
    if (btn) btn.classList.toggle('hidden', !installable);
    const authBtn = document.getElementById('auth-install');
    if (authBtn) authBtn.classList.toggle('hidden', !installable);
  }

  function hideInstallButton() {
    const btn = installButton();
    if (btn) btn.classList.add('hidden');
  }

  function iosInstructions() {
    const body = document.createElement('div');
    body.innerHTML = `
      <p class="mb">Para instalar o LeadTrack no seu iPhone/iPad:</p>
      <ol style="padding-left:20px;line-height:1.8">
        <li>Toque no botao <b>Compartilhar</b> do Safari (quadrado com seta para cima).</li>
        <li>Escolha <b>Adicionar a Tela de Inicio</b>.</li>
        <li>Confirme em <b>Adicionar</b>.</li>
      </ol>
      <p class="small muted">No Android/Chrome, use o menu (tres pontos) e escolha <b>Instalar aplicativo</b>.</p>
    `;
    const modal = UI.modal({
      title: 'Instalar aplicativo',
      body,
      footer: '<button class="btn" data-act="ok">Entendi</button>'
    });
    modal.foot.querySelector('[data-act="ok"]').onclick = () => modal.close();
  }

  async function promptInstall() {
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      hideInstallButton();
      prompt.prompt();
      try {
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          UI.toast('Instalando o aplicativo...', 'success');
        }
      } catch { /* usuario cancelou */ }
      return;
    }
    if (isIos()) { iosInstructions(); return; }
    UI.toast('Use o menu do navegador e escolha "Instalar aplicativo" ou "Adicionar a tela inicial".', 'info');
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[pwa] falha ao registrar service worker:', err.message);
      });
    });
  }

  function init() {
    installed = isStandalone();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
      installed = true;
      deferredPrompt = null;
      hideInstallButton();
      UI.toast('Aplicativo instalado com sucesso.', 'success');
    });

    const btn = installButton();
    if (btn) btn.addEventListener('click', promptInstall);
    const authBtn = document.getElementById('auth-install');
    if (authBtn) authBtn.addEventListener('click', promptInstall);

    const media = window.matchMedia('(display-mode: standalone)');
    if (media.addEventListener) {
      media.addEventListener('change', (e) => {
        installed = e.matches;
        if (installed) hideInstallButton();
      });
    }

    showInstallButton();
    registerServiceWorker();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init, promptInstall, isStandalone, isInstallable };
})();
