/**
 * PWA — convite para instalar (só o fluxo do SO atual)
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

  function detectOS() {
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(ua);
    const win = /Windows/i.test(ua) && !android;
    const mac = /Macintosh|Mac OS X/i.test(ua) && !ios;
    if (ios) return 'ios';
    if (android) return 'android';
    if (win) return 'windows';
    if (mac) return 'mac';
    return 'other';
  }

  function copyForOS(os) {
    if (os === 'ios') {
      return {
        titulo: 'Adicionar à Tela de Início',
        texto: 'No iPhone/iPad: Safari → Compartilhar → Adicionar à Tela de Início.',
        btn: 'Ver passos (iPhone)'
      };
    }
    if (os === 'android') {
      return {
        titulo: 'Instalar no Android',
        texto: 'Adicione o atalho na tela inicial pelo Chrome — sem Play Store.',
        btn: 'Instalar'
      };
    }
    if (os === 'windows' || os === 'mac') {
      return {
        titulo: 'Instalar no computador',
        texto: 'Chrome ou Edge: ícone de instalação na barra de endereço.',
        btn: 'Instalar'
      };
    }
    return {
      titulo: 'Instale o Compre Diamantino',
      texto: 'Acesse como app na tela inicial do seu aparelho.',
      btn: 'Como instalar'
    };
  }

  function createBanner() {
    if (document.getElementById('installBanner') || isStandalone() || wasDismissed()) return;

    const os = detectOS();
    const c = copyForOS(os);

    const banner = document.createElement('div');
    banner.id = 'installBanner';
    banner.className = 'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[60] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4';
    banner.innerHTML =
      '<button type="button" id="installClose" class="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Fechar">&times;</button>' +
      '<div class="flex gap-3 items-start pr-4">' +
      '<img src="icon-192.png" alt="" class="w-12 h-12 rounded-xl flex-shrink-0">' +
      '<div class="flex-1 min-w-0">' +
      '<p class="font-bold text-primary text-sm">' + c.titulo + '</p>' +
      '<p class="text-xs text-gray-500 mt-0.5 leading-relaxed">' + c.texto + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-3">' +
      '<button type="button" id="installBtn" class="bg-primary text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-accent transition">' +
      '<i class="fas fa-download mr-1"></i> ' + c.btn +
      '</button>' +
      '<a href="instalar.html" class="text-xs font-semibold text-primary border border-primary/30 px-3 py-2 rounded-lg hover:bg-blue-50 transition">Detalhes</a>' +
      '</div></div></div>';

    document.body.appendChild(banner);
    document.getElementById('installClose').onclick = dismiss;
    document.getElementById('installBtn').onclick = function () {
      if (deferredPrompt && (os === 'android' || os === 'windows' || os === 'mac')) {
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
    // Só em Android/desktop — iOS não usa este evento
    if (detectOS() !== 'ios') setTimeout(createBanner, 2500);
  });

  window.addEventListener('load', function () {
    if (isStandalone()) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    setTimeout(function () {
      if (!document.getElementById('installBanner') && !wasDismissed()) {
        createBanner();
      }
    }, 4000);
  });
})();
