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
