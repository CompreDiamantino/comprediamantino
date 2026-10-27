/**
 * Utilitários de login — Compre Diamantino
 * Espelho do IBN: e-mail OU telefone + últimos 3 logins
 * Sessão do gestor: navega livre + bloqueio por inatividade (só senha)
 */

const ULTIMOS_LOGINS_KEY = 'cd_ultimos_logins';
const MAX_ULTIMOS = 3;
const GESTOR_SESSION_KEY = 'cd_gestor';
const ADMIN_SESSION_KEY = 'cd_admin';
const INACTIVITY_MS = 60 * 1000; // 1 minuto

/** Senhas de LOGIN completo do gestor (iguais ao padrão IBN) */
const SENHAS_GESTOR_LOGIN = [
    'IbnDiamantino@2026',
    'IBN-Gestor-2026!'
];

/** Senha curta só para DESBLOQUEIO após inatividade (não é login completo) */
const SENHA_DESBLOQUEIO = 'com1234';

/** Usuários aceitos no login do gestor */
const USUARIOS_GESTOR = [
    'gestor',
    'gestor@ibndiamantino.com.br',
    'admin@ibndiamantino.com.br',
    'admin'
];

function senhaGestorValida(senha) {
    if (!senha) return false;
    const s = String(senha).trim();
    return SENHAS_GESTOR_LOGIN.some(p => p === s);
}

function senhaDesbloqueioValida(senha) {
    if (!senha) return false;
    const s = String(senha).trim();
    return s === SENHA_DESBLOQUEIO || senhaGestorValida(s);
}

/** Normaliza: se for telefone, só números; se e-mail, minúsculo */
function normalizarIdentificador(valor) {
    if (!valor) return '';
    const v = String(valor).trim();
    const soDigitos = v.replace(/\D/g, '');
    if (soDigitos.length >= 10 && soDigitos.length <= 13 && !v.includes('@')) {
        return soDigitos;
    }
    return v.toLowerCase();
}

function lerUltimosLogins() {
    try {
        const lista = JSON.parse(localStorage.getItem(ULTIMOS_LOGINS_KEY) || '[]');
        return Array.isArray(lista) ? lista.filter(Boolean).slice(0, MAX_ULTIMOS) : [];
    } catch {
        return [];
    }
}

function salvarUltimoLogin(identificador) {
    if (!identificador || !String(identificador).trim()) return;
    const id = String(identificador).trim();
    let lista = lerUltimosLogins().filter(x => normalizarIdentificador(x) !== normalizarIdentificador(id));
    lista.unshift(id);
    lista = lista.slice(0, MAX_ULTIMOS);
    localStorage.setItem(ULTIMOS_LOGINS_KEY, JSON.stringify(lista));
}

function preencherUltimosLogins(inputId, chipsId, datalistId) {
    const lista = lerUltimosLogins();
    const input = document.getElementById(inputId);
    const chips = document.getElementById(chipsId);
    const dl = datalistId ? document.getElementById(datalistId) : null;

    if (dl) {
        dl.innerHTML = '';
        lista.forEach(id => {
            const o = document.createElement('option');
            o.value = id;
            dl.appendChild(o);
        });
    }

    if (chips) {
        chips.innerHTML = '';
        if (lista.length === 0) {
            chips.classList.add('hidden');
        } else {
            chips.classList.remove('hidden');
        }
        lista.forEach(id => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'text-xs font-bold bg-gray-100 hover:bg-yellow-100 text-primary border border-gray-200 rounded-full px-3 py-1 transition';
            b.textContent = id.length > 22 ? id.substring(0, 20) + '…' : id;
            b.title = 'Usar este login: ' + id;
            b.onclick = () => {
                if (input) {
                    input.value = id;
                    input.focus();
                }
                const senha = document.querySelector('input[type="password"]');
                if (senha) senha.focus();
            };
            chips.appendChild(b);
        });
    }
}

function setupToggleSenha(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input || !btn) return;

    btn.addEventListener('click', () => {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        btn.innerHTML = isPass
            ? '<i class="fas fa-eye-slash"></i>'
            : '<i class="fas fa-eye"></i>';
    });
}

