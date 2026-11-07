/**
 * Avaliações — Compre Diamantino
 *
 * Visitante: 1 voto/mês por APARELHO, por loja.
 *   - Trocar o número digitado no mesmo celular/navegador NÃO libera novo voto.
 *   - Celular com DDD ainda é pedido (identidade + contato), mas o teto é o aparelho.
 *
 * Anunciante logado: 1 voto/mês por LOGIN (conta), por loja — vale em qualquer aparelho.
 *   - Um login pode votar em várias lojas (e dono de 2–3 comércios usa a mesma conta).
 */
const AVALIACOES_KEY = 'cd_avaliacoes';
const APARELHO_KEY = 'cd_aparelho_id';

function normalizarCelular(tel) {
    return String(tel || '').replace(/\D/g, '');
}

function mesAnoAtual() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getAvaliacoesLocais() {
    try { return JSON.parse(localStorage.getItem(AVALIACOES_KEY) || '{}'); }
    catch { return {}; }
}

function salvarAvaliacoesLocais(dados) {
    localStorage.setItem(AVALIACOES_KEY, JSON.stringify(dados));
}

/** ID estável deste navegador/aparelho (visitante) */
function getAparelhoId() {
    try {
        var id = localStorage.getItem(APARELHO_KEY);
        if (id && String(id).length >= 8) return String(id);
        id = 'ap' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(APARELHO_KEY, id);
        return id;
    } catch (e) {
        return 'ap-temp';
    }
}

function chaveAparelhoVoto(empresaId, mes) {
    return 'ap:' + getAparelhoId() + '_' + empresaId + '_' + (mes || mesAnoAtual());
}

function aparelhoJaVotou(empresaId, mes) {
    const avaliacoes = getAvaliacoesLocais();
    return !!avaliacoes[chaveAparelhoVoto(empresaId, mes)];
}

/** Celular lembrado do visitante (último voto) — preenche automático */
function getCelularSalvo() {
    try {
        var c = normalizarCelular(localStorage.getItem('cd_cel_avaliacao') || '');
        return c.length >= 10 ? c : '';
    } catch { return ''; }
}

function salvarCelularAvaliacao(tel) {
    var c = normalizarCelular(tel);
    if (c.length >= 10) {
        try { localStorage.setItem('cd_cel_avaliacao', c); } catch (e) {}
    }
}

/** Sessão de anunciante / número já conhecido — não pedir celular na mão. */
function getAnuncianteLogado() {
    try {
        const lj = JSON.parse(localStorage.getItem('cd_lojista') || 'null');
        if (lj) {
            const id =
                lj.email ||
                lj.identificador ||
                lj.telefone ||
                lj.whatsapp ||
                lj.empresaId ||
                null;
            if (id) {
                return {
                    id: String(id).toLowerCase().trim(),
                    nome: lj.nome || lj.nomeFantasia || 'Anunciante',
                    celular: normalizarCelular(lj.whatsapp || lj.telefone || ''),
                    viaGestor: !!lj.viaGestor
                };
            }
        }
    } catch (_) {}
    // Sessão alternativa (auth-utils / gestor como lojista)
    try {
        if (window.AuthUtils && AuthUtils.getSessao) {
            var s = AuthUtils.getSessao();
            if (s && (s.email || s.telefone || s.empresaId)) {
                return {
                    id: String(s.email || s.telefone || s.empresaId).toLowerCase().trim(),
                    nome: s.nome || 'Anunciante',
                    celular: normalizarCelular(s.whatsapp || s.telefone || ''),
                    viaGestor: !!s.viaGestor
                };
            }
        }
    } catch (_) {}
    return null;
}

/**
 * Identidade do voto:
 * - logado → login:email_ou_id  (conta; 1x por loja/mês em qualquer aparelho)
 * - visitante → cel:6599... + trava extra por aparelho
 */
function identidadeVoto(celularOpcional) {
    const an = getAnuncianteLogado();
    if (an && an.id) {
        return { tipo: 'login', chave: 'login:' + an.id, label: an.nome };
    }
    // Ordem: digitado → salvo no aparelho → perfil local
    var cel = normalizarCelular(celularOpcional);
    if (cel.length < 10) cel = getCelularSalvo();
    if (cel.length < 10) {
        try {
            var p = JSON.parse(localStorage.getItem('cd_perfil_' + (localStorage.getItem('cd_ultima_empresa') || '')) || '{}');
            cel = normalizarCelular(p.whatsapp || '');
        } catch (_) {}
    }
    if (cel.length >= 10) {
        return { tipo: 'celular', chave: 'cel:' + cel, label: cel };
    }
    return null;
}

