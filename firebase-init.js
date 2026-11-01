/** Carrega status da nuvem no painel do gestor */
(function () {
    function statusEl() {
        return document.getElementById('firebaseStatus');
    }

    function setStatus(ok, msg) {
        const el = statusEl();
        if (!el) return;
        el.className = ok
            ? 'bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm mb-4'
            : 'bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm mb-4';
        el.innerHTML = msg;
    }

    window.CD_checarNuvem = function () {
        if (typeof firebase === 'undefined') {
            setStatus(false, '<i class="fas fa-cloud"></i> Firebase SDK não carregou. Verifique a internet.');
            return;
        }
        try {
            if (window.iniciarFirebase) iniciarFirebase();
            const db = window.cdDb;
            if (!db) {
                setStatus(false, 'Firestore não inicializado.');
                return;
            }
            db.collection('_sistema').doc('ping').set({
                ok: true,
                em: new Date().toISOString(),
                origem: 'gestor'
            }, { merge: true }).then(function () {
                setStatus(true, '<i class="fas fa-check-circle"></i> <strong>Nuvem conectada</strong> — projeto <code>compre-diamantino-8faaa</code>. Banco pronto para o gestor.');
            }).catch(function (err) {
                var msg = (err && err.message) || String(err);
                var quota = /resource-exhausted|quota|Quota exceeded/i.test(msg + ' ' + ((err && err.code) || ''));
                if (quota) {
                    setStatus(false, '<i class="fas fa-exclamation-triangle"></i> <strong>Cota do Firebase esgotada hoje.</strong> Dados e leituras excedidos. Tente mais tarde ou amanhã (renova à meia-noite).');
                } else {
                    setStatus(false, '<i class="fas fa-exclamation-triangle"></i> Config ok, mas Firestore ainda não liberou gravação. Crie o banco no console (modo teste) e regras abertas. <br><small>' + msg + '</small>');
                }
            });
        } catch (e) {
            setStatus(false, 'Erro: ' + e.message);
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        if (statusEl()) {
            if (window.iniciarFirebase) iniciarFirebase();
            setTimeout(function () { window.CD_checarNuvem && CD_checarNuvem(); }, 800);
        }
    });
})();
