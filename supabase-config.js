/**
 * Supabase — Compre Diamantino (avaliações)
 * Projeto: vqjuwnryvgtnctacikl (sa-east-1)
 */
window.CD_SUPABASE = {
  url: 'https://vqjuwnryvgtnctacikl.supabase.co',
  anonKey: 'sb_publishable_g55E6A3GZiS1UC0GoHhwlw_AkJn_Vfu'
};

window.cdSupabaseReady = function () {
  var c = window.CD_SUPABASE || {};
  return !!(c.url && c.anonKey && String(c.url).indexOf('http') === 0);
};