function gerarSenhaTemporaria() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
}

/* ========== SESSÃO DO GESTOR ========== */

function getGestorSession() {
    try {
        return JSON.parse(localStorage.getItem(GESTOR_SESSION_KEY) || 'null');
    } catch {
        return null;
    }
}

function isGestorLogado() {
    const g = getGestorSession();
    return !!(g && g.logado);
}

/** Atualiza última atividade (chamado em eventos de mouse/teclado) */
function tocarAtividadeGestor() {
    const g = getGestorSession();
    if (!g || !g.logado) return;
    g.ultimaAtividade = Date.now();
    g.bloqueado = false;
    localStorage.setItem(GESTOR_SESSION_KEY, JSON.stringify(g));
    try {
        const a = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || '{}');
        a.logado = true;
        a.viaGestor = true;
        a.nivel = 'gestor';
        a.logadoEm = a.logadoEm || new Date().toISOString();
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(a));
    } catch (_) {}
}

/** Verifica se passou 1 min sem atividade → bloqueia (pede só senha) */
function verificarInatividadeGestor() {
    const g = getGestorSession();
    if (!g || !g.logado) return { ok: false, motivo: 'sem_sessao' };
    const ultima = g.ultimaAtividade || (g.logadoEm ? new Date(g.logadoEm).getTime() : 0);
    if (Date.now() - ultima > INACTIVITY_MS) {
        g.bloqueado = true;
        localStorage.setItem(GESTOR_SESSION_KEY, JSON.stringify(g));
        return { ok: false, motivo: 'inativo', usuario: g.usuario };
    }
    return { ok: true, sessao: g };
}

/** Desbloqueia com senha (sem fazer logout completo) */
function desbloquearGestor(senha) {
    if (!senhaDesbloqueioValida(senha)) return false;
    const g = getGestorSession();
    if (!g) return false;
    g.bloqueado = false;
    g.ultimaAtividade = Date.now();
    g.logado = true;
    localStorage.setItem(GESTOR_SESSION_KEY, JSON.stringify(g));
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
        logado: true,
        viaGestor: true,
        nivel: 'gestor',
        logadoEm: new Date().toISOString()
    }));
    return true;
}

