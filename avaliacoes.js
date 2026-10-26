/**
 * Sistema de Avaliações - Compre Diamantino
 * Regra: 1 avaliação por empresa a cada 30 dias (por dispositivo)
 */

const AVALIACOES_KEY = 'cd_avaliacoes';
const PRAZO_DIAS = 30;

// Gera um ID único do dispositivo (persistente no navegador)
function getDeviceId() {
    let id = localStorage.getItem('cd_device_id');
    if (!id) {
        id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('cd_device_id', id);
    }
    return id;
}

// Busca todas as avaliações salvas localmente
function getAvaliacoesLocais() {
    try {
        return JSON.parse(localStorage.getItem(AVALIACOES_KEY) || '{}');
    } catch {
        return {};
    }
}

// Salva avaliações locais
function salvarAvaliacoesLocais(dados) {
    localStorage.setItem(AVALIACOES_KEY, JSON.stringify(dados));
}

/**
 * Verifica se o usuário já avaliou esta empresa nos últimos 30 dias
 * @returns { object } { pode: boolean, diasRestantes: number }
 */
function podeAvaliar(empresaId) {
    const deviceId = getDeviceId();
    const avaliacoes = getAvaliacoesLocais();
    const chave = `${deviceId}_${empresaId}`;
    
    if (!avaliacoes[chave]) {
        return { pode: true, diasRestantes: 0 };
    }
    
    const dataAvaliacao = new Date(avaliacoes[chave].data);
    const agora = new Date();
    const diffMs = agora - dataAvaliacao;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDias >= PRAZO_DIAS) {
        return { pode: true, diasRestantes: 0 };
    }
    
    return {
        pode: false,
        diasRestantes: PRAZO_DIAS - diffDias
    };
}

/**
 * Registra uma avaliação localmente (e depois no Firebase)
 * @param {string} empresaId 
 * @param {number} nota - 1 a 5
 * @param {string} comentario - opcional
 */
function registrarAvaliacao(empresaId, nota, comentario = '') {
    const check = podeAvaliar(empresaId);
    
    if (!check.pode) {
        return {
            sucesso: false,
            mensagem: `Você já avaliou esta empresa recentemente. Poderá avaliar novamente em ${check.diasRestantes} dia(s).`
        };
    }
    
    if (nota < 1 || nota > 5) {
        return { sucesso: false, mensagem: 'Nota inválida. Escolha de 1 a 5 estrelas.' };
    }
    
    const deviceId = getDeviceId();
    const avaliacoes = getAvaliacoesLocais();
    const chave = `${deviceId}_${empresaId}`;
    
    avaliacoes[chave] = {
        empresaId,
        nota,
        comentario: comentario.trim().substring(0, 300),
        data: new Date().toISOString(),
        deviceId
    };
    
    salvarAvaliacoesLocais(avaliacoes);
    
    // Aqui depois salvamos também no Firebase
    // salvarAvaliacaoFirebase(empresaId, nota, comentario, deviceId);
    
    return {
        sucesso: true,
        mensagem: 'Avaliação enviada com sucesso! Obrigado.'
    };
}

/**
 * Renderiza o componente de estrelas para avaliar
 */
function renderEstrelasAvaliacao(containerId, empresaId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const check = podeAvaliar(empresaId);
    
    if (!check.pode) {
        container.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <p class="text-yellow-800 font-medium">
                    <i class="fas fa-info-circle mr-1"></i>
                    Você já avaliou esta empresa recentemente.
                </p>
                <p class="text-yellow-600 text-sm mt-1">
                    Poderá avaliar novamente em <strong>${check.diasRestantes} dia(s)</strong>.
                </p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-xl p-5">
            <h3 class="font-bold text-gray-800 mb-3">Avalie esta empresa</h3>
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
        const comentario = document.getElementById('comentarioAvaliacao').value;
        const resultado = registrarAvaliacao(empresaId, notaSelecionada, comentario);
        
        msg.classList.remove('hidden');
        if (resultado.sucesso) {
            msg.className = 'text-sm mt-2 text-center text-green-600 font-medium';
            msg.textContent = resultado.mensagem;
            // Re-renderiza para mostrar a mensagem de "já avaliou"
            setTimeout(() => renderEstrelasAvaliacao(containerId, empresaId), 1500);
        } else {
            msg.className = 'text-sm mt-2 text-center text-red-600 font-medium';
            msg.textContent = resultado.mensagem;
        }
    });
}

/**
 * Renderiza as estrelas de média (somente leitura)
 * @param {number} media - média de 0 a 5
 * @param {number} total - quantidade de avaliações
 */
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
    
    html += `<span class="text-sm text-gray-500 ml-1">${media.toFixed(1)} (${total})</span></div>`;
    return html;
}

// Exporta para uso global
window.Avaliacoes = {
    podeAvaliar,
    registrarAvaliacao,
    renderEstrelasAvaliacao,
    renderMediaEstrelas,
    getDeviceId
};
