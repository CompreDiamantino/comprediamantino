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
// Cloudflare R2 — fotos do comércio
// Bucket: compre-diamantino-fotos
// ==============================================
var R2_CONFIG = {
    accountId: 'db4914772d06ef519934b86207ce0754',
    accessKeyId: '3246bef85a7ad6f39aeecee2662f1b14',
    secretAccessKey: '4ae094e5c5f62830684cd5688b30b77c3002f573cbdedc0b53bd5ae46d7b5361',
    bucket: 'compre-diamantino-fotos',
    publicBase: 'https://pub-de27f61055094a509457476bc5543f5f.r2.dev',
    endpoint: 'https://db4914772d06ef519934b86207ce0754.r2.cloudflarestorage.com'
};
