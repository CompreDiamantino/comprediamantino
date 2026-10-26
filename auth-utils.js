/**
 * Utilitários de login — Compre Diamantino
 * Espelho do IBN: e-mail OU telefone + últimos 3 logins
 */

const ULTIMOS_LOGINS_KEY = 'cd_ultimos_logins';
const MAX_ULTIMOS = 3;

/** Normaliza: se for telefone, só números; se e-mail, minúsculo */
function normalizarIdentificador(valor) {
    if (!valor) return '';
    const v = String(valor).trim();
    // Se parece telefone (tem dígitos e pouco @)
    const soDigitos = v.replace(/\D/g, '');
    if (soDigitos.length >= 10 && soDigitos.length <= 13 && !v.includes('@')) {
        return soDigitos; // 65999999999
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

window.AuthUtils = {
    normalizarIdentificador,
    lerUltimosLogins,
    salvarUltimoLogin,
    preencherUltimosLogins,
    setupToggleSenha,
    gerarSenhaTemporaria
};