function chaveVoto(identidadeChave, empresaId, mes) {
    return identidadeChave + '_' + empresaId + '_' + (mes || mesAnoAtual());
}

function podeAvaliar(empresaId, celularOpcional) {
    const logado = getAnuncianteLogado();
    const mes = mesAnoAtual();
    const avaliacoes = getAvaliacoesLocais();

    // --- Anunciante logado: limite por CONTA (pode votar em todas as lojas, 1x cada) ---
    if (logado && logado.id) {
        const idn = { tipo: 'login', chave: 'login:' + logado.id, label: logado.nome };
        const chave = chaveVoto(idn.chave, empresaId, mes);
        if (avaliacoes[chave]) {
            return {
                pode: false,
                precisaCelular: false,
                mensagem: 'Você já votou para essa loja ou comércio esse mês com sua conta.'
            };
        }
        return { pode: true, precisaCelular: false, mensagem: '', identidade: idn };
    }

    // --- Visitante: limite por APARELHO (trocar número não libera novo voto) ---
    if (aparelhoJaVotou(empresaId, mes)) {
        return {
            pode: false,
            precisaCelular: false,
            mensagem: 'Neste aparelho você já avaliou esta loja este mês. Pode avaliar outras lojas ou voltar no próximo mês.'
        };
    }

    const idn = identidadeVoto(celularOpcional);
    if (!idn) {
        return {
            pode: false,
            precisaCelular: true,
            mensagem: 'Informe seu celular com DDD para votar.'
        };
    }

    // Também bloqueia se o mesmo celular já votou (outro aparelho / espelho local)
    const chaveCel = chaveVoto(idn.chave, empresaId, mes);
    if (avaliacoes[chaveCel]) {
        return {
            pode: false,
            precisaCelular: false,
            mensagem: 'Você já votou para essa loja ou comércio esse mês.'
        };
    }

    return { pode: true, precisaCelular: false, mensagem: '', identidade: idn };
}

/** --- Supabase (avaliações na nuvem; não usa cota Firebase) --- */
function sbCfg() {
    return (window.CD_SUPABASE && window.cdSupabaseReady && window.cdSupabaseReady())
        ? window.CD_SUPABASE
        : null;
}

function sbHeaders() {
    var c = sbCfg();
    if (!c) return null;
    return {
        'apikey': c.anonKey,
        'Authorization': 'Bearer ' + c.anonKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };
}

function sbUrl(pathQuery) {
    var c = sbCfg();
    if (!c) return null;
    return String(c.url).replace(/\/$/, '') + '/rest/v1/' + pathQuery;
}

/** Grava voto no Supabase. Retorna Promise<{ok, mensagem, conflito}> */
function sbEnviarAvaliacao(empresaId, nota, identidade, mes, comentario) {
    var headers = sbHeaders();
    var url = sbUrl('avaliacoes');
    if (!headers || !url) {
        return Promise.resolve({ ok: false, mensagem: 'Supabase não configurado', offline: true });
    }
    var body = {
        empresa_id: String(empresaId),
        nota: parseInt(nota, 10),
        identidade: String(identidade),
        mes: String(mes),
        comentario: String(comentario || '').substring(0, 300)
    };
    return fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    }).then(function (res) {
        if (res.status === 201 || res.status === 200) {
            return { ok: true, mensagem: 'Avaliação enviada com sucesso! Obrigado.' };
        }
        if (res.status === 409) {
            return { ok: false, conflito: true, mensagem: 'Você já votou para essa loja ou comércio esse mês.' };
        }
        return res.text().then(function (t) {
            // unique violation também pode vir 400
            if (/duplicate|unique|avaliacoes_unico/i.test(t || '')) {
                return { ok: false, conflito: true, mensagem: 'Você já votou para essa loja ou comércio esse mês.' };
            }
            console.warn('Supabase avaliacao', res.status, t);
            return { ok: false, mensagem: 'Não foi possível enviar a avaliação. Tente de novo.' };
        });
    }).catch(function (err) {
        console.warn(err);
        return { ok: false, mensagem: 'Sem conexão com o servidor de avaliações.', offline: true };
    });
}

