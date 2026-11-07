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

    /** Soma de estrelas local (fallback offline) — só votos reais; sigilosas não entram no público */
    function estrelasEmpresaLocal(empresaId) {
        let total = 0;
        let qtd = 0;
        try {
            const raw = JSON.parse(localStorage.getItem('cd_avaliacoes') || '{}');
            Object.keys(raw).forEach(function (k) {
                const a = raw[k];
                if (!a) return;
                if (a.empresaId === empresaId || k.indexOf('_' + empresaId) !== -1 || k.endsWith(empresaId)) {
                    var nota = parseInt(a.nota, 10) || 0;
                    if (nota < 1) nota = 0;
                    if (nota > 5) nota = 5;
                    total += nota;
                    qtd++;
                }
            });
        } catch (e) {}
        // Também lista por empresa, se existir
        try {
            const lista = JSON.parse(localStorage.getItem('cd_avaliacoes_lista_' + empresaId) || '[]');
            if (Array.isArray(lista) && lista.length && qtd === 0) {
                lista.forEach(function (a) {
                    var nota = parseInt(a.nota, 10) || 0;
                    if (nota < 1) nota = 0;
                    if (nota > 5) nota = 5;
                    total += nota;
                    qtd++;
                });
            }
        } catch (e2) {}
        // Compatível: nunca mais estrelas do que qtd * 5
        var max = qtd * 5;
        if (qtd > 0 && total > max) total = max;
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
            var qtd = r.total || 0;
            var soma = r.soma || 0;
            var max = qtd * 5;
            if (qtd > 0 && soma > max) soma = max;
            return {
                total: soma,
                qtd: qtd,
                media: r.media || (qtd ? soma / qtd : 0)
            };
        }
        return estrelasEmpresaLocal(empresaId);
    }

    function statusVisivel(st) {
        st = String(st || '').toLowerCase();
        return st === 'ativo' || st === 'aviso' || st === 'pago' || st === 'aprovado' || st === 'publicado' || st === '';
    }

    /**
     * Lista empresas para o ranking.
     * Une: lista opcional (Firestore) + EmpresasDados local.
     * Sem isso a home ficava só com o mapa local e os IDs não batiam com o Supabase.
     */
    function listarEmpresas(listaExtra) {
        var mapa = {};
        function add(e) {
            if (!e || !e.id || e.publico) return;
            if (!statusVisivel(e.status) && !e.aprovadoEm) return;
            var id = String(e.id);
            if (!mapa[id]) mapa[id] = e;
            else {
                // prefere quem tem nome/whatsapp mais completo
                var cur = mapa[id];
                if ((!cur.nome || cur.nome.length < 2) && e.nome) mapa[id] = e;
            }
        }
        if (Array.isArray(listaExtra)) listaExtra.forEach(add);
        try {
            if (window.EmpresasDados && EmpresasDados.seedSeVazio) {
                EmpresasDados.seedSeVazio().forEach(add);
            }
        } catch (e) {}
        try {
            var local = JSON.parse(localStorage.getItem('cd_lojistas') || '[]');
            if (Array.isArray(local)) local.forEach(add);
        } catch (e) {}
        return Object.keys(mapa).map(function (k) { return mapa[k]; });
    }

    /**
     * Top N por categoria.
     * Se mapaNuvem for passado, usa dados da nuvem; senão usa só localStorage.
     */
    function topPorCategoria(limite, mapaNuvem, listaExtra) {
        limite = limite || 10;
        const empresas = listarEmpresas(listaExtra).map(function (e) {
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

    /** Ofertas: só promoções reais publicadas pelos anunciantes (sem preencher com ranking) */
    function ofertasPorSetor(limitePorSetor, mapaNuvem, listaExtra) {
        limitePorSetor = limitePorSetor || 6;
        let promos = [];
        try {
            promos = JSON.parse(localStorage.getItem('cd_promocoes') || '[]');
        } catch (e) {}
        var agora = Date.now();
        promos = promos.filter(function (p) {
            if (!p || !p.empresaId) return false;
            if (p.fim) {
                var fim = new Date(p.fim).getTime();
                if (!isNaN(fim) && fim < agora) return false;
            }
            return true;
        });
        if (!promos.length) return [];

        const empresas = listarEmpresas(listaExtra);
        const porId = {};
        empresas.forEach(function (e) { if (e && e.id) porId[String(e.id)] = e; });

        const porCat = {};
        promos.forEach(function (p) {
            var emp = porId[String(p.empresaId)];
            if (!emp) return;
            var catId = String(emp.categoria || 'outros').toLowerCase();
            var catMeta = CATEGORIAS.find(function (c) { return c.id === catId; }) || { id: catId, nome: catId, icone: 'fa-store' };
            if (!porCat[catId]) porCat[catId] = { categoria: catMeta, ofertas: [] };
            if (porCat[catId].ofertas.length >= limitePorSetor) return;
            porCat[catId].ofertas.push({
                titulo: p.titulo || 'Promoção',
                texto: p.texto || p.descricao || '',
                empresa: emp.nome,
                empresaId: emp.id,
                whatsapp: emp.whatsapp || '',
                selo: '',
                estrelas: (estrelasEmpresa(emp.id, mapaNuvem) || {}).total || 0
            });
        });
        return Object.keys(porCat).map(function (k) { return porCat[k]; }).filter(function (b) { return b.ofertas.length > 0; });
    }

    /**
     * Renderiza a home.
     * Busca avaliacoes_resumo no Supabase e só então monta os cards.
     * Fallback automático para localStorage se a nuvem falhar.
     */
    function renderOfertasNaHome(containerId, listaEmpresas) {
        const el = document.getElementById(containerId || 'ofertasPorSetor');
        if (!el) return;

        function pintar(mapaNuvem, listaExtra) {
            const blocos = ofertasPorSetor(3, mapaNuvem || {}, listaExtra);
            if (!blocos.length) {
                el.innerHTML = '<p class="text-center text-gray-400 text-sm">Nenhuma promoção publicada no momento.</p>';
                return;
            }

            el.innerHTML = blocos.map(function (b) {
                const cards = b.ofertas.map(function (o) {
                    const wa = o.whatsapp
                        ? 'https://wa.me/55' + String(o.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent('Olá! Vi a promoção no Compre Diamantino')
                        : '';
                    var empUrl = 'empresa.html?id=' + encodeURIComponent(o.empresaId);
                    return (
                        '<a href="' + empUrl + '" class="block bg-white rounded-xl px-4 py-3 border border-gray-100 hover:border-gray-200 transition">' +
                        '<p class="font-medium text-gray-800 text-sm">' + (o.empresa || o.titulo) + '</p>' +
                        (o.texto ? '<p class="text-xs text-gray-500 mt-0.5 line-clamp-2">' + o.texto + '</p>' : '') +
                        '<p class="text-xs text-primary mt-1">Ver empresa' + (wa ? ' · WhatsApp' : '') + '</p>' +
                        '</a>'
                    );
                }).join('');

                return (
                    '<div class="mb-5">' +
                    '<p class="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">' + b.categoria.nome + '</p>' +
                    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' + cards + '</div>' +
                    '</div>'
                );
            }).join('');
        }

        // Mostra loading leve enquanto busca
        if (!el.dataset.rankingLoading) {
            el.dataset.rankingLoading = '1';
            // mantém conteúdo atual ou placeholder
        }

        function carregarListaEPintar(mapa) {
            // Se o caller já passou a lista (ex.: index após LojistasNuvem.puxar), usa ela
            if (Array.isArray(listaEmpresas) && listaEmpresas.length) {
                el.dataset.rankingLoading = '';
                pintar(mapa, listaEmpresas);
                return;
            }
            // Tenta puxar da nuvem (Firestore) para bater o mesmo ID do voto
            if (window.LojistasNuvem && typeof LojistasNuvem.puxar === 'function') {
                try {
                    var p = LojistasNuvem.puxar(function (lista) {
                        el.dataset.rankingLoading = '';
                        pintar(mapa, lista || []);
                    });
                    if (p && typeof p.catch === 'function') {
                        p.catch(function () {
                            el.dataset.rankingLoading = '';
                            pintar(mapa, []);
                        });
                    }
                    // timeout de segurança
                    setTimeout(function () {
                        if (el.dataset.rankingLoading === '1') {
                            el.dataset.rankingLoading = '';
                            pintar(mapa, []);
                        }
                    }, 4000);
                    return;
                } catch (e) {}
            }
            el.dataset.rankingLoading = '';
            pintar(mapa, []);
        }

        carregarResumoNuvem()
            .then(function (mapa) {
                carregarListaEPintar(mapa);
            })
            .catch(function () {
                carregarListaEPintar({});
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
