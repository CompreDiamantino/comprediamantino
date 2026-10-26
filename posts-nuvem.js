/**
 * Posts de lojistas — visíveis para todos
 * Firestore coleção "posts" quando cdDb existir; senão localStorage espelho
 */
(function (global) {
    const KEY = 'cd_posts_publicos';

    function lerLocal() {
        try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
        catch { return []; }
    }

    function salvarLocal(lista) {
        localStorage.setItem(KEY, JSON.stringify(lista.slice(0, 500)));
    }

    function publicar(post) {
        const item = {
            id: post.id || ('p' + Date.now()),
            empresaId: post.empresaId,
            empresaNome: post.empresaNome || '',
            categoria: post.categoria || 'outros',
            texto: post.texto || '',
            imagens: post.imagens || [],
            tipo: post.tipo || 'promocao', // promocao | produto | geral
            criadoEm: new Date().toISOString(),
            status: 'ativo'
        };
        const lista = lerLocal();
        lista.unshift(item);
        salvarLocal(lista);

        if (window.cdDb) {
            window.cdDb.collection('posts').doc(item.id).set(item).catch(function (e) {
                console.warn('Firestore posts:', e.message);
            });
        }
        if (window.NotifGestor) {
            NotifGestor.add('fotos', 'Novo post: ' + item.empresaNome,
                (item.imagens.length ? item.imagens.length + ' foto(s) · ' : '') + (item.texto || '').slice(0, 80),
                { postId: item.id, empresaId: item.empresaId });
        }
        return item;
    }

    function listarPublicos(filtroCat) {
        return lerLocal().filter(function (p) {
            if (p.status !== 'ativo') return false;
            if (filtroCat && p.categoria !== filtroCat) return false;
            return true;
        });
    }

    /** Tenta puxar do Firestore (gestor/visitante em outro aparelho) */
    function puxarNuvem(cb) {
        if (!window.cdDb) {
            if (cb) cb(lerLocal());
            return;
        }
        window.cdDb.collection('posts').orderBy('criadoEm', 'desc').limit(100).get()
            .then(function (snap) {
                const lista = [];
                snap.forEach(function (doc) {
                    lista.push(Object.assign({ id: doc.id }, doc.data()));
                });
                if (lista.length) salvarLocal(lista);
                if (cb) cb(lista.length ? lista : lerLocal());
            })
            .catch(function () {
                if (cb) cb(lerLocal());
            });
    }

    global.PostsNuvem = {
        publicar: publicar,
        listarPublicos: listarPublicos,
        puxarNuvem: puxarNuvem,
        lerLocal: lerLocal
    };
})(window);
