/**
 * Contador de avaliações → % de desconto na mensalidade
 * Só o GESTOR vê e aplica.
 *
 * "Estrelas" = soma dos pontos (ex.: uma nota 5 = 5 estrelas)
 * Desconto começa a partir de 500 estrelas.
 * Quem vota: visitantes do site e outros anunciantes (1x por mês por celular, por loja).
 */
(function (global) {
    // Faixas: a partir de X estrelas → Y% de desconto
    const FAIXAS = [
        { min: 500,   pct: 5,   label: '500 estrelas' },
        { min: 1000,  pct: 10,  label: '1.000 estrelas' },
        { min: 2000,  pct: 15,  label: '2.000 estrelas' },
        { min: 3500,  pct: 25,  label: '3.500 estrelas' },
        { min: 5000,  pct: 40,  label: '5.000 estrelas' },
        { min: 8000,  pct: 60,  label: '8.000 estrelas' },
        { min: 12000, pct: 80,  label: '12.000 estrelas' },
        { min: 15000, pct: 100, label: '15.000 estrelas' }
    ];

    function somarEstrelas(avaliacoes) {
        if (!Array.isArray(avaliacoes)) return 0;
        return avaliacoes.reduce((acc, a) => acc + (parseInt(a.nota, 10) || 0), 0);
    }

    function calcularDesconto(totalEstrelas) {
        let melhor = { min: 0, pct: 0, label: 'Sem desconto ainda (mín. 500 estrelas)' };
        for (const f of FAIXAS) {
            if (totalEstrelas >= f.min) melhor = f;
        }
        return {
            totalEstrelas: totalEstrelas || 0,
            pct: melhor.pct,
            faixa: melhor.label,
            proxima: FAIXAS.find(f => f.min > (totalEstrelas || 0)) || null
        };
    }

    function resumoTexto(totalEstrelas) {
        const r = calcularDesconto(totalEstrelas);
        let t = r.totalEstrelas + ' estrelas → ' + r.pct + '% de desconto';
        if (r.proxima) {
            const falta = r.proxima.min - r.totalEstrelas;
            t += ' (faltam ' + falta + ' para ' + r.proxima.pct + '%)';
        }
        return t;
    }

    global.DescontosEstrelas = {
        FAIXAS,
        somarEstrelas,
        calcularDesconto,
        resumoTexto
    };
})(window);
