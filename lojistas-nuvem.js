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
  var KEY_EXCLUIDOS = 'cd_excluidos_total'; // tombstones: IDs apagados de vez — não voltam no puxar
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

  /** IDs de exclusão total (não reaparecem ao puxar da nuvem). */
  function lerExcluidos() {
    try {
      var arr = JSON.parse(localStorage.getItem(KEY_EXCLUIDOS) || '[]');
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch (e) { return []; }
  }
  function salvarExcluidos(ids) {
    localStorage.setItem(KEY_EXCLUIDOS, JSON.stringify(ids || []));
  }
  function marcarExcluido(id) {
    if (!id) return;
    var ids = lerExcluidos();
    var s = String(id);
    if (ids.indexOf(s) === -1) {
      ids.push(s);
      // limita a 500 para não crescer sem fim
      if (ids.length > 500) ids = ids.slice(-500);
      salvarExcluidos(ids);
    }
  }
  function foiExcluidoTotal(id) {
    if (!id) return false;
    return lerExcluidos().indexOf(String(id)) !== -1;
  }
  function limparExcluido(id) {
    if (!id) return;
    salvarExcluidos(lerExcluidos().filter(function (x) { return String(x) !== String(id); }));
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
    // Nunca reintroduz item de exclusão total
    if (foiExcluidoTotal(item.id) || item.excluidoTotal === true) {
      marcarExcluido(item.id);
      var listaSem = lerLocal().filter(function (x) { return String(x.id) !== String(item.id); });
      salvarLocal(listaSem);
      return listaSem;
    }
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
    // Não regrava item de exclusão total
    if (foiExcluidoTotal(lj.id) || lj.excluidoTotal === true) {
      marcarExcluido(lj.id);
      var sem = lerLocal().filter(function (x) { return String(x.id) !== String(lj.id); });
      salvarLocal(sem);
      return Promise.resolve({ sucesso: true, excluidoTotal: true });
    }
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
        var quota = false;
        try {
          var code = ((err && err.code) || '') + ' ' + ((err && err.message) || '');
          quota = /resource-exhausted|quota|Quota exceeded/i.test(code);
        } catch (e) {}
        return {
          sucesso: !quota,
          soLocal: true,
          quota: quota,
          erro: quota
            ? 'Dados e leituras do Firebase excedidos para o dia. Tente mais tarde ou amanhã.'
            : ((err && err.message) || String(err))
        };
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
      var local = lerLocal().filter(function (l) { return l && !foiExcluidoTotal(l.id); });
      salvarLocal(local);
      if (cb) cb(local);
      return Promise.resolve(local);
    }
    return fire.collection(COL).get().then(function (snap) {
      var mapa = {};
      var excluidos = lerExcluidos();
      var tentativasDelete = [];
      lerLocal().forEach(function (l) {
        if (l && l.id && !foiExcluidoTotal(l.id)) mapa[String(l.id)] = l;
      });
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        d.id = d.id || doc.id;
        var sid = String(d.id);
        // Exclusão total: não reintroduz e tenta apagar de novo na nuvem
        if (foiExcluidoTotal(sid) || d.excluidoTotal === true) {
          marcarExcluido(sid);
          tentativasDelete.push(sid);
          return;
        }
        var ant = mapa[sid];
        if (!ant) mapa[sid] = d;
        else {
          var tN = Date.parse(d.atualizadoEm || d.criadoEm || 0) || 0;
          var tL = Date.parse(ant.atualizadoEm || ant.criadoEm || 0) || 0;
          mapa[sid] = tN >= tL ? Object.assign({}, ant, d) : Object.assign({}, d, ant);
        }
      });
      // Remove do mapa qualquer id que esteja na lista de exclusão total
      excluidos.forEach(function (eid) { delete mapa[String(eid)]; });
      var lista = Object.keys(mapa).map(function (k) { return mapa[k]; });
      salvarLocal(lista);
      // Tenta limpar da nuvem os que voltariam (não bloqueia o retorno)
      tentativasDelete.forEach(function (tid) {
        try {
          fire.collection(COL).doc(String(tid)).delete().catch(function () {
            fire.collection(COL).doc(String(tid)).set({
              excluidoTotal: true,
              status: 'removido',
              removidoEm: new Date().toISOString(),
              atualizadoEm: new Date().toISOString()
            }, { merge: true }).catch(function () {});
          });
        } catch (e) {}
      });
      if (cb) cb(lista);
      return lista;
    }).catch(function (err) {
      console.warn('puxar lojistas', err);
      var lista = lerLocal().filter(function (l) { return l && !foiExcluidoTotal(l.id); });
      salvarLocal(lista);
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
    // Já foi exclusão total → não traz de volta
    if (foiExcluidoTotal(id)) {
      var listaLimpa = lerLocal().filter(function (l) { return String(l.id) !== String(id); });
      salvarLocal(listaLimpa);
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
      if (d.excluidoTotal === true) {
        marcarExcluido(d.id);
        var sem = lerLocal().filter(function (l) { return String(l.id) !== String(d.id); });
        salvarLocal(sem);
        if (cb) cb(null);
        return null;
      }
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

  /**
   * Exclusão TOTAL: remove do local + marca tombstone + tenta apagar na nuvem.
   * Se o delete falhar (regras/permissão), grava excluidoTotal=true para o puxar ignorar.
   * Assim o item NÃO volta mais da nuvem no painel.
   */
  function apagar(id) {
    if (!id) return Promise.resolve();
    marcarExcluido(id);
    var lista = lerLocal().filter(function (l) { return String(l.id) !== String(id); });
    salvarLocal(lista);
    var fire = db();
    if (!fire) return Promise.resolve();
    return fire.collection(COL).doc(String(id)).delete().then(function () {
      return sinalizar('removido', { lojistaId: id, status: 'excluido_total' });
    }).catch(function () {
      // Delete negado ou falhou → marca flag permanente no doc
      return fire.collection(COL).doc(String(id)).set({
        excluidoTotal: true,
        status: 'removido',
        removidoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      }, { merge: true }).catch(function () {}).then(function () {
        return sinalizar('removido', { lojistaId: id, status: 'excluido_total' });
      });
    });
  }

  function isQuotaError(err) {
    if (!err) return false;
    var code = (err.code || err.name || '') + '';
    var msg = (err.message || err + '') + '';
    return /resource-exhausted|quota|Quota exceeded|exceeded/i.test(code + ' ' + msg);
  }

  function mensagemQuota() {
    return 'Dados e leituras do Firebase excedidos para o dia. Tente mais tarde ou amanhã (a cota grátis renova à meia-noite).';
  }

  /**
   * Força reenvio do cadastro local do lojista para a nuvem + sinal ao gestor.
   * Usar quando o painel do gestor não recebeu a inscrição.
   */
  function forcarEnvio(lj) {
    if (!lj || !lj.id) {
      return Promise.resolve({ sucesso: false, erro: 'Cadastro local não encontrado.' });
    }
    return salvarNovoCadastro(lj).then(function (res) {
      if (res && res.erro && isQuotaError({ message: res.erro })) {
        return { sucesso: false, quota: true, erro: mensagemQuota() };
      }
      if (res && res.soLocal) {
        return { sucesso: false, soLocal: true, erro: res.erro || 'Não foi possível gravar na nuvem. Verifique a internet.' };
      }
      return { sucesso: true, nuvem: !!(res && res.nuvem), res: res };
    }).catch(function (err) {
      if (isQuotaError(err)) {
        return { sucesso: false, quota: true, erro: mensagemQuota() };
      }
      return { sucesso: false, erro: (err && err.message) || String(err) };
    });
  }

  // Enrich salvarUm catch to flag quota
  var _salvarUmOrig = salvarUm;
  // already has catch that returns soLocal - ok

  global.LojistasNuvem = {
    KEY: KEY,
    KEY_EXCLUIDOS: KEY_EXCLUIDOS,
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
    apagar: apagar,
    forcarEnvio: forcarEnvio,
    isQuotaError: isQuotaError,
    mensagemQuota: mensagemQuota,
    marcarExcluido: marcarExcluido,
    foiExcluidoTotal: foiExcluidoTotal,
    limparExcluido: limparExcluido,
    lerExcluidos: lerExcluidos
  };
})(window);
