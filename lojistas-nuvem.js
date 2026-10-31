/**
 * Sincroniza anunciantes entre aparelhos (Firestore coleção "lojistas")
 * + espelho localStorage cd_lojistas_admin
 *
 * Economia de leituras:
 * - NÃO usa onSnapshot na coleção inteira (1 leitura por doc a cada mudança).
 * - Listener único em _sistema/sinais (1 documento = 1 leitura por evento).
 * - Cadastro novo: grava o lojista + atualiza o sinal; o gestor busca só aquele id.
 * - Painel abre com 1× puxar() completo; depois só reage a sinais.
 */
(function (global) {
  var KEY = 'cd_lojistas_admin';
  var COL = 'lojistas';
  var SINAL_COL = '_sistema';
  var SINAL_DOC = 'sinais';
  var unsubSinais = null;

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

  function mesclarItem(item) {
    if (!item || !item.id) return lerLocal();
    var lista = lerLocal();
    var ix = lista.findIndex(function (x) { return String(x.id) === String(item.id); });
    if (ix >= 0) lista[ix] = Object.assign({}, lista[ix], item);
    else lista.push(item);
    salvarLocal(lista);
    return lista;
  }

  /** Grava um anunciante na nuvem + mescla no local.
   *  Na nuvem NUNCA grava senha em texto puro — só senhaHash. */
  function salvarUm(lj) {
    if (!lj || !lj.id) return Promise.resolve({ sucesso: false });
    mesclarItem(lj);

    var fire = db();
    if (!fire) return Promise.resolve({ sucesso: true, soLocal: true });

    function gravarNuvem(payload) {
      return fire.collection(COL).doc(docId(lj)).set(Object.assign({}, payload, {
        atualizadoEm: new Date().toISOString()
      }), { merge: true }).then(function () {
        return { sucesso: true, nuvem: true };
      }).catch(function (err) {
        console.warn('lojistas nuvem', err);
        return { sucesso: true, soLocal: true, erro: (err && err.message) || String(err) };
      });
    }

    if (window.AuthUtils && AuthUtils.prepararLojistaParaNuvem) {
      return AuthUtils.prepararLojistaParaNuvem(lj).then(gravarNuvem);
    }
    var limpo = Object.assign({}, lj);
    delete limpo.senha;
    return gravarNuvem(limpo);
  }

  /**
   * Sinal leve (1 doc) para o gestor saber que algo mudou sem reler a coleção inteira.
   * tipo: 'novo_cadastro' | 'atualizacao' | 'removido'
   */
  function sinalizar(tipo, meta) {
    var fire = db();
    if (!fire) return Promise.resolve({ soLocal: true });
    var payload = {
      tipo: tipo || 'atualizacao',
      em: new Date().toISOString(),
      lojistaId: (meta && meta.lojistaId) || null,
      nome: (meta && meta.nome) || null,
      status: (meta && meta.status) || null
    };
    return fire.collection(SINAL_COL).doc(SINAL_DOC).set(payload, { merge: true }).catch(function (err) {
      console.warn('sinal lojistas', err);
      return null;
    });
  }

  /** Cadastro novo: grava lojista + sinal (gestor reage em segundos com 1–2 leituras). */
  function salvarNovoCadastro(lj) {
    return salvarUm(lj).then(function (res) {
      return sinalizar('novo_cadastro', {
        lojistaId: lj && lj.id,
        nome: lj && lj.nome,
        status: (lj && lj.status) || 'pendente'
      }).then(function () { return res; });
    });
  }

  /** Puxa todos da nuvem e mescla com local (usar ao abrir o painel — 1× por sessão). */
  function puxar(cb) {
    var fire = db();
    if (!fire) {
      var local = lerLocal();
      if (cb) cb(local);
      return Promise.resolve(local);
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

  /** 1 leitura: busca só um lojista pelo id e mescla no local. */
  function puxarUm(id, cb) {
    if (!id) {
      if (cb) cb(null);
      return Promise.resolve(null);
    }
    var fire = db();
    if (!fire) {
      var local = lerLocal().find(function (l) { return String(l.id) === String(id); }) || null;
      if (cb) cb(local);
      return Promise.resolve(local);
    }
    return fire.collection(COL).doc(String(id)).get().then(function (doc) {
      if (!doc.exists) {
        if (cb) cb(null);
        return null;
      }
      var d = doc.data() || {};
      d.id = d.id || doc.id;
      mesclarItem(d);
      if (cb) cb(d);
      return d;
    }).catch(function (err) {
      console.warn('puxarUm', err);
      if (cb) cb(null);
      return null;
    });
  }

  /**
   * Listener econômico: só o documento de sinais (1 leitura por evento).
   * cb(sinal) — gestor deve puxarUm(sinal.lojistaId) ou puxar() se não houver id.
   * Retorna função para cancelar o listener.
   */
  function ouvirSinais(cb) {
    var fire = db();
    if (!fire) return function () {};
    if (unsubSinais) {
      try { unsubSinais(); } catch (e) {}
      unsubSinais = null;
    }
    unsubSinais = fire.collection(SINAL_COL).doc(SINAL_DOC).onSnapshot(function (doc) {
      if (!doc.exists) return;
      var sinal = doc.data() || {};
      if (cb) cb(sinal);
    }, function (err) {
      console.warn('onSnapshot sinais', err);
    });
    return function () {
      if (unsubSinais) {
        try { unsubSinais(); } catch (e) {}
        unsubSinais = null;
      }
    };
  }

  /**
   * Compat: antigo ouvir() da coleção inteira.
   * Agora redireciona para ouvirSinais + puxarUm (econômico).
   * cb(listaCompletaLocal) após cada sinal tratado.
   */
  function ouvir(cb) {
    return ouvirSinais(function (sinal) {
      var id = sinal && sinal.lojistaId;
      var done = function () {
        if (cb) cb(lerLocal());
      };
      if (id) {
        puxarUm(id).then(done).catch(done);
      } else {
        puxar(done);
      }
    });
  }

  /** Apaga na nuvem (se regras permitirem) + local. */
  function apagar(id) {
    if (!id) return Promise.resolve();
    var lista = lerLocal().filter(function (l) { return String(l.id) !== String(id); });
    salvarLocal(lista);
    var fire = db();
    if (!fire) return Promise.resolve();
    return fire.collection(COL).doc(String(id)).delete().catch(function () {
      return fire.collection(COL).doc(String(id)).set({
        status: 'removido',
        removidoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      }, { merge: true }).catch(function () {});
    }).then(function () {
      return sinalizar('removido', { lojistaId: id });
    });
  }

  global.LojistasNuvem = {
    KEY: KEY,
    lerLocal: lerLocal,
    salvarLocal: salvarLocal,
    mesclarItem: mesclarItem,
    salvarUm: salvarUm,
    salvarNovoCadastro: salvarNovoCadastro,
    sinalizar: sinalizar,
    puxar: puxar,
    puxarUm: puxarUm,
    ouvir: ouvir,
    ouvirSinais: ouvirSinais,
    apagar: apagar
  };
})(window);
