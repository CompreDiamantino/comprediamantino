/**
 * Firebase — Compre Diamantino
 * Projeto: compre-diamantino-96a25
 * Usa SDK compat (igual IBN) para funcionar em HTML simples
 */
(function (global) {
    const firebaseConfig = {
        apiKey: "AIzaSyDFR2E-0TWEwpXZVCtccuSMzoYHuZWTSRC",
        authDomain: "compre-diamantino-96a25.firebaseapp.com",
        projectId: "compre-diamantino-96a25",
        storageBucket: "compre-diamantino-96a25.firebasestorage.app",
        messagingSenderId: "312234081767",
        appId: "1:312234081767:web:ce922145b689f50f06d142"
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
        try {
            global.cdAuth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
        } catch (e) {
            global.cdAuth = null;
        }
        global.cdDb = firebase.firestore();
        try {
            global.cdStorage = (typeof firebase.storage === 'function') ? firebase.storage() : null;
        } catch (e) {
            global.cdStorage = null;
        }
        return firebase.app();
    }

    global.iniciarFirebase = iniciarFirebase;
})(typeof window !== 'undefined' ? window : this);
