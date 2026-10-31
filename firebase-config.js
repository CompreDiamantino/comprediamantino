/**
 * Firebase — Compre Diamantino
 * Projeto: compre-diamantino-8faaa
 * Usa SDK compat (igual IBN) para funcionar em HTML simples
 */
(function (global) {
    const firebaseConfig = {
        apiKey: "AIzaSyBC3Je0xUYqkJrNSSpuf2lua_ETQgzLR-s",
        authDomain: "compre-diamantino-8faaa.firebaseapp.com",
        projectId: "compre-diamantino-8faaa",
        storageBucket: "compre-diamantino-8faaa.firebasestorage.app",
        messagingSenderId: "784242274264",
        appId: "1:784242274264:web:9960afe5f67b40723e0cad"
    };

    global.CD_FIREBASE_CONFIG = firebaseConfig;

    function iniciarFirebase() {
        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK ainda não carregou');
            return null;
        }
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        global.cdAuth = firebase.auth();
        global.cdDb = firebase.firestore();
        try {
            global.cdStorage = firebase.storage();
        } catch (e) {
            global.cdStorage = null;
        }
        return firebase.app();
    }

    global.iniciarFirebase = iniciarFirebase;
})(window);

// ==============================================
// Cloudflare R2 — fotos do comércio (logo, vitrine, posts)
// Crie um bucket NOVO para o Compre Diamantino (não use o do IBN).
// Enquanto accessKeyId estiver vazio, as fotos ficam só no aparelho (data URL).
// Guia: NUVEM-R2.txt
// ==============================================
var R2_CONFIG = {
    accountId: '',           // Cloudflare → R2 → Overview (Account ID)
    accessKeyId: '',         // R2 → Manage R2 API Tokens → Access Key ID
    secretAccessKey: '',     // Secret Access Key (guarde com cuidado)
    bucket: '',              // ex.: compre-diamantino-fotos
    publicBase: '',          // ex.: https://pub-xxxx.r2.dev  (R2 → bucket → Settings → Public access)
    endpoint: ''             // opcional; o upload monta com accountId
};
