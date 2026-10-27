/**
 * Empresas + localização — modelo células IBN
 * Centro de Diamantino-MT (área urbana, não zona rural)
 */
(function (global) {
    const STORAGE_KEY = 'cd_empresas_mapa';
    const COORDS_KEY = 'cd_empresas_coords';
    const SEED_VER = 'cd_seed_v7'; // v6 oficial: só serviços públicos + lojistas reais

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

    /**
     * Serviços públicos oficiais de Diamantino-MT.
     * Fontes: pm.mt.gov.br, diamantino.mt.gov.br, CNES.
     * Coordenadas aproximadas no perímetro urbano — o gestor deve ajustar o pin no mapa
     * com o link do Google Maps real de cada unidade antes de publicar.
     * NÃO incluir: Corpo de Bombeiros (unidade em construção, ainda sem sede operacional).
     * NÃO incluir postos de combustível (particulares).
     */
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
                telefone: '(65) 3336-6400',
                endereco: 'Rua Desembargador Joaquim Pereira Ferreira Mendes, 2287 — Jardim Eldorado — Diamantino-MT',
                lat: -14.4086, lng: -56.4462
            },
            {
                id: 'pub-camara',
                nome: 'Câmara Municipal de Diamantino',
                categoria: 'servicos-publicos',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                endereco: 'Diamantino-MT',
                lat: -14.4090, lng: -56.4458
            },
            {
                id: 'pub-hospital',
                nome: 'Hospital Municipal São João Batista',
                categoria: 'saude',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                telefone: '(65) 3336-1221',
                endereco: 'Avenida Municipal, 1501 — Centro — Diamantino-MT',
                lat: -14.4095, lng: -56.4450
            },
            {
                id: 'pub-samu',
                nome: 'SAMU 192 — Base Diamantino',
                categoria: 'saude',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                telefone: '192 / (65) 99993-9372 / (65) 3317-3200',
                endereco: 'Centro Integrado de Saúde (CIS) — Av. Irmão Miguel Abib — Jardim Eldorado — Diamantino-MT',
                lat: -14.4080, lng: -56.4475
            },
            {
                id: 'pub-policia',
                nome: '9ª CIPM — Polícia Militar de Diamantino',
                categoria: 'servicos-publicos',
                plano: 'publico',
                status: 'ativo',
                publico: true,
                telefone: '(65) 3336-2190',
                endereco: 'Rua das Orquídeas, nº 24 — Jardim Eldorado — Diamantino-MT',
                // Pin aproximado no Jardim Eldorado; ajustar com o Maps real do quartel
                lat: -14.4075, lng: -56.4485
            }
        ];
    }


    function seedSeVazio() {
        const ver = localStorage.getItem(SEED_VER);
        let lista = lerEmpresas();

        // Oficial: serviços públicos + lojistas reais (remove seeds de comércio demo)
        if (ver !== 'v7') {
            const reais = lista.filter(e => !e.publico && e.id && !String(e.id).startsWith('pub-') && !['lj001','lj002','lj003','lj004','lj005','demo001','pub-bombeiros','pub-posto1','pub-posto2'].includes(String(e.id)));
            lista = seedPublicos().concat(reais);
            salvarEmpresas(lista);
            localStorage.setItem(SEED_VER, 'v7');
            localStorage.removeItem(COORDS_KEY); // limpa coords antigas no mato
            return lista;
        }

        if (!lista.length) {
            lista = seedPublicos();
            salvarEmpresas(lista);
            localStorage.setItem(SEED_VER, 'v7');
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
