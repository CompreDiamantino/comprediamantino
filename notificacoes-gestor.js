/**
 * Central de avisos do gestor — cores por tipo
 * laranja: novo membro | verde: pagamento | azul: fotos
 * vermelho: parcela vencida | verde-claro: comprovante | roxo: contato
 */
(function (global) {
    const KEY = 'cd_notificacoes_gestor';

    const TIPOS = {
        novo_membro:   { cor: 'bg-orange-500', label: 'Novo membro', icone: 'fa-user-plus' },
        pagamento:     { cor: 'bg-green-600',  label: 'Pagamento recebido', icone: 'fa-check-circle' },
        comprovante:   { cor: 'bg-emerald-500', label: 'Comprovante enviado', icone: 'fa-file-invoice-dollar' },
        fotos:         { cor: 'bg-blue-500',   label: 'Fotos recebidas', icone: 'fa-images' },
        vencido:       { cor: 'bg-red-600',    label: 'Parcela vencida', icone: 'fa-exclamation-triangle' },
        contato:       { cor: 'bg-purple-600', label: 'Mensagem / Fale conosco', icone: 'fa-envelope' }
    };

    function ler() {
        try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
        catch { return []; }
    }

    function salvar(lista) {
        localStorage.setItem(KEY, JSON.stringify(lista.slice(0, 200)));
        atualizarBadge();
        try {
            if (window.cdDb) {
                window.cdDb.collection('notificacoes').doc('gestor').set({
                    itens: lista.slice(0, 50),
                    atualizadoEm: new Date().toISOString()
                }, { merge: true }).catch(function () {});
            }
        } catch (e) {}
    }

    function add(tipo, titulo, detalhe, meta) {
        if (!TIPOS[tipo]) tipo = 'contato';
        const lista = ler();
        const item = {
            id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6),
            tipo: tipo,
            titulo: titulo || TIPOS[tipo].label,
            detalhe: detalhe || '',
            meta: meta || {},
            lida: false,
            em: new Date().toISOString()
        };
        lista.unshift(item);
        salvar(lista);
        return item;
    }

    function marcarLida(id) {
        const lista = ler().map(function (n) {
            if (n.id === id) n.lida = true;
            return n;
        });
        salvar(lista);
    }

    function marcarTodasLidas() {
        salvar(ler().map(function (n) { n.lida = true; return n; }));
    }

    function naoLidas() {
        return ler().filter(function (n) { return !n.lida; }).length;
    }

    function atualizarBadge() {
        const n = naoLidas();
        document.querySelectorAll('[data-notif-badge]').forEach(function (el) {
            if (n > 0) {
                el.textContent = n > 99 ? '99+' : String(n);
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    }

    function renderLista(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const lista = ler();
        if (!lista.length) {
            el.innerHTML = '<p class="text-sm text-gray-400 text-center py-6">Nenhum aviso ainda.</p>';
            return;
        }
        el.innerHTML = lista.map(function (n) {
            const t = TIPOS[n.tipo] || TIPOS.contato;
            const op = n.lida ? 'opacity-60' : '';
            const data = new Date(n.em);
            const quando = isNaN(data) ? '' : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return (
                '<button type="button" data-nid="' + n.id + '" class="notif-item w-full text-left flex gap-3 p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 ' + op + '">' +
                '<span class="flex-shrink-0 w-10 h-10 ' + t.cor + ' text-white rounded-full flex items-center justify-center"><i class="fas ' + t.icone + '"></i></span>' +
                '<span class="min-w-0 flex-1">' +
                '<span class="block text-sm font-bold text-gray-900">' + n.titulo + '</span>' +
                '<span class="block text-xs text-gray-500 truncate">' + (n.detalhe || t.label) + '</span>' +
                '<span class="block text-[10px] text-gray-400 mt-0.5">' + quando + '</span>' +
                '</span></button>'
            );
        }).join('');
        el.querySelectorAll('.notif-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                marcarLida(btn.getAttribute('data-nid'));
                renderLista(containerId);
            });
        });
    }

    /** Sincroniza cadastros pendentes → avisos laranja */
    function syncDeCadastros() {
        let lojistas = [];
        try { lojistas = JSON.parse(localStorage.getItem('cd_lojistas_admin') || '[]'); } catch (e) {}
        const existentes = ler();
        lojistas.forEach(function (l) {
            if (l.status !== 'pendente') return;
            const ja = existentes.some(function (n) {
                return n.tipo === 'novo_membro' && n.meta && n.meta.lojistaId === l.id;
            });
            if (!ja) {
                add('novo_membro', 'Novo cadastro: ' + (l.nome || 'Negócio'),
                    (l.categoria || '') + ' · ' + (l.whatsapp || ''),
                    { lojistaId: l.id });
            }
        });
    }


    /** Sincroniza parcelas vencidas → avisos vermelhos */
    function syncDeVencidos() {
        let lojistas = [];
        try { lojistas = JSON.parse(localStorage.getItem('cd_lojistas_admin') || '[]'); } catch (e) {}
        const existentes = ler();
        const agora = Date.now();
        lojistas.forEach(function (l) {
            if (!l.vencimento) return;
            if (l.status === 'bloqueado' || l.status === 'pendente') return;
            const venc = new Date(l.vencimento).getTime();
            if (isNaN(venc) || venc > agora) return;
            const ja = existentes.some(function (n) {
                return n.tipo === 'vencido' && n.meta && n.meta.lojistaId === l.id && !n.lida;
            });
            if (!ja) {
                add('vencido', 'Parcela vencida: ' + (l.nome || 'Anunciante'),
                    'Venceu em ' + new Date(l.vencimento).toLocaleDateString('pt-BR') + ' · ' + (l.whatsapp || ''),
                    { lojistaId: l.id });
            }
        });
    }

    global.NotifGestor = {
        TIPOS: TIPOS,
        add: add,
        ler: ler,
        marcarLida: marcarLida,
        marcarTodasLidas: marcarTodasLidas,
        naoLidas: naoLidas,
        renderLista: renderLista,
        atualizarBadge: atualizarBadge,
        syncDeCadastros: syncDeCadastros,
        syncDeVencidos: syncDeVencidos
    };

    document.addEventListener('DOMContentLoaded', function () {
        syncDeCadastros();
        atualizarBadge();
    });
})(window);
