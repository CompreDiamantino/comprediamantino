/**
 * Ranking por setor — Top 10 por estrelas
 * Fonte principal: Supabase (avaliacoes_resumo) — visível para visitante e lojista.
 * Fallback: localStorage (offline / falha de rede).
 *
 * Exibição:
 *   Badge:  20★          → soma_estrelas (popularidade / pontos para desconto)
 *   Texto:  20★ no ranking · média 5.0 (4 votos)
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

    /** Cache do resumo vindo do Supabase (empresa_id → { media, total, soma }) */
    var _resumoCache = null;
    var _resumoPromise = null;

    /** Soma de estrelas local (fallback offline) */
    function estrelasEmpresaLocal(empresaId) {
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
        return { total: total, qtd: qtd, media: qtd ? total / qtd : 0 };
    }

    /**
     * Busca todos os resumos em avaliacoes_resumo (API pública).
     * Retorna Promise<{ [empresa_id]: { media, total, soma } }>
     */
    function carregarResumoNuvem() {
        if (_resumoCache) return Promise.resolve(_resumoCache);
        if (_resumoPromise) return _resumoPromise;

        _resumoPromise = Promise.resolve()
            .then(function () {
                // Preferência: função já exposta por avaliacoes.js
                if (window.Avaliacoes && typeof Avaliacoes.sbResumoTodas === 'function') {
                    return Avaliacoes.sbResumoTodas();
                }
                // Fallback direto (caso scripts carreguem em ordem diferente)
                var cfg = window.CD_SUPABASE;
                if (!cfg || !cfg.url || !cfg.anonKey) return [];
                var url = String(cfg.url).replace(/\/$/, '') +
                    '/rest/v1/avaliacoes_resumo?select=empresa_id,media,total,soma_estrelas';
                return fetch(url, {
                    headers: {
                        'apikey': cfg.anonKey,
                        'Authorization': 'Bearer ' + cfg.anonKey,
                        'Accept': 'application/json'
                    }
                }).then(function (r) { return r.ok ? r.json() : []; })
                  .catch(function () { return []; });
            })
            .then(function (rows) {
                var mapa = {};
                if (Array.isArray(rows)) {
                    rows.forEach(function (row) {
                        if (!row || row.empresa_id == null) return;
                        var id = String(row.empresa_id);
                        mapa[id] = {
                            media: parseFloat(row.media) || 0,
                            total: parseInt(row.total, 10) || 0,
                            soma: parseInt(row.soma_estrelas, 10) || 0
                        };
                    });
                }
                _resumoCache = mapa;
                _resumoPromise = null;
                return mapa;
            })
            .catch(function () {
                _resumoPromise = null;
                return {};
            });

        return _resumoPromise;
    }

    /** Retorna { total/soma, qtd, media } — prioriza nuvem, senão local */
    function estrelasEmpresa(empresaId, mapaNuvem) {
        var id = String(empresaId || '');
        if (mapaNuvem && mapaNuvem[id]) {
            var r = mapaNuvem[id];
            return {
                total: r.soma || 0,
                qtd: r.total || 0,
                media: r.media || 0
            };
        }
        return estrelasEmpresaLocal(empresaId);
    }

    function listarEmpresas() {
        if (window.EmpresasDados && EmpresasDados.seedSeVazio) {
            return EmpresasDados.seedSeVazio().filter(function (e) {
                return (e.status === 'ativo' || e.status === 'aviso') && !e.publico;
            });
        }
        return [];
    }

    /**
     * Top N por categoria.
     * Se mapaNuvem for passado, usa dados da nuvem; senão usa só localStorage.
     */
    function topPorCategoria(limite, mapaNuvem) {
        limite = limite || 10;
        const empresas = listarEmpresas().map(function (e) {
            const est = estrelasEmpresa(e.id, mapaNuvem);
            return Object.assign({}, e, {
                estrelas: est.total,          // soma (para ordenação e badge)
                numAvaliacoes: est.qtd,
                media: est.media
            });
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

    function formatarMedia(m) {
        if (!m || m <= 0) return '0.0';
        return (Math.round(m * 10) / 10).toFixed(1);
    }

    /** Ofertas: promoções salvas + top estrelas do setor */
    function ofertasPorSetor(limitePorSetor, mapaNuvem) {
        limitePorSetor = limitePorSetor || 3;
        let promos = [];
        try {
            promos = JSON.parse(localStorage.getItem('cd_promocoes') || '[]');
        } catch (e) {}

        const tops = topPorCategoria(10, mapaNuvem);
        return tops.map(function (bloco) {
            const ofertas = [];
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
                        estrelas: emp.estrelas,
                        media: emp.media,
                        numAvaliacoes: emp.numAvaliacoes
                    });
                }
            });
            bloco.empresas.forEach(function (e) {
                if (ofertas.length >= limitePorSetor) return;
                if (ofertas.some(function (o) { return o.empresaId === e.id; })) return;

                var textoRanking;
                if (e.estrelas > 0) {
                    textoRanking = e.estrelas + '★ no ranking · média ' +
                        formatarMedia(e.media) +
                        (e.numAvaliacoes ? ' (' + e.numAvaliacoes + ' voto' + (e.numAvaliacoes === 1 ? '' : 's') + ')' : '');
                } else {
                    textoRanking = '0★ no ranking';
                }

                ofertas.push({
                    titulo: e.nome,
                    texto: (e.endereco || 'Diamantino-MT') + ' · ' + textoRanking,
                    empresa: e.nome,
                    empresaId: e.id,
                    whatsapp: e.whatsapp || '',
                    selo: 'Top ★',
                    estrelas: e.estrelas,
                    media: e.media,
                    numAvaliacoes: e.numAvaliacoes
                });
            });
            return {
                categoria: bloco.categoria,
                ofertas: ofertas.slice(0, limitePorSetor)
            };
        }).filter(function (b) { return b.ofertas.length > 0; });
    }

    /**
     * Renderiza a home.
     * Busca avaliacoes_resumo no Supabase e só então monta os cards.
     * Fallback automático para localStorage se a nuvem falhar.
     */
    function renderOfertasNaHome(containerId) {
        const el = document.getElementById(containerId || 'ofertasPorSetor');
        if (!el) return;

        function pintar(mapaNuvem) {
            const blocos = ofertasPorSetor(3, mapaNuvem || {});
            if (!blocos.length) {
                el.innerHTML = '<p class="text-center text-gray-400">Nenhuma oferta no momento. Seja o primeiro a anunciar!</p>';
                return;
            }

            el.innerHTML = blocos.map(function (b) {
                const cards = b.ofertas.map(function (o) {
                    const wa = o.whatsapp
                        ? 'https://wa.me/55' + String(o.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent('Olá! Vi ' + o.titulo + ' no Compre Diamantino')
                        : 'empresa.html?id=' + o.empresaId;

                    // Badge: soma de estrelas em destaque (o que o gestor usa no desconto)
                    var badgeEstrelas = (o.estrelas > 0 ? o.estrelas : 0) + '★';

                    return (
                        '<div class="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">' +
                        '<div class="flex justify-between items-start mb-2">' +
                        '<span class="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">' + o.selo + '</span>' +
                        '<span class="text-xs text-yellow-600 font-semibold">' + badgeEstrelas + '</span>' +
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

        // Mostra loading leve enquanto busca
        if (!el.dataset.rankingLoading) {
            el.dataset.rankingLoading = '1';
            // mantém conteúdo atual ou placeholder
        }

        carregarResumoNuvem()
            .then(function (mapa) {
                el.dataset.rankingLoading = '';
                pintar(mapa);
            })
            .catch(function () {
                el.dataset.rankingLoading = '';
                pintar({}); // fallback local
            });
    }

    /** Força novo fetch na próxima renderização (útil após votar) */
    function invalidarCacheResumo() {
        _resumoCache = null;
        _resumoPromise = null;
    }

    global.RankingCD = {
        CATEGORIAS,
        estrelasEmpresa: function (id) { return estrelasEmpresa(id, _resumoCache); },
        topPorCategoria: function (limite) { return topPorCategoria(limite, _resumoCache); },
        ofertasPorSetor: function (limite) { return ofertasPorSetor(limite, _resumoCache); },
        renderOfertasNaHome,
        carregarResumoNuvem,
        invalidarCacheResumo
    };
})(window);
