/**
 * EXEMPLO — Firebase Cloud Function
 * Lê pushFila (pendente) e envia via FCM HTTP v1.
 *
 * Deploy (resumo):
 *   npm install -g firebase-tools
 *   firebase init functions
 *   // cole esta lógica no index.js
 *   firebase deploy --only functions
 *
 * A function precisa de conta de serviço com permissão Firebase Cloud Messaging API.
 */
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();

exports.processarPushFila = async (req, res) => {
  const db = admin.firestore();
  const snap = await db.collection('pushFila').where('status', '==', 'pendente').limit(20).get();
  if (snap.empty) {
    if (res) res.json({ ok: true, enviados: 0 });
    return { enviados: 0 };
  }

  let enviados = 0;
  for (const doc of snap.docs) {
    const item = doc.data();
    let q = db.collection('pushTokens').where('ativo', '==', true);
    if (item.destino === 'gestor' || item.destino === 'lojista') {
      q = q.where('role', '==', item.destino);
    }
    if (item.lojistaId) {
      q = q.where('lojistaId', '==', item.lojistaId);
    }
    const tokensSnap = await q.get();
    const tokens = [];
    tokensSnap.forEach(t => {
      const tok = t.data().token;
      if (tok) tokens.push(tok);
    });

    if (tokens.length) {
      const message = {
        tokens,
        notification: {
          title: item.title || 'Compre Diamantino',
          body: item.body || ''
        },
        data: {
          url: String(item.url || './gestor-hub.html'),
          tipo: String(item.tipo || ''),
          id: String(item.id || doc.id),
          badge: String(item.badge != null ? item.badge : 1)
        },
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            icon: '/icon-192.png',
            badge: '/icon-192.png'
          },
          fcmOptions: {
            link: item.url || 'https://comprediamantino.com.br/gestor-hub.html'
          }
        }
      };
      try {
        await admin.messaging().sendEachForMulticast(message);
        enviados += tokens.length;
      } catch (e) {
        console.error('FCM', e);
      }
    }
    await doc.ref.set({ status: 'enviado', enviadoEm: new Date().toISOString() }, { merge: true });
  }
  if (res) res.json({ ok: true, enviados });
  return { enviados };
};

// Agendar a cada 1–2 min com Cloud Scheduler + HTTP function, ou onCreate em pushFila