/** Média/total no Supabase (view avaliacoes_resumo) */
function sbMediaEmpresa(empresaId) {
    var headers = sbHeaders();
    var url = sbUrl('avaliacoes_resumo?empresa_id=eq.' + encodeURIComponent(String(empresaId)) + '&select=media,total,soma_estrelas');
    if (!headers || !url) return Promise.resolve(null);
    return fetch(url, { headers: headers })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
            if (!rows || !rows.length) return { media: 0, total: 0, soma: 0 };
            var row = rows[0];
            return {
                media: parseFloat(row.media) || 0,
                total: parseInt(row.total, 10) || 0,
                soma: parseInt(row.soma_estrelas, 10) || 0
            };
        })
        .catch(function () { return null; });
}

/** Lista resumos de várias empresas (painel gestor) */
function sbResumoTodas() {
    var headers = sbHeaders();
    var url = sbUrl('avaliacoes_resumo?select=empresa_id,media,total,soma_estrelas');
    if (!headers || !url) return Promise.resolve([]);
    return fetch(url, { headers: headers })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
}

/** Apaga todos os votos de uma empresa no Supabase (usado na exclusão total do gestor) */
function sbApagarAvaliacoesEmpresa(empresaId) {
    var headers = sbHeaders();
    var url = sbUrl('avaliacoes?empresa_id=eq.' + encodeURIComponent(String(empresaId)));
    if (!headers || !url) return Promise.resolve({ ok: false, offline: true });
    return fetch(url, {
        method: 'DELETE',
        headers: headers
    }).then(function (res) {
        if (res.ok || res.status === 204) return { ok: true };
        return res.text().then(function (t) {
            console.warn('Supabase delete avaliacoes', res.status, t);
            return { ok: false, mensagem: t || String(res.status) };
        });
    }).catch(function (err) {
        console.warn(err);
        return { ok: false, offline: true };
    });
}

function registrarAvaliacaoLocal(empresaId, nota, idn, mes, comentario) {
    const avaliacoes = getAvaliacoesLocais();
    const payload = {
        empresaId,
        nota: parseInt(nota, 10),
        comentario: String(comentario || '').trim().substring(0, 300),
        data: new Date().toISOString(),
        mes: mes,
        tipo: idn.tipo,
        identidade: idn.chave
    };
    // Chave principal (login:… ou cel:…)
    avaliacoes[chaveVoto(idn.chave, empresaId, mes)] = payload;
    // Visitante: trava também por APARELHO (mesmo número diferente no mesmo browser)
    if (idn.tipo !== 'login') {
        avaliacoes[chaveAparelhoVoto(empresaId, mes)] = Object.assign({}, payload, {
            tipo: 'aparelho',
            identidade: 'ap:' + getAparelhoId()
        });
    }
    salvarAvaliacoesLocais(avaliacoes);
    try {
        const listaKey = 'cd_avaliacoes_lista_' + empresaId;
        const lista = JSON.parse(localStorage.getItem(listaKey) || '[]');
        lista.push({
            nota: parseInt(nota, 10),
            tipo: idn.tipo,
            identidade: idn.chave,
            mes: mes,
            em: new Date().toISOString()
        });
        localStorage.setItem(listaKey, JSON.stringify(lista));
    } catch (e) {}
}

/**
 * Registra avaliação (Supabase se configurado + espelho local).
 * Retorna Promise<{sucesso, mensagem}>
 */
function registrarAvaliacao(empresaId, nota, comentario, celularOpcional) {
    const check = podeAvaliar(empresaId, celularOpcional);
    if (!check.pode) {
        return Promise.resolve({
            sucesso: false,
            mensagem: check.mensagem || 'Você já votou para essa loja ou comércio esse mês.'
        });
    }
    if (nota < 1 || nota > 5) {
        return Promise.resolve({ sucesso: false, mensagem: 'Nota inválida. Escolha de 1 a 5 estrelas.' });
    }

    const idn = check.identidade || identidadeVoto(celularOpcional);
    const mes = mesAnoAtual();
    const comentarioLimpo = String(comentario || '').trim().substring(0, 300);

    // Sempre espelha local (anti double-click e offline)
    registrarAvaliacaoLocal(empresaId, nota, idn, mes, comentarioLimpo);

    if (!sbCfg()) {
        return Promise.resolve({
            sucesso: true,
            mensagem: 'Avaliação registrada neste aparelho. Configure o Supabase para o gestor ver todos os votos.'
        });
    }

    return sbEnviarAvaliacao(empresaId, nota, idn.chave, mes, comentarioLimpo).then(function (r) {
        if (r.ok) return { sucesso: true, mensagem: r.mensagem };
        if (r.conflito) return { sucesso: false, mensagem: r.mensagem };
        // offline: local já salvou
        if (r.offline) {
            return {
                sucesso: true,
                mensagem: 'Avaliação salva neste aparelho. Quando houver conexão, o gestor verá pela nuvem nos próximos votos.'
            };
        }
        return { sucesso: false, mensagem: r.mensagem || 'Falha ao enviar avaliação.' };
    });
}

