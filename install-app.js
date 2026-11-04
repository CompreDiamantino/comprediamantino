/**
 * PWA — convite para instalar (forçado até instalar)
 * Aparece em todo acesso enquanto o app não estiver instalado (standalone).
 * Fechar só esconde na sessão atual; na próxima abertura volta a aparecer.
 */
(function () {
  const SESSION_DISMISS = 'cd_install_session_dismiss';
  let deferredPrompt = null;

  function wasDismissedThisSession() {
    try {
      return sessionStorage.getItem(SESSION_DISMISS) === '1';
    } catch { return false; }
  }

  function dismissSession() {
    try { sessionStorage.setItem(SESSION_DISMISS, '1'); } catch (e) {}
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

  function stepsForOS(os) {
    if (os === 'ios') {
      return [
        'Abra no <strong>Safari</strong>',
        'Toque em <strong>Compartilhar</strong> <i class="fas fa-share-square"></i>',
        'Escolha <strong>Adicionar à Tela de Início</strong>',
        'Confirme <strong>Adicionar</strong>'
      ];
    }
    if (os === 'android') {
      return [
        'Abra no <strong>Chrome</strong>',
        'Menu <strong>⋮</strong> → <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>',
        'Ou toque em <strong>Instalar</strong> abaixo',
        'Confirme — o ícone fica na tela inicial'
      ];
    }
    if (os === 'windows' || os === 'mac') {
      return [
        'Use <strong>Chrome</strong> ou <strong>Edge</strong>',
        'Ícone de instalação na barra de endereço',
        'Ou menu → <strong>Instalar Compre Diamantino</strong>',
        'Confirme a instalação'
      ];
    }
    return [
      'Abra no navegador principal do aparelho',
      'Procure a opção <strong>Instalar</strong> ou <strong>Adicionar à tela inicial</strong>',
      'Confirme para criar o atalho'
    ];
  }

  function copyForOS(os) {
    if (os === 'ios') {
      return {
        titulo: 'Instale o app no iPhone/iPad',
        texto: 'Funciona como aplicativo, sem App Store.',
        btn: 'Ver passos'
      };
    }
    if (os === 'android') {
      return {
        titulo: 'Instale o app no Android',
        texto: 'Atalho na tela inicial — sem Play Store.',
        btn: 'Instalar agora'
      };
    }
    if (os === 'windows' || os === 'mac') {
      return {
        titulo: 'Instale no computador',
        texto: 'Chrome ou Edge: instale como app.',
        btn: 'Instalar'
      };
    }
    return {
      titulo: 'Instale o Compre Diamantino',
      texto: 'Acesse como app na tela inicial.',
      btn: 'Como instalar'
    };
  }

  function createBanner() {
    if (document.getElementById('installBanner') || isStandalone() || wasDismissedThisSession()) return;

    const os = detectOS();
    const c = copyForOS(os);
    const steps = stepsForOS(os);
    const stepsHtml = steps.map(function (s, i) {
      return '<li class="flex gap-2"><span class="text-primary font-bold flex-shrink-0">' + (i + 1) + '.</span><span>' + s + '</span></li>';
    }).join('');

    const banner = document.createElement('div');
    banner.id = 'installBanner';
    banner.className = 'fixed bottom-0 left-0 right-0 sm:bottom-4 sm:left-auto sm:right-6 sm:max-w-md z-[60] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 p-4 pb-6 sm:pb-4';
    banner.innerHTML =
      '<button type="button" id="installClose" class="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Fechar">&times;</button>' +
      '<div class="flex gap-3 items-start pr-6">' +
      '<img src="icon-192.png" alt="" class="w-12 h-12 rounded-xl flex-shrink-0">' +
      '<div class="flex-1 min-w-0">' +
      '<p class="font-bold text-primary text-sm">' + c.titulo + '</p>' +
      '<p class="text-xs text-gray-500 mt-0.5">' + c.texto + '</p>' +
      '</div></div>' +
      '<ol class="mt-3 space-y-1.5 text-xs text-gray-700 bg-gray-50 rounded-xl p-3">' + stepsHtml + '</ol>' +
      '<div class="flex flex-wrap gap-2 mt-3">' +
      '<button type="button" id="installBtn" class="flex-1 bg-primary text-white text-xs font-bold px-3 py-2.5 rounded-lg hover:bg-accent transition">' +
      '<i class="fas fa-download mr-1"></i> ' + c.btn +
      '</button>' +
      '<a href="instalar.html" class="text-xs font-semibold text-primary border border-primary/30 px-3 py-2.5 rounded-lg hover:bg-blue-50 transition">Guia completo</a>' +
      '</div>' +
      '<p class="text-[10px] text-gray-400 mt-2 text-center">Esta mensagem aparece até o app ser instalado.</p>';

    document.body.appendChild(banner);
    document.getElementById('installClose').onclick = dismissSession;
    document.getElementById('installBtn').onclick = function () {
      if (deferredPrompt && (os === 'android' || os === 'windows' || os === 'mac')) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (r) {
          deferredPrompt = null;
          if (r.outcome === 'accepted') {
            const el = document.getElementById('installBanner');
            if (el) el.remove();
          }
        });
      } else {
        window.location.href = 'instalar.html';
      }
    };
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (detectOS() !== 'ios') setTimeout(createBanner, 800);
  });

  window.addEventListener('load', function () {
    if (isStandalone()) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    setTimeout(function () {
      if (!document.getElementById('installBanner') && !wasDismissedThisSession()) {
        createBanner();
      }
    }, 1200);
  });

  // Permite forçar de novo: CD_mostrarInstalar()
  window.CD_mostrarInstalar = function () {
    try { sessionStorage.removeItem(SESSION_DISMISS); } catch (e) {}
    const el = document.getElementById('installBanner');
    if (el) el.remove();
    createBanner();
  };
})();
