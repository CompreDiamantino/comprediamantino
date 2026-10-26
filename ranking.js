/**
 * Ranking por setor — Top 10 por estrelas
 * Ofertas da semana entram em cada seção (categoria)
 */
(function (global) {
    const CATEGORIAS = [
        { id: 'alimentacao', nome: 'Alimentação', icone: 'fa-utensils' },
        { id: 'moda', nome: 'Moda e Vestuário', icone: 'fa-shirt' },
        { id: 'casa', nome: 'Casa e Construção', icone: 'fa-house' },
        { id: 'automotivo', nome: 'Automotivo', icone: 'fa-car' },
        { id: 'saude', nome: 'Saúde e Beleza', icone: 'fa-heart-pulse' },
        { id: 'servicos', nome: 'Serviços', icone: 'fa-screwdriver-wrench' },
        { id: 'agro', nome: 'Agro e Pet', icone: 'fa-paw' },
        { id: 'outros', nome: 'Outros', icone: 'fa-store' }
    ];

    /** Soma de estrelas por empresa (cd_avaliacoes + cd_estrelas_empresa_*) */
    function estrelasEmpresa(empresaId) {
        let total = 0;
        let qtd = 0;
        try {
            const extra = parseInt(localStorage.getItem('cd_estrelas_empresa_' + empresaId) || '0', 10);
            if (extra) total += extra;
        } catch (e) {}
        try {
            const raw = JSON.parse(localStorage.getItem('cd_avaliacoes') || '{}');
            Object.keys(raw).forEach(function (k) {
                const a = raw[k];
                if (!a) return;
                if (a.empresaId === empresaId || k.indexOf('_' + empresaId) !== -1 || k.endsWith(empresaId)) {
                    total += parseInt(a.nota, 10) || 0;
                    qtd++;
                }
            });
        } catch (e) {}
        // demo: se zero, gera ranking estável a partir do id
        if (total === 0 && empresaId) {
            let h = 0;
            for (let i = 0; i < empresaId.length; i++) h = (h + empresaId.charCodeAt(i) * (i + 1)) % 200;
            total = 20 + h; // só para demo visual até haver votos reais
        }
        return { total: total, qtd: qtd };
    }

    function listarEmpresas() {
        if (window.EmpresasDados && EmpresasDados.seedSeVazio) {
            return EmpresasDados.seedSeVazio().filter(function (e) {
                return (e.status === 'ativo' || e.status === 'aviso') && !e.publico;
            });
        }
        return [];
    }

    /** Top N por categoria, ordenado por estrelas */
    function topPorCategoria(limite) {
        limite = limite || 10;
        const empresas = listarEmpresas().map(function (e) {
            const est = estrelasEmpresa(e.id);
            return Object.assign({}, e, { estrelas: est.total, numAvaliacoes: est.qtd });
        });

        const porCat = {};
        CATEGORIAS.forEach(function (c) { porCat[c.id] = []; });

        empresas.forEach(function (e) {
            const cat = e.categoria || 'outros';
            if (!porCat[cat]) porCat[cat] = [];
            porCat[cat].push(e);
        });

        const resultado = [];
        CATEGORIAS.forEach(function (c) {
            const lista = (porCat[c.id] || []).slice().sort(function (a, b) {
                return b.estrelas - a.estrelas;
            }).slice(0, limite);
            if (lista.length) {
                resultado.push({ categoria: c, empresas: lista });
            }
        });
        return resultado;
    }

    /** Ofertas: usa promoções salvas ou placeholder da empresa no top */
    function ofertasPorSetor(limitePorSetor) {
        limitePorSetor = limitePorSetor || 3;
        let promos = [];
        try {
            promos = JSON.parse(localStorage.getItem('cd_promocoes') || '[]');
        } catch (e) {}

        const tops = topPorCategoria(10);
        return tops.map(function (bloco) {
            const ofertas = [];
            // promoções reais ligadas a empresas desse setor
            promos.forEach(function (p) {
                const emp = bloco.empresas.find(function (e) { return e.id === p.empresaId; });
                if (emp) {
                    ofertas.push({
                        titulo: p.titulo || 'Oferta',
                        texto: p.texto || p.descricao || '',
                        empresa: emp.nome,
                        empresaId: emp.id,
                        whatsapp: emp.whatsapp || '',
                        selo: p.selo || 'Oferta',
                        estrelas: emp.estrelas
                    });
                }
            });
            // completa com top estrelas do setor (vitrine)
            bloco.empresas.forEach(function (e) {
                if (ofertas.length >= limitePorSetor) return;
                if (ofertas.some(function (o) { return o.empresaId === e.id; })) return;
                ofertas.push({
                    titulo: e.nome,
                    texto: (e.endereco || 'Diamantino-MT') + ' · ' + e.estrelas + '★ no ranking',
                    empresa: e.nome,
                    empresaId: e.id,
                    whatsapp: e.whatsapp || '',
                    selo: 'Top ★',
                    estrelas: e.estrelas
                });
            });
            return {
                categoria: bloco.categoria,
                ofertas: ofertas.slice(0, limitePorSetor)
            };
        }).filter(function (b) { return b.ofertas.length > 0; });
    }

    function renderOfertasNaHome(containerId) {
        const el = document.getElementById(containerId || 'ofertasPorSetor');
        if (!el) return;

        const blocos = ofertasPorSetor(3);
        if (!blocos.length) {
            el.innerHTML = '<p class="text-center text-gray-400">Nenhuma oferta no momento. Seja o primeiro a anunciar!</p>';
            return;
        }

        el.innerHTML = blocos.map(function (b) {
            const cards = b.ofertas.map(function (o) {
                const wa = o.whatsapp
                    ? 'https://wa.me/55' + String(o.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent('Olá! Vi ' + o.titulo + ' no Compre Diamantino')
                    : 'empresa.html?id=' + o.empresaId;
                return (
                    '<div class="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">' +
                    '<div class="flex justify-between items-start mb-2">' +
                    '<span class="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">' + o.selo + '</span>' +
                    '<span class="text-xs text-yellow-600 font-semibold">' + o.estrelas + '★</span>' +
                    '</div>' +
                    '<h3 class="font-bold text-gray-900 mb-1">' + o.titulo + '</h3>' +
                    '<p class="text-sm text-gray-500 mb-2">' + o.empresa + '</p>' +
                    '<p class="text-sm text-gray-600 mb-4">' + o.texto + '</p>' +
                    '<a href="' + wa + '" class="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">' +
                    '<i class="fab fa-whatsapp text-green-500"></i> Ver / WhatsApp</a>' +
                    '</div>'
                );
            }).join('');

            return (
                '<div class="mb-10">' +
                '<div class="flex items-center gap-2 mb-4">' +
                '<i class="fas ' + b.categoria.icone + ' text-primary"></i>' +
                '<h3 class="text-lg font-bold text-primary">' + b.categoria.nome + '</h3>' +
                '<span class="text-xs text-gray-400">Top por estrelas</span>' +
                '</div>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">' + cards + '</div>' +
                '</div>'
            );
        }).join('');
    }

    global.RankingCD = {
        CATEGORIAS,
        estrelasEmpresa,
        topPorCategoria,
        ofertasPorSetor,
        renderOfertasNaHome
    };
})(window);
