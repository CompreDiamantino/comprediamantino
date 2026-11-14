/**
 * Compre Diamantino — Push + Badge (Android e iPhone PWA)
 *
 * - Pede permissão de notificação
 * - Registra token FCM no Firestore (coleção pushTokens)
 * - Atualiza badge do ícone (Badging API)
 * - Quando NotifGestor cria aviso, enfileira em pushFila para envio
 *
 * CONFIG necessária no Firebase Console:
 * 1. Cloud Messaging → Web Push certificates → gerar par de chaves
 * 2. Colar a chave pública em CD_PUSH_VAPID_KEY abaixo
 * 3. (Para ENVIAR de verdade) Cloud Function ou backend com Server Key / HTTP v1
 */
(function (global) {
  'use strict';

  // === COLE AQUI a chave pública Web Push (VAPID) do Firebase Console ===
  // Project Settings → Cloud Messaging → Web Push certificates → Key pair
  var CD_PUSH_VAPID_KEY = ''; // ex: 'BEl...longa...'

  var ROLE_GESTOR = 'gestor';
  var ROLE_LOJISTA = 'lojista';
  var COL_TOKENS = 'pushTokens';
  var COL_FILA = 'pushFila';

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator.standalone === true);
  }

  function canNotify() {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  }

  function deviceId() {
    try {
      var k = 'cd_device_id';
      var id = localStorage.getItem(k);
      if (!id) {
        id = 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(k, id);
      }
      return id;
    } catch (e) {
      return 'd_anon';
    }
  }

  function setIconBadge(n) {
    n = Math.max(0, Number(n) || 0);
    try {
      if (navigator.setAppBadge) {
        if (n > 0) navigator.setAppBadge(n);
        else if (navigator.clearAppBadge) navigator.clearAppBadge();
      }
    } catch (e) {}
    // também avisa o SW (alguns ambientes só atualizam por lá)
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({ type: 'SET_BADGE', count: n });
      } catch (e) {}
    }
  }

  function clearIconBadge() {
    setIconBadge(0);
  }

  /** Mostra notificação local (app em primeiro plano ou sem FCM ainda) */
  function notifyLocal(title, body, opts) {
    opts = opts || {};
    if (!canNotify()) return Promise.resolve(false);
    if (Notification.permission !== 'granted') return Promise.resolve(false);

    var options = {
      body: body || '',
      icon: opts.icon || './icon-192.png',
      badge: './icon-192.png',
      tag: opts.tag || ('cd-' + Date.now()),
      renotify: true,
      data: { url: opts.url || './gestor-hub.html', id: opts.id || '' }
    };

    return navigator.serviceWorker.getRegistration().then(function (reg) {
      if (reg && reg.showNotification) {
        return reg.showNotification(title || 'Compre Diamantino', options).then(function () {
          if (opts.badge != null) setIconBadge(opts.badge);
          return true;
        });
      }
      try {
        new Notification(title || 'Compre Diamantino', options);
        if (opts.badge != null) setIconBadge(opts.badge);
        return true;
      } catch (e) {
        return false;
      }
    }).catch(function () { return false; });
  }

  function ensureSw() {
    if (!('serviceWorker' in navigator)) return Promise.reject(new Error('Sem Service Worker'));
    return navigator.serviceWorker.register('/sw.js').then(function (reg) {
      return reg.update().then(function () { return reg; }).catch(function () { return reg; });
    });
  }

  /**
   * Pede permissão e, se tiver VAPID + Firebase Messaging, obtém token FCM.
   * role: 'gestor' | 'lojista'
   * extra: { lojistaId, nome }
   */
  function ativarPush(role, extra) {
    role = role || ROLE_GESTOR;
    extra = extra || {};

    if (!canNotify()) {
      return Promise.resolve({ ok: false, motivo: 'navegador_sem_suporte' });
    }

    // iPhone: precisa estar instalado na tela inicial
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS && !isStandalone()) {
      return Promise.resolve({
        ok: false,
        motivo: 'ios_precisa_instalar',
        mensagem: 'No iPhone: toque em Compartilhar → Adicionar à Tela de Início, abra pelo ícone e ative de novo.'
      });
    }

    return ensureSw().then(function (reg) {
      return Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') {
          return { ok: false, motivo: 'permissao_negada' };
        }

        // Sem VAPID ainda: só permissão + notificação local + badge
        if (!CD_PUSH_VAPID_KEY || CD_PUSH_VAPID_KEY.length < 20) {
          salvarTokenLocal(role, extra, null);
          return {
            ok: true,
            modo: 'local',
            mensagem: 'Permissão ok. Configure a chave VAPID no Firebase para push remoto.'
          };
        }

        if (typeof firebase === 'undefined' || !firebase.messaging) {
          return {
            ok: true,
            modo: 'local',
            mensagem: 'Firebase Messaging não carregou. Notificações locais ativas.'
          };
        }

        try {
          if (window.iniciarFirebase) window.iniciarFirebase();
        } catch (e) {}

        var messaging;
        try {
          messaging = firebase.messaging();
        } catch (e) {
          return { ok: true, modo: 'local', mensagem: 'Messaging indisponível neste navegador.' };
        }

        return messaging.getToken({
          vapidKey: CD_PUSH_VAPID_KEY,
          serviceWorkerRegistration: reg
        }).then(function (token) {
          if (!token) {
            return { ok: true, modo: 'local', mensagem: 'Token vazio — usando modo local.' };
          }
          return salvarTokenNuvem(role, extra, token).then(function () {
            return { ok: true, modo: 'fcm', token: token.slice(0, 12) + '…' };
          });
        }).catch(function (err) {
          console.warn('FCM getToken', err);
          salvarTokenLocal(role, extra, null);
          return {
            ok: true,
            modo: 'local',
            mensagem: 'Não foi possível obter token FCM. Locais ativas. ' + ((err && err.message) || '')
          };
        });
      });
    }).catch(function (err) {
      return { ok: false, motivo: 'erro', mensagem: (err && err.message) || String(err) };
    });
  }

  function salvarTokenLocal(role, extra, token) {
    try {
      localStorage.setItem('cd_push_role', role);
      localStorage.setItem('cd_push_meta', JSON.stringify({
        role: role,
        lojistaId: extra.lojistaId || '',
        nome: extra.nome || '',
        token: token || '',
        em: new Date().toISOString()
      }));
    } catch (e) {}
  }

  function salvarTokenNuvem(role, extra, token) {
    salvarTokenLocal(role, extra, token);
    if (!window.cdDb) {
      try { if (window.iniciarFirebase) window.iniciarFirebase(); } catch (e) {}
    }
    if (!window.cdDb || !token) return Promise.resolve();

    var id = role + '_' + deviceId();
    var doc = {
      role: role,
      token: token,
      deviceId: deviceId(),
      lojistaId: extra.lojistaId || '',
      nome: extra.nome || '',
      userAgent: (navigator.userAgent || '').slice(0, 180),
      standalone: isStandalone(),
      atualizadoEm: new Date().toISOString(),
      ativo: true
    };

    return window.cdDb.collection(COL_TOKENS).doc(id).set(doc, { merge: true }).catch(function (err) {
      console.warn('salvar pushToken', err);
    });
  }

  /**
   * Enfileira push para os dispositivos do papel (gestor ou lojista).
   * Um Cloud Function / backend deve ler pushFila e chamar FCM.
   * Enquanto não houver backend, tenta notificação local se o app estiver aberto.
   */
  function enfileirarPush(opts) {
    opts = opts || {};
    var destino = opts.destino || ROLE_GESTOR; // 'gestor' | 'lojista' | 'todos'
    var titulo = opts.titulo || 'Compre Diamantino';
    var body = opts.body || opts.detalhe || '';
    var url = opts.url || (destino === ROLE_LOJISTA ? './lojista-painel.html' : './gestor-hub.html');
    var badge = opts.badge != null ? opts.badge : 1;
    var tipo = opts.tipo || 'contato';
    var id = opts.id || ('p' + Date.now());

    // Sempre tenta local (se a página do destinatário estiver aberta neste aparelho)
    var roleLocal = '';
    try { roleLocal = localStorage.getItem('cd_push_role') || ''; } catch (e) {}
    if (destino === 'todos' || destino === roleLocal) {
      notifyLocal(titulo, body, { url: url, tag: id, badge: badge, id: id });
    }

    if (!window.cdDb) {
      try { if (window.iniciarFirebase) window.iniciarFirebase(); } catch (e) {}
    }
    if (!window.cdDb) return Promise.resolve({ ok: false, motivo: 'sem_firestore' });

    var item = {
      id: id,
      destino: destino,
      lojistaId: opts.lojistaId || '',
      title: titulo,
      body: body,
      url: url,
      tipo: tipo,
      badge: badge,
      criadoEm: new Date().toISOString(),
      status: 'pendente'
    };

    return window.cdDb.collection(COL_FILA).doc(id).set(item).then(function () {
      return { ok: true, id: id };
    }).catch(function (err) {
      console.warn('pushFila', err);
      return { ok: false, motivo: (err && err.message) || 'erro_fila' };
    });
  }

  /** Atualiza badge do ícone com base nas não lidas do gestor */
  function syncBadgeFromNotifGestor() {
    try {
      if (window.NotifGestor && typeof NotifGestor.naoLidas === 'function') {
        setIconBadge(NotifGestor.naoLidas());
      }
    } catch (e) {}
  }

  // Clique em notificação → navega
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (event) {
      var d = event.data || {};
      if (d.type === 'CD_NOTIF_CLICK' && d.url) {
        try {
          var path = d.url;
          if (path.indexOf('http') === 0) {
            window.location.href = path;
          } else {
            window.location.href = path;
          }
        } catch (e) {}
      }
    });
  }

  global.CDPush = {
    ativar: ativarPush,
    enfileirar: enfileirarPush,
    notifyLocal: notifyLocal,
    setBadge: setIconBadge,
    clearBadge: clearIconBadge,
    syncBadgeFromNotifGestor: syncBadgeFromNotifGestor,
    isStandalone: isStandalone,
    canNotify: canNotify,
    ROLE_GESTOR: ROLE_GESTOR,
    ROLE_LOJISTA: ROLE_LOJISTA,
    /** Só para você colar a chave sem editar o arquivo de novo em todo lugar */
    setVapidKey: function (key) {
      if (key && String(key).length > 20) CD_PUSH_VAPID_KEY = String(key);
    }
  };
})(window);
