// Google Maps — Compre Diamantino
// Uma única chave para todo o site (empresa.html, mapa.html, admin Places, etc.).
//
// Google Cloud Console → APIs e serviços:
// 1) Ative: "Maps JavaScript API"
// 2) Ative: "Places API" (obrigatório para busca "Do Google Maps" no painel do gestor)
// 3) Cobrança (billing) precisa estar vinculada ao projeto — senão o mapa falha.
// 4) Credenciais → restrição de chave (HTTP referrers), exemplos:
//      https://comprediamantino.com.br/*
//      http://comprediamantino.com.br/*
//      https://www.comprediamantino.com.br/*
//      http://www.comprediamantino.com.br/*
//      https://*.github.io/*
//      http://localhost/*
//      http://127.0.0.1/*
//    Se testar pelo IP do celular ou domínio diferente, inclua esse host também.
// 5) Não é bloqueio por cidade. O centro padrão é só o pin inicial.
//
window.CD_MAPS_KEY = 'AIzaSyA_fSHOlP0T6kztVAvMES3XM1KeUZJlj4A';
window.CD_MAPS_CENTER = { lat: -14.4089, lng: -56.4458 }; // Diamantino-MT
