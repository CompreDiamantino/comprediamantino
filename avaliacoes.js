/**
 * Avaliações — Compre Diamantino
 *
 * Visitante: 1 voto/mês por CELULAR, por loja (vários celulares = vários votos possíveis).
 * Anunciante logado: 1 voto/mês por LOGIN (conta), por loja — vale em qualquer aparelho.
 * Pode avaliar várias lojas no mesmo mês.
 */
const AVALIACOES_KEY = 'cd_avaliacoes';

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
 * - logado → login:email_ou_id
 * - visitante → cel:6599...
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
    const idn = identidadeVoto(celularOpcional);
    if (!idn) {
        return {
            pode: false,
            precisaCelular: !getAnuncianteLogado(),
            mensagem: 'Informe seu celular com DDD para votar.'
        };
    }
    const avaliacoes = getAvaliacoesLocais();
    const chave = chaveVoto(idn.chave, empresaId);
    if (avaliacoes[chave]) {
        return {
            pode: false,
            precisaCelular: false,
            mensagem: 'Você já votou para essa loja ou comércio esse mês.'
        };
    }
    return { pode: true, precisaCelular: false, mensagem: '', identidade: idn };
}

function registrarAvaliacao(empresaId, nota, comentario, celularOpcional) {
    const check = podeAvaliar(empresaId, celularOpcional);
    if (!check.pode) {
        return {
            sucesso: false,
            mensagem: check.mensagem || 'Você já votou para essa loja ou comércio esse mês.'
        };
    }
    if (nota < 1 || nota > 5) {
        return { sucesso: false, mensagem: 'Nota inválida. Escolha de 1 a 5 estrelas.' };
    }

    const idn = check.identidade || identidadeVoto(celularOpcional);
    const mes = mesAnoAtual();
    const chave = chaveVoto(idn.chave, empresaId, mes);
    const avaliacoes = getAvaliacoesLocais();

    avaliacoes[chave] = {
        empresaId,
        nota: parseInt(nota, 10),
        comentario: String(comentario || '').trim().substring(0, 300),
        data: new Date().toISOString(),
        mes: mes,
        tipo: idn.tipo,
        identidade: idn.chave
    };
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

    return { sucesso: true, mensagem: 'Avaliação enviada com sucesso! Obrigado.' };
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

function renderEstrelasAvaliacao(containerId, empresaId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const logado = getAnuncianteLogado();

    // Se já logado, checa se já votou este mês sem pedir celular
    if (logado) {
        const check = podeAvaliar(empresaId, null);
        if (!check.pode) {
            container.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                    <p class="text-yellow-800 font-medium">
                        <i class="fas fa-info-circle mr-1"></i>
                        Você já votou para essa loja ou comércio esse mês.
                    </p>
                    <p class="text-yellow-700 text-sm mt-1">Conta logada: voto único no mês, em qualquer aparelho.</p>
                </div>`;
            return;
        }
    }

    const celSalvo = getCelularSalvo();
    const temCelAuto = !!(logado || (celSalvo && celSalvo.length >= 10));
    // Não pede celular se logado OU se já votou antes neste aparelho (número lembrado)
    const campoCelular = temCelAuto ? '' : `
            <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 mb-1">Seu celular (WhatsApp)</label>
                <input type="tel" id="celAvaliacao" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="65 9xxxx-xxxx" inputmode="numeric" value="">
                <p class="text-[11px] text-gray-400 mt-1">Só na primeira vez neste aparelho. Depois o número fica lembrado.</p>
            </div>`;

    const avisoLogado = logado ? `
            <p class="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
                <i class="fas fa-user-check mr-1"></i> Logado como <strong>${(logado.nome || 'anunciante').replace(/</g,'')}</strong> —
                voto automático com sua conta (1 vez no mês nesta loja).
            </p>` : (celSalvo ? `
            <p class="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">
                <i class="fas fa-mobile-alt mr-1"></i> Celular lembrado neste aparelho: <strong>${celSalvo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</strong>
            </p>` : '');

    container.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h3 class="font-bold text-gray-800 mb-1">Avalie este estabelecimento</h3>
            <p class="text-xs text-gray-500 mb-3">De 1 a 5 estrelas. Pode avaliar várias lojas. Cada loja: 1 voto por mês.</p>
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
        // Logado → não precisa; senão campo ou número já salvo no aparelho
        let celular = celEl ? celEl.value : '';
        if (!normalizarCelular(celular) && logado && logado.celular) celular = logado.celular;
        if (!normalizarCelular(celular)) celular = getCelularSalvo();
        const comentario = document.getElementById('comentarioAvaliacao').value;
        const resultado = registrarAvaliacao(empresaId, notaSelecionada, comentario, celular);

        msg.classList.remove('hidden');
        if (resultado.sucesso) {
            if (celular) salvarCelularAvaliacao(celular);
            msg.className = 'text-sm mt-2 text-center text-green-600 font-medium';
            msg.textContent = resultado.mensagem;
            setTimeout(() => {
                container.innerHTML = `
                    <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <p class="text-green-800 font-medium"><i class="fas fa-check-circle mr-1"></i> Avaliação registrada.</p>
                        <p class="text-green-700 text-sm mt-1">Você poderá votar novamente nesta loja no próximo mês.</p>
                    </div>`;
            }, 800);
        } else {
            msg.className = 'text-sm mt-2 text-center text-red-600 font-medium';
            msg.textContent = resultado.mensagem;
        }
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
    normalizarCelular,
    getAnuncianteLogado
};
