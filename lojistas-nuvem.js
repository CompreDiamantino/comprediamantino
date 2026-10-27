/**
 * Sincroniza anunciantes entre aparelhos (Firestore coleção "lojistas")
 * + espelho localStorage cd_lojistas_admin
 */
(function (global) {
  var KEY = 'cd_lojistas_admin';
  var COL = 'lojistas';

  function lerLocal() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function salvarLocal(lista) {
    localStorage.setItem(KEY, JSON.stringify(lista || []));
  }

  function db() {
    try {
      if (window.iniciarFirebase) iniciarFirebase();
      return window.cdDb || null;
    } catch (e) { return null; }
  }

  function docId(lj) {
    return String(lj.id || ('lj-' + Date.now()));
  }

  /** Grava um anunciante na nuvem + mescla no local */
  function salvarUm(lj) {
    if (!lj || !lj.id) return Promise.resolve({ sucesso: false });
    var lista = lerLocal();
    var ix = lista.findIndex(function (x) { return String(x.id) === String(lj.id); });
    if (ix >= 0) lista[ix] = Object.assign({}, lista[ix], lj);
    else lista.push(lj);
    salvarLocal(lista);

    var fire = db();
    if (!fire) return Promise.resolve({ sucesso: true, soLocal: true });

    return fire.collection(COL).doc(docId(lj)).set(Object.assign({}, lj, {
      atualizadoEm: new Date().toISOString()
    }), { merge: true }).then(function () {
      return { sucesso: true, nuvem: true };
    }).catch(function (err) {
      console.warn('lojistas nuvem', err);
      return { sucesso: true, soLocal: true, erro: (err && err.message) || String(err) };
    });
  }

  /** Puxa todos da nuvem e mescla com local (nuvem ganha se mais recente) */
  function puxar(cb) {
    var fire = db();
    if (!fire) {
      if (cb) cb(lerLocal());
      return Promise.resolve(lerLocal());
    }
    return fire.collection(COL).get().then(function (snap) {
      var mapa = {};
      lerLocal().forEach(function (l) { if (l && l.id) mapa[String(l.id)] = l; });
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        d.id = d.id || doc.id;
        var ant = mapa[String(d.id)];
        if (!ant) mapa[String(d.id)] = d;
        else {
          var tN = Date.parse(d.atualizadoEm || d.criadoEm || 0) || 0;
          var tL = Date.parse(ant.atualizadoEm || ant.criadoEm || 0) || 0;
          mapa[String(d.id)] = tN >= tL ? Object.assign({}, ant, d) : Object.assign({}, d, ant);
        }
      });
      var lista = Object.keys(mapa).map(function (k) { return mapa[k]; });
      salvarLocal(lista);
      if (cb) cb(lista);
      return lista;
    }).catch(function (err) {
      console.warn('puxar lojistas', err);
      var lista = lerLocal();
      if (cb) cb(lista);
      return lista;
    });
  }

  /** Escuta em tempo quase real (gestor) */
  function ouvir(cb) {
    var fire = db();
    if (!fire) return function () {};
    return fire.collection(COL).onSnapshot(function (snap) {
      var lista = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        d.id = d.id || doc.id;
        lista.push(d);
      });
      // mescla com local para não perder campos só locais
      var mapa = {};
      lerLocal().forEach(function (l) { if (l && l.id) mapa[String(l.id)] = l; });
      lista.forEach(function (d) {
        mapa[String(d.id)] = Object.assign({}, mapa[String(d.id)] || {}, d);
      });
      var final = Object.keys(mapa).map(function (k) { return mapa[k]; });
      salvarLocal(final);
      if (cb) cb(final);
    }, function (err) { console.warn('onSnapshot lojistas', err); });
  }

  global.LojistasNuvem = {
    KEY: KEY,
    lerLocal: lerLocal,
    salvarLocal: salvarLocal,
    salvarUm: salvarUm,
    puxar: puxar,
    ouvir: ouvir
  };
})(window);
