/**
 * PWA — convite para instalar o Compre Diamantino
 */
(function () {
  const DISMISS_KEY = 'cd_install_dismiss';
  const DISMISS_DAYS = 7;
  let deferredPrompt = null;

  function wasDismissed() {
    try {
      const t = localStorage.getItem(DISMISS_KEY);
      if (!t) return false;
      return Date.now() - parseInt(t, 10) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch { return false; }
  }

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
    const el = document.getElementById('installBanner');
    if (el) el.remove();
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  function createBanner() {
    if (document.getElementById('installBanner') || isStandalone() || wasDismissed()) return;

    const banner = document.createElement('div');
    banner.id = 'installBanner';
    banner.className = 'fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[60] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4';
    banner.innerHTML = `
      <button type="button" id="installClose" class="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Fechar">&times;</button>
      <div class="flex gap-3 items-start pr-4">
        <img src="icon-192.png" alt="" class="w-12 h-12 rounded-xl flex-shrink-0">
        <div class="flex-1 min-w-0">
          <p class="font-bold text-primary text-sm">Instale o Compre Diamantino</p>
          <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">Acesse lojas, mapa e WhatsApp mais rápido, como um app no seu celular.</p>
          <div class="flex flex-wrap gap-2 mt-3">
            <button type="button" id="installBtn" class="bg-primary text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-accent transition">
              <i class="fas fa-download mr-1"></i> Instalar
            </button>
            <a href="instalar.html" class="text-xs font-semibold text-primary border border-primary/30 px-3 py-2 rounded-lg hover:bg-blue-50 transition">
              Como instalar
            </a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('installClose').onclick = dismiss;
    document.getElementById('installBtn').onclick = function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (r) {
          deferredPrompt = null;
          if (r.outcome === 'accepted') dismiss();
        });
      } else {
        window.location.href = 'instalar.html';
      }
    };
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(createBanner, 2500);
  });

  // iOS não dispara beforeinstallprompt — mostra banner com guia
  window.addEventListener('load', function () {
    if (isStandalone()) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    setTimeout(function () {
      if (!document.getElementById('installBanner') && !wasDismissed()) {
        if (isIOS() || isAndroid() || !deferredPrompt) createBanner();
      }
    }, 4000);
  });
})();