function logoutGestorCompleto() {
    localStorage.removeItem(GESTOR_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem('cd_lojista');
}

/**
 * Protege páginas do gestor.
 * - Se não logado → redireciona para gestor-login
 * - Se inativo (1 min) → mostra modal pedindo só a senha
 * - Se ok → registra atividade e permite navegação
 */
function protegerPaginaGestor(opcoes) {
    const opts = opcoes || {};
    const loginUrl = opts.loginUrl || 'gestor-login.html';

    const status = verificarInatividadeGestor();
    if (status.motivo === 'sem_sessao') {
        window.location.href = loginUrl;
        return false;
    }

    if (status.motivo === 'inativo') {
        mostrarModalBloqueioGestor(status.usuario);
        return false;
    }

    tocarAtividadeGestor();
    const eventos = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    let throttle = null;
    const handler = () => {
        if (throttle) return;
        throttle = setTimeout(() => {
            throttle = null;
            tocarAtividadeGestor();
        }, 2000);
    };
    eventos.forEach(ev => document.addEventListener(ev, handler, { passive: true }));

    setInterval(() => {
        const s = verificarInatividadeGestor();
        if (s.motivo === 'inativo') {
            mostrarModalBloqueioGestor(s.usuario);
        }
    }, 15000);

    return true;
}

function mostrarModalBloqueioGestor(usuario) {
    if (document.getElementById('modalBloqueioGestor')) return;

    const overlay = document.createElement('div');
    overlay.id = 'modalBloqueioGestor';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:28px;max-width:360px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,0.25);">
            <div style="text-align:center;margin-bottom:16px;">
                <div style="width:48px;height:48px;background:#FEF3C7;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;">
                    <i class="fas fa-lock" style="color:#D97706;font-size:20px;"></i>
                </div>
                <h3 style="font-weight:700;color:#0A2A6B;font-size:18px;margin:0;">Sessão pausada</h3>
                <p style="color:#6B7280;font-size:13px;margin:6px 0 0;">Ficou 1 minuto sem mexer. Digite a senha rápida de acesso para continuar.</p>
            </div>
            <p style="font-size:12px;color:#9CA3AF;margin-bottom:8px;">Usuário: <strong style="color:#374151;">${(usuario || 'gestor').replace(/</g, '')}</strong></p>
            <div style="position:relative;margin-bottom:12px;">
                <input type="password" id="senhaDesbloqueioGestor" placeholder="Senha rápida (com1234)"
                    style="width:100%;border:1px solid #E5E7EB;border-radius:12px;padding:12px 40px 12px 14px;font-size:15px;outline:none;box-sizing:border-box;"
                    autocomplete="current-password">
                <button type="button" id="btnOlhoBloqueio" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);border:none;background:none;color:#9CA3AF;cursor:pointer;">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
            <div id="msgErroBloqueio" style="display:none;color:#DC2626;font-size:13px;text-align:center;margin-bottom:10px;"></div>
            <button type="button" id="btnDesbloquearGestor"
                style="width:100%;background:#0A2A6B;color:#fff;font-weight:700;padding:12px;border:none;border-radius:12px;cursor:pointer;font-size:15px;">
                Continuar
            </button>
            <button type="button" id="btnSairDoBloqueio"
                style="width:100%;background:transparent;color:#6B7280;font-weight:500;padding:10px;border:none;border-radius:12px;cursor:pointer;font-size:13px;margin-top:6px;">
                Sair e fazer login completo
            </button>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('senhaDesbloqueioGestor');
    input.focus();

    document.getElementById('btnOlhoBloqueio').onclick = () => {
        input.type = input.type === 'password' ? 'text' : 'password';
        document.getElementById('btnOlhoBloqueio').innerHTML =
            input.type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    };

    const tentar = () => {
        const senha = input.value;
        const msg = document.getElementById('msgErroBloqueio');
        if (desbloquearGestor(senha)) {
            overlay.remove();
            tocarAtividadeGestor();
        } else {
            msg.textContent = 'Senha incorreta.';
            msg.style.display = 'block';
            input.value = '';
            input.focus();
        }
    };

    document.getElementById('btnDesbloquearGestor').onclick = tentar;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tentar();
    });

    document.getElementById('btnSairDoBloqueio').onclick = () => {
        logoutGestorCompleto();
        window.location.href = 'gestor-login.html';
    };
}

/** Login completo do gestor (salva sessão com timestamp de atividade) */
function loginGestor(usuario) {
    const sessao = {
        tipo: 'gestor',
        nivel: 'gestor',
        master: true,
        logado: true,
        bloqueado: false,
        usuario: usuario || 'gestor',
        logadoEm: new Date().toISOString(),
        ultimaAtividade: Date.now()
    };
    localStorage.setItem(GESTOR_SESSION_KEY, JSON.stringify(sessao));
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
        logado: true,
        logadoEm: new Date().toISOString(),
        viaGestor: true,
        nivel: 'gestor'
    }));
    salvarUltimoLogin(usuario || 'gestor');
}

/* ========== LOJISTA: buscar por e-mail ou telefone ========== */

function buscarLojistaPorIdentificador(identificador) {
    const idNorm = normalizarIdentificador(identificador);
    if (!idNorm) return null;
    let lista = [];
    try {
        lista = JSON.parse(localStorage.getItem('cd_lojistas_admin') || '[]');
    } catch (_) {}
    return lista.find(lj => {
        const email = (lj.email || '').toLowerCase().trim();
        const tel = normalizarIdentificador(lj.whatsapp || lj.telefone || '');
        return (email && email === idNorm) || (tel && tel === idNorm);
    }) || null;
}

function validarSenhaLojista(lojista, senha) {
    if (!lojista || !senha) return false;
    if (lojista.senha && lojista.senha === senha) return true;
    const idNorm = normalizarIdentificador(lojista.email || lojista.whatsapp || '');
    const temp = localStorage.getItem('cd_temp_login_' + idNorm);
    if (temp && temp === senha) return true;
    return false;
}


/* ========== BARRA DE SESSÃO (estilo IBN) ========== */