function totalEstrelasEmpresa(empresaId) {
    try {
        const lista = JSON.parse(localStorage.getItem('cd_avaliacoes_lista_' + empresaId) || '[]');
        return lista.reduce((acc, a) => acc + (parseInt(a.nota, 10) || 0), 0);
    } catch { return 0; }
}

function mediaEmpresa(empresaId) {
    try {
        const lista = JSON.parse(localStorage.getItem('cd_avaliacoes_lista_' + empresaId) || '[]');
        if (!lista.length) return { media: 0, total: 0 };
        const soma = lista.reduce((acc, a) => acc + (parseInt(a.nota, 10) || 0), 0);
        return { media: soma / lista.length, total: lista.length };
    } catch { return { media: 0, total: 0 }; }
}

/** Atualiza média na UI a partir do Supabase (quando houver) */
function atualizarMediaNaPagina(empresaId) {
    var num = document.getElementById('empMediaNum');
    var stars = document.getElementById('empMediaStars');
    var txt = document.getElementById('empMediaTxt');
    function pintar(m) {
        if (!m || !m.total) {
            if (num) num.textContent = '—';
            if (txt) txt.textContent = 'Sem avaliações ainda';
            if (stars) stars.innerHTML = '';
            return;
        }
        var mediaFmt = (Math.round(m.media * 10) / 10).toFixed(1);
        var soma = (m.soma != null && m.soma > 0) ? m.soma : Math.round(m.media * m.total);
        // Compatível com votos: no máximo 5★ por avaliação
        var maxSoma = (m.total || 0) * 5;
        if (m.total > 0 && soma > maxSoma) soma = maxSoma;
        if (num) num.textContent = soma + '★';
        if (txt) {
            txt.textContent = soma + '★ · média ' + mediaFmt +
                ' (' + m.total + (m.total === 1 ? ' avaliação)' : ' avaliações)');
        }
        if (stars) stars.innerHTML = renderMediaEstrelas(m.media, m.total);
    }
    // local imediato
    pintar(mediaEmpresa(empresaId));
    // nuvem
    if (sbCfg()) {
        sbMediaEmpresa(empresaId).then(function (m) {
            if (m) pintar(m);
        });
    }
}

