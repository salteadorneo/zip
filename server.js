const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { request } = require('undici');

const PORT = process.env.PORT || 3000;

// Función para seguir redirecciones manualmente
async function fetchWithRedirects(targetUrl, maxRedirects = 5) {
    let currentUrl = targetUrl;
    let redirectCount = 0;

    while (redirectCount < maxRedirects) {
        const urlObj = new URL(currentUrl);
        const refererUrl = `${urlObj.protocol}//${urlObj.hostname}/`;

        console.log(`  [Intento ${redirectCount + 1}] Fetching: ${currentUrl.substring(0, 80)}...`);

        const response = await request(currentUrl, {
            method: 'GET',
            headersTimeout: 30000,
            bodyTimeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'DNT': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Upgrade-Insecure-Requests': '1',
                'Referer': refererUrl,
                'Origin': refererUrl.replace(/\/$/, '')
            }
        });

        console.log(`  ↳ Status: ${response.statusCode}`);

        // Manejar redirecciones
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            const location = response.headers.location;
            if (!location) {
                throw new Error(`Redirect sin Location header (${response.statusCode})`);
            }
            currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString();
            redirectCount++;
            console.log(`  ↳ Redirect a: ${currentUrl.substring(0, 80)}...`);
            continue;
        }

        // Si no es redirect y no es 2xx, error
        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error(`HTTP ${response.statusCode}`);
        }

        return response;
    }

    throw new Error(`Demasiadas redirecciones (>${maxRedirects})`);
}

http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API Proxy para descargar ZIPs
    if (pathname === '/api/proxy') {
        if (!query.url) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Parámetro url requerido' }));
            return;
        }

        const targetUrl = decodeURIComponent(query.url);
        console.log(`📥 Proxy request para: ${targetUrl.substring(0, 60)}...`);

        try {
            const response = await fetchWithRedirects(targetUrl);

            // Extraer nombre del archivo de la URL
            const urlPath = new URL(targetUrl).pathname;
            const fileName = urlPath.split('/').pop() || 'archivo.zip';

            const headers = {
                'Content-Type': response.headers['content-type'] || 'application/octet-stream',
                'Cache-Control': 'public, max-age=86400',
                'Content-Disposition': `attachment; filename="${fileName}"`
            };

            if (response.headers['content-length']) {
                headers['Content-Length'] = response.headers['content-length'];
            }

            console.log(`✅ Enviando respuesta (${response.statusCode})`);
            res.writeHead(response.statusCode, headers);
            response.body.pipe(res);
        } catch (err) {
            console.error(`❌ Proxy error: ${err.message}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Servir archivos estáticos
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    const ext = path.extname(filePath);

    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.json') contentType = 'application/json';
    if (ext === '.svg') contentType = 'image/svg+xml';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Archivo no encontrado</h1>');
            } else {
                res.writeHead(500);
                res.end('Error del servidor');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}).listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
    console.log(`📡 Proxy de descargas en /api/proxy?url=...`);
});
