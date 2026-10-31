/**
 * Cloudflare R2 — upload de fotos (Compre Diamantino)
 * Mesmo esquema S3/AWS4 do IBN: arquivo no R2, no Firestore/local só a URL pública.
 *
 * Configure R2_CONFIG em firebase-config.js (conta Cloudflare do portal, NÃO a do IBN).
 */
(function (global) {
    function r2Ativo() {
        return typeof R2_CONFIG !== 'undefined' &&
            R2_CONFIG &&
            R2_CONFIG.accessKeyId &&
            R2_CONFIG.secretAccessKey &&
            R2_CONFIG.bucket &&
            R2_CONFIG.publicBase &&
            R2_CONFIG.accountId;
    }

    function _r2ToHex(buf) {
        return Array.from(new Uint8Array(buf)).map(function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    async function _r2Hmac(key, data) {
        var enc = new TextEncoder();
        var cryptoKey = await crypto.subtle.importKey(
            'raw',
            typeof key === 'string' ? enc.encode(key) : key,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        return crypto.subtle.sign('HMAC', cryptoKey, typeof data === 'string' ? enc.encode(data) : data);
    }

    async function _r2Sha256(data) {
        var enc = new TextEncoder();
        var buf = typeof data === 'string' ? enc.encode(data) : data;
        return crypto.subtle.digest('SHA-256', buf);
    }

    async function _r2GetSignatureKey(secret, dateStamp, region, service) {
        var kDate = await _r2Hmac('AWS4' + secret, dateStamp);
        var kRegion = await _r2Hmac(kDate, region);
        var kService = await _r2Hmac(kRegion, service);
        return _r2Hmac(kService, 'aws4_request');
    }

    /** data:URL → Blob */
    function dataUrlParaBlob(dataUrl) {
        var parts = String(dataUrl).split(',');
        var meta = parts[0] || '';
        var b64 = parts[1] || '';
        var mime = 'image/jpeg';
        var m = meta.match(/data:([^;]+)/);
        if (m) mime = m[1];
        var bin = atob(b64);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
    }

    /**
     * Sobe Blob/File para o R2 e devolve URL pública.
     * key ex.: lojistas/lj123/logo.jpg  ou  lojistas/lj123/foto-0.jpg
     */
    async function uploadParaR2(blob, key, contentType) {
        if (!r2Ativo()) throw new Error('R2 não configurado (preencha R2_CONFIG em firebase-config.js)');
        if (!blob) throw new Error('Sem arquivo para enviar ao R2');
        contentType = contentType || blob.type || 'image/jpeg';
        key = String(key || '').replace(/^\/+/, '');
        if (!key) throw new Error('Chave R2 vazia');

        var cfg = R2_CONFIG;
        var method = 'PUT';
        var service = 's3';
        var region = 'auto';
        var host = cfg.accountId + '.r2.cloudflarestorage.com';
        var canonicalUri = '/' + cfg.bucket + '/' + key.split('/').map(encodeURIComponent).join('/');
        var now = new Date();
        var amzDate =
            now.getUTCFullYear().toString() +
            String(now.getUTCMonth() + 1).padStart(2, '0') +
            String(now.getUTCDate()).padStart(2, '0') + 'T' +
            String(now.getUTCHours()).padStart(2, '0') +
            String(now.getUTCMinutes()).padStart(2, '0') +
            String(now.getUTCSeconds()).padStart(2, '0') + 'Z';
        var dateStamp = amzDate.slice(0, 8);

        var payloadHash = _r2ToHex(await _r2Sha256(await blob.arrayBuffer()));
        var canonicalHeaders =
            'content-type:' + contentType + '\n' +
            'host:' + host + '\n' +
            'x-amz-content-sha256:' + payloadHash + '\n' +
            'x-amz-date:' + amzDate + '\n';
        var signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
        var canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
        var credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
        var stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, _r2ToHex(await _r2Sha256(canonicalRequest))].join('\n');
        var signingKey = await _r2GetSignatureKey(cfg.secretAccessKey, dateStamp, region, service);
        var signature = _r2ToHex(await _r2Hmac(signingKey, stringToSign));
        var authorization =
            'AWS4-HMAC-SHA256 Credential=' + cfg.accessKeyId + '/' + credentialScope +
            ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

        var url = 'https://' + host + canonicalUri;
        var resp = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': contentType,
                'x-amz-content-sha256': payloadHash,
                'x-amz-date': amzDate,
                'Authorization': authorization
            },
            body: blob
        });
        if (!resp.ok) {
            var txt = '';
            try { txt = await resp.text(); } catch (e) {}
            throw new Error('Falha R2 (' + resp.status + '): ' + (txt || resp.statusText).slice(0, 200));
        }
        return String(cfg.publicBase).replace(/\/$/, '') + '/' + key;
    }

    /** data:URL ou Blob → sobe e devolve URL (ou devolve data:URL se R2 off) */
    async function uploadImagemFlex(dataOuBlob, keyPrefix) {
        keyPrefix = String(keyPrefix || 'lojistas/temp').replace(/\/$/, '');
        var blob = null;
        var ct = 'image/jpeg';
        if (typeof dataOuBlob === 'string' && dataOuBlob.indexOf('data:') === 0) {
            blob = dataUrlParaBlob(dataOuBlob);
            ct = blob.type || ct;
        } else if (dataOuBlob instanceof Blob) {
            blob = dataOuBlob;
            ct = blob.type || ct;
        } else if (dataOuBlob && dataOuBlob.arrayBuffer) {
            blob = dataOuBlob;
            ct = blob.type || ct;
        } else {
            return '';
        }
        if (!r2Ativo()) {
            // Fallback: mantém data URL (local / sem bucket ainda)
            if (typeof dataOuBlob === 'string' && dataOuBlob.indexOf('data:') === 0) return dataOuBlob;
            return new Promise(function (resolve) {
                var fr = new FileReader();
                fr.onload = function () { resolve(String(fr.result || '')); };
                fr.onerror = function () { resolve(''); };
                fr.readAsDataURL(blob);
            });
        }
        var ext = (ct.indexOf('png') >= 0) ? 'png' : 'jpg';
        var key = keyPrefix + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        return uploadParaR2(blob, key, ct);
    }

    /** Sobe várias data:URLs; devolve array de URLs públicas (ou data: se R2 off) */
    async function uploadListaImagens(lista, keyPrefix) {
        var out = [];
        var arr = Array.isArray(lista) ? lista : [];
        for (var i = 0; i < arr.length; i++) {
            if (!arr[i]) continue;
            try {
                out.push(await uploadImagemFlex(arr[i], keyPrefix));
            } catch (e) {
                console.warn('R2 item falhou, mantém local', e);
                out.push(arr[i]);
            }
        }
        return out;
    }

    global.CDR2 = {
        ativo: r2Ativo,
        uploadParaR2: uploadParaR2,
        dataUrlParaBlob: dataUrlParaBlob,
        uploadImagemFlex: uploadImagemFlex,
        uploadListaImagens: uploadListaImagens
    };
})(window);