function renderEstrelasAvaliacao(containerId, empresaId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const logado = getAnuncianteLogado();

    // Já votou este mês? (login OU aparelho visitante)
    const checkPrevio = podeAvaliar(empresaId, null);
    if (!checkPrevio.pode && !checkPrevio.precisaCelular) {
        const extra = logado
            ? 'Conta logada: 1 voto por loja no mês (pode avaliar outras lojas).'
            : 'Neste aparelho já houve voto nesta loja este mês. Trocar o número não libera outro voto.';
        container.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                    <p class="text-yellow-800 font-medium">
                        <i class="fas fa-info-circle mr-1"></i>
                        ${checkPrevio.mensagem || 'Você já votou para essa loja ou comércio esse mês.'}
                    </p>
                    <p class="text-yellow-700 text-sm mt-1">${extra}</p>
                </div>`;
        return;
    }

    const celSalvo = getCelularSalvo();
    const temCelAuto = !!(logado || (celSalvo && celSalvo.length >= 10));
    // Visitante: pede celular com DDD na 1ª vez; logado não precisa
    const campoCelular = temCelAuto ? '' : `
            <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 mb-1">Seu celular com DDD (WhatsApp)</label>
                <input type="tel" id="celAvaliacao" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="65 9xxxx-xxxx" inputmode="numeric" value="">
                <p class="text-[11px] text-gray-400 mt-1">1 voto por loja por mês neste aparelho. Trocar o número depois não libera novo voto na mesma loja.</p>
            </div>`;

    const avisoLogado = logado ? `
            <p class="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
                <i class="fas fa-user-check mr-1"></i> Logado como <strong>${(logado.nome || 'anunciante').replace(/</g,'')}</strong> —
                voto com sua conta (1 vez no mês nesta loja; pode votar em outras).
            </p>` : (celSalvo ? `
            <p class="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">
                <i class="fas fa-mobile-alt mr-1"></i> Celular lembrado neste aparelho: <strong>${celSalvo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</strong>
            </p>` : '');

    container.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h3 class="font-bold text-gray-800 mb-1">Avalie este estabelecimento</h3>
            <p class="text-xs text-gray-500 mb-3">De 1 a 5 estrelas. Pode avaliar várias lojas. Cada loja: 1 voto por mês${logado ? ' por conta' : ' por aparelho'}.</p>
            ${avisoLogado}
            ${campoCelular}
            <div class="flex gap-1 mb-4" id="estrelasSelect">
                ${[1,2,3,4,5].map(n => `
                    <button type="button" data-nota="${n}" class="estrela-btn text-3xl text-gray-300 hover:text-yellow-400 transition focus:outline-none">
                        <i class="fas fa-star"></i>
                    </button>
                `).join('')}
            </div>
            <textarea id="comentarioAvaliacao" rows="2" maxlength="300"
                placeholder="Comentário opcional (máx. 300 caracteres)"
                class="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-primary mb-3"></textarea>
            <button id="btnEnviarAvaliacao" class="w-full bg-primary text-white font-bold py-2.5 rounded-xl hover:bg-accent transition disabled:opacity-50" disabled>
                Enviar avaliação
            </button>
            <p id="msgAvaliacao" class="text-sm mt-2 text-center hidden"></p>
        </div>
    `;

    let notaSelecionada = 0;
    const estrelas = container.querySelectorAll('.estrela-btn');
    const btnEnviar = document.getElementById('btnEnviarAvaliacao');
    const msg = document.getElementById('msgAvaliacao');

    estrelas.forEach(btn => {
        btn.addEventListener('click', () => {
            notaSelecionada = parseInt(btn.dataset.nota);
            estrelas.forEach((b, i) => {
                if (i < notaSelecionada) {
                    b.classList.remove('text-gray-300');
                    b.classList.add('text-yellow-400');
                } else {
                    b.classList.add('text-gray-300');
                    b.classList.remove('text-yellow-400');
                }
            });
            btnEnviar.disabled = false;
        });
    });

    btnEnviar.addEventListener('click', () => {
        const celEl = document.getElementById('celAvaliacao');
        let celular = celEl ? celEl.value : '';
        if (!normalizarCelular(celular) && logado && logado.celular) celular = logado.celular;
        if (!normalizarCelular(celular)) celular = getCelularSalvo();
        const comentario = document.getElementById('comentarioAvaliacao').value;
        btnEnviar.disabled = true;
        msg.classList.remove('hidden');
        msg.className = 'text-sm mt-2 text-center text-gray-500 font-medium';
        msg.textContent = 'Enviando…';

        Promise.resolve(registrarAvaliacao(empresaId, notaSelecionada, comentario, celular))
            .then(function (resultado) {
                if (resultado.sucesso) {
                    if (celular) salvarCelularAvaliacao(celular);
                    msg.className = 'text-sm mt-2 text-center text-green-600 font-medium';
                    msg.textContent = resultado.mensagem;
                    atualizarMediaNaPagina(empresaId);
                    setTimeout(function () {
                        container.innerHTML =
                            '<div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">' +
                            '<p class="text-green-800 font-medium"><i class="fas fa-check-circle mr-1"></i> Avaliação registrada.</p>' +
                            '<p class="text-green-700 text-sm mt-1">Você poderá votar novamente nesta loja no próximo mês.</p></div>';
                    }, 600);
                } else {
                    btnEnviar.disabled = false;
                    msg.className = 'text-sm mt-2 text-center text-red-600 font-medium';
                    msg.textContent = resultado.mensagem;
                }
            });
    });
}

function renderMediaEstrelas(media, total = 0) {
    const cheias = Math.floor(media);
    const meia = media % 1 >= 0.5;
    let html = '<div class="flex items-center gap-1">';
    for (let i = 1; i <= 5; i++) {
        if (i <= cheias) {
            html += '<i class="fas fa-star text-yellow-400"></i>';
        } else if (i === cheias + 1 && meia) {
            html += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
        } else {
            html += '<i class="far fa-star text-gray-300"></i>';
        }
    }
    if (total > 0) {
        html += '<span class="text-sm text-gray-500 ml-1">(' + total + ')</span>';
    }
    html += '</div>';
    return html;
}

window.Avaliacoes = {
    podeAvaliar,
    registrarAvaliacao,
    renderEstrelasAvaliacao,
    renderMediaEstrelas,
    totalEstrelasEmpresa,
    mediaEmpresa,
    atualizarMediaNaPagina,
    sbMediaEmpresa,
    sbResumoTodas,
    sbApagarAvaliacoesEmpresa,
    normalizarCelular,
    getAnuncianteLogado,
    getAparelhoId,
    aparelhoJaVotou
};