function getSessaoAtual() {
    const g = getGestorSession();
    if (g && g.logado) {
        return {
            tipo: 'gestor',
            nome: g.usuario || 'Gestor Master',
            label: 'Gestor Master',
            hub: 'gestor-hub.html'
        };
    }
    try {
        const lj = JSON.parse(localStorage.getItem('cd_lojista') || 'null');
        if (lj && (lj.empresaId || lj.email || lj.identificador)) {
            return {
                tipo: 'lojista',
                nome: lj.nome || lj.email || lj.identificador || 'Lojista',
                label: lj.nome || 'Lojista',
                hub: 'lojista-painel.html'
            };
        }
    } catch (_) {}
    return null;
}

/**
 * Injeta barra verde no topo + ajusta botões do header (como no IBN).
 * Chamar em páginas públicas: AuthUtils.renderBarraSessao();
 */
function renderBarraSessao() {
    const sessao = getSessaoAtual();

    // Remove barra anterior se existir
    const antiga = document.getElementById('cdBarraSessao');
    if (antiga) antiga.remove();

    if (!sessao) return; // visitante: nada muda

    // Mantém atividade do gestor
    if (sessao.tipo === 'gestor') {
        try { tocarAtividadeGestor(); } catch (_) {}
    }

    const barra = document.createElement('div');
    barra.id = 'cdBarraSessao';
    barra.style.cssText = 'background:#ECFDF5;color:#065F46;font-size:13px;padding:8px 12px;text-align:center;border-bottom:1px solid #A7F3D0;position:relative;z-index:50;';
    barra.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;">
            <span>✓ Olá, <strong>${escapeHtml(sessao.label)}</strong>! Você está logado(a).</span>
            <button type="button" id="cdBtnSairBarra" style="border:1px solid #F87171;color:#B91C1C;background:#fff;border-radius:999px;padding:2px 12px;font-size:12px;font-weight:600;cursor:pointer;">
                Sair / Trocar conta
            </button>
        </span>
    `;

    // Insere no topo do body (antes do header)
    const header = document.querySelector('header');
    if (header && header.parentNode) {
        header.parentNode.insertBefore(barra, header);
    } else {
        document.body.insertBefore(barra, document.body.firstChild);
    }

    document.getElementById('cdBtnSairBarra').onclick = () => {
        if (!confirm('Deseja sair da sua conta?\\n\\nVocê poderá entrar com outro usuário em seguida.\\n\\nToque em OK para sair ou Cancelar para continuar logado.')) {
            return;
        }
        if (sessao.tipo === 'gestor') {
            logoutGestorCompleto();
        } else {
            localStorage.removeItem('cd_lojista');
        }
        window.location.reload();
    };

    // Troca "Entrar" no header por atalho da conta
    document.querySelectorAll('a[href="lojista-login.html"], a[href="gestor-login.html"]').forEach(a => {
        const txt = (a.textContent || '').trim().toLowerCase();
        if (txt.includes('entrar') || a.querySelector('.fa-sign-in-alt')) {
            a.href = sessao.hub;
            a.innerHTML = sessao.tipo === 'gestor'
                ? '<i class="fas fa-user-shield"></i> Gestor'
                : '<i class="fas fa-user"></i> ' + escapeHtml(sessao.label.split(' ')[0]);
            a.title = 'Ir para sua área';
        }
    });
}

function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


window.AuthUtils = {
    normalizarIdentificador,
    lerUltimosLogins,
    salvarUltimoLogin,
    preencherUltimosLogins,
    setupToggleSenha,
    gerarSenhaTemporaria,
    getGestorSession,
    isGestorLogado,
    tocarAtividadeGestor,
    verificarInatividadeGestor,
    desbloquearGestor,
    logoutGestorCompleto,
    protegerPaginaGestor,
    loginGestor,
    SENHA_GESTOR: SENHAS_GESTOR_LOGIN[0],
    SENHAS_GESTOR_LOGIN,
    SENHA_DESBLOQUEIO,
    USUARIOS_GESTOR,
    senhaGestorValida,
    senhaDesbloqueioValida,
    buscarLojistaPorIdentificador,
    validarSenhaLojista,
    getSessaoAtual,
    renderBarraSessao
};
