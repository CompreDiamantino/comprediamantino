/**
 * Contador de avaliações → % de desconto na mensalidade
 * Só o GESTOR vê e aplica. Pode valer já na semana grátis (próxima cobrança).
 *
 * "Estrelas" = soma dos pontos (ex.: uma nota 5 = 5 estrelas)
 * Cada pessoa só vota 1x na mesma empresa a cada 30 dias.
 */
(function (global) {
    // Faixas: a partir de X pontos de estrela → Y% de desconto
    const FAIXAS = [
        { min: 15000, pct: 100, label: '15.000+ estrelas' }
    ];

    /**
     * Calcula total de pontos de estrela a partir da lista de avaliações
     * Cada avaliação contribui com sua nota (1 a 5).
     */
    function somarEstrelas(avaliacoes) {
        if (!Array.isArray(avaliacoes)) return 0;
        return avaliacoes.reduce((acc, a) => acc + (parseInt(a.nota, 10) || 0), 0);
    }

    /**
     * Retorna o % de desconto sugerido e a faixa
     */
    function calcularDesconto(totalEstrelas) {
        let melhor = { min: 0, pct: 0, label: 'Sem desconto ainda' };
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

    /**
     * Texto amigável para o gestor
     */
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
