/**
 * Empresas + localização — modelo células IBN
 * Centro de Diamantino-MT (área urbana, não zona rural)
 */
(function (global) {
    const STORAGE_KEY = 'cd_empresas_mapa';
    const COORDS_KEY = 'cd_empresas_coords';
    const SEED_VER = 'cd_seed_v3'; // sobe versão = recria seeds com coords certas

    // Centro urbano Diamantino-MT (referência IBN / área da cidade)
    const CENTER = { lat: -14.4089, lng: -56.4458 };

    function lerEmpresas() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
        catch { return []; }
    }

    function salvarEmpresas(lista) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    }

    function lerCoordsSalvas() {
        try { return JSON.parse(localStorage.getItem(COORDS_KEY) || '{}'); }
        catch { return {}; }
    }

    function salvarCoord(id, lat, lng) {
        const salvas = lerCoordsSalvas();
        salvas[id] = { lat: lat, lng: lng, real: true, atualizadoEm: new Date().toISOString() };
        localStorage.setItem(COORDS_KEY, JSON.stringify(salvas));
        const lista = lerEmpresas();
        const i = lista.findIndex(e => e.id === id);
        if (i >= 0) {
            lista[i].lat = lat;
            lista[i].lng = lng;
            salvarEmpresas(lista);
        }
        return lista[i] || null;
    }

    function extrairCoords(texto) {
        if (!texto) return null;
        const t = String(texto).trim();
        let m = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
        m = t.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
        m = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
        m = t.match(/(-?\d+\.\d+)\s*[,;\s]\s*(-?\d+\.\d+)/);
        if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
        return null;
    }

    /** Cadastro automático: serviços públicos, postos, saúde (Diamantino) */
    function seedPublicos() {
        return [
            {
                id: 'pub-prefeitura',
                nome: 'Prefeitura Municipal de Diamantino',
                categoria: 'servicos-publicos',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                whatsapp: '',
                endereco: 'Centro — Diamantino-MT',
                lat: -14.4086, lng: -56.4462
            },
            {
                id: 'pub-camara',
                nome: 'Câmara Municipal de Diamantino',
                categoria: 'servicos-publicos',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                endereco: 'Centro — Diamantino-MT',
                lat: -14.4092, lng: -56.4455
            },
            {
                id: 'pub-hospital',
                nome: 'Hospital Municipal de Diamantino',
                categoria: 'saude',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                endereco: 'Diamantino-MT',
                lat: -14.4105, lng: -56.4440
            },
            {
                id: 'pub-ubs-centro',
                nome: 'UBS Centro',
                categoria: 'saude',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                endereco: 'Centro — Diamantino-MT',
                lat: -14.4078, lng: -56.4470
            },
            {
                id: 'pub-posto1',
                nome: 'Posto de Combustível (Centro)',
                categoria: 'posto',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                endereco: 'Centro — Diamantino-MT',
                lat: -14.4070, lng: -56.4445
            },
            {
                id: 'pub-posto2',
                nome: 'Posto de Combustível (Av. principal)',
                categoria: 'posto',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                endereco: 'Diamantino-MT',
                lat: -14.4110, lng: -56.4480
            },
            {
                id: 'pub-bombeiros',
                nome: 'Corpo de Bombeiros',
                categoria: 'servicos-publicos',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                endereco: 'Diamantino-MT',
                lat: -14.4098, lng: -56.4435
            },
            {
                id: 'pub-policia',
                nome: 'Polícia Militar',
                categoria: 'servicos-publicos',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                endereco: 'Diamantino-MT',
                lat: -14.4080, lng: -56.4450
            }
        ];
    }

    function seedComercioDemo() {
        return [
            {
                id: 'lj001',
                nome: 'Padaria do Centro',
                categoria: 'alimentacao',
                plano: 'premium',
                status: 'ativo',
                whatsapp: '65999991111',
                endereco: 'Centro — Diamantino-MT',
                lat: -14.4084, lng: -56.4465
            },
            {
                id: 'lj002',
                nome: 'Auto Peças Diamantino',
                categoria: 'automotivo',
                plano: 'destaque',
                status: 'ativo',
                whatsapp: '65999992222',
                endereco: 'Diamantino-MT',
                lat: -14.4100, lng: -56.4475
            },
            {
                id: 'lj003',
                nome: 'Beleza & Estilo',
                categoria: 'saude',
                plano: 'basico',
                status: 'ativo',
                whatsapp: '65999993333',
                endereco: 'Centro — Diamantino-MT',
                lat: -14.4075, lng: -56.4452
            }
        ];
    }

    function seedSeVazio() {
        const ver = localStorage.getItem(SEED_VER);
        let lista = lerEmpresas();

        // Nova versão de coords: reconstrói seeds públicos + demo (mantém lojistas reais)
        if (ver !== 'v3') {
            const reais = lista.filter(e => !e.publico && e.id && !String(e.id).startsWith('lj00') && !String(e.id).startsWith('pub-'));
            lista = seedPublicos().concat(seedComercioDemo()).concat(reais);
            salvarEmpresas(lista);
            localStorage.setItem(SEED_VER, 'v3');
            localStorage.removeItem(COORDS_KEY); // limpa coords antigas no mato
            return lista;
        }

        if (!lista.length) {
            lista = seedPublicos().concat(seedComercioDemo());
            salvarEmpresas(lista);
            localStorage.setItem(SEED_VER, 'v3');
        }
        return lista;
    }

    function empresasNoMapa() {
        const salvas = lerCoordsSalvas();
        return seedSeVazio()
            .filter(e => e.status === 'ativo' || e.status === 'aviso')
            .map(e => {
                const c = salvas[e.id];
                return {
                    ...e,
                    lat: (c && typeof c.lat === 'number') ? c.lat : (typeof e.lat === 'number' ? e.lat : CENTER.lat),
                    lng: (c && typeof c.lng === 'number') ? c.lng : (typeof e.lng === 'number' ? e.lng : CENTER.lng)
                };
            });
    }

    function upsertEmpresa(dados) {
        const lista = seedSeVazio();
        const id = dados.id || ('lj' + Date.now());
        let lat = dados.lat;
        let lng = dados.lng;
        if ((lat == null || lng == null) && dados.mapsLink) {
            const c = extrairCoords(dados.mapsLink);
            if (c) { lat = c.lat; lng = c.lng; }
        }
        if (lat == null) lat = CENTER.lat;
        if (lng == null) lng = CENTER.lng;

        const idx = lista.findIndex(e => e.id === id);
        const reg = {
            id,
            nome: dados.nome || 'Empresa',
            categoria: dados.categoria || 'outros',
            plano: dados.plano || 'basico',
            status: dados.status || 'pendente',
            whatsapp: dados.whatsapp || '',
            endereco: dados.endereco || 'Diamantino-MT',
            mapsLink: dados.mapsLink || '',
            publico: !!dados.publico,
            lat, lng,
            atualizadoEm: new Date().toISOString()
        };
        if (idx >= 0) lista[idx] = { ...lista[idx], ...reg };
        else lista.push(reg);
        salvarEmpresas(lista);
        if (reg.status === 'ativo' || reg.status === 'aviso') salvarCoord(id, lat, lng);
        return reg;
    }

    function atualizarStatus(id, status) {
        const lista = lerEmpresas();
        const i = lista.findIndex(e => e.id === id);
        if (i < 0) return null;
        lista[i].status = status;
        salvarEmpresas(lista);
        return lista[i];
    }

    function distanciaKm(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function linkComoChegar(lat, lng, origem) {
        const dest = lat + ',' + lng;
        if (origem && origem.lat && origem.lng) {
            return 'https://www.google.com/maps/dir/?api=1&origin=' + origem.lat + ',' + origem.lng +
                '&destination=' + dest + '&travelmode=driving';
        }
        return 'https://www.google.com/maps/dir/?api=1&destination=' + dest;
    }

    global.EmpresasDados = {
        CENTER,
        lerEmpresas,
        salvarEmpresas,
        empresasNoMapa,
        upsertEmpresa,
        atualizarStatus,
        salvarCoord,
        extrairCoords,
        distanciaKm,
        linkComoChegar,
        seedSeVazio,
        seedPublicos
    };
})(window);
