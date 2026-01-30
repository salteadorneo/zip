const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { request } = require('undici');

const PORT = process.env.PORT || 3000;

// Funcion para seguir redirecciones
async function fetchWithRedirects(targetUrl, maxRedirects = 5) {
    let currentUrl = targetUrl;
    let redirectCount = 0;

    while (redirectCount < maxRedirects) {
        const urlObj = new URL(currentUrl);
        const refererUrl = urlObj.protocol + '//' + urlObj.hostname + '/';

        console.log('  Fetching: ' + currentUrl.substring(0, 80) + '...');

        const response = await request(currentUrl, {
            method: 'GET',
            headersTimeout: 30000,
            bodyTimeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': refererUrl
            }
        });

        console.log('  Status: ' + response.statusCode);

        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            const location = response.headers.location;
            if (!location) throw new Error('Redirect sin Location header');
            currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString();
            redirectCount++;
            continue;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error('HTTP ' + response.statusCode);
        }

        return response;
    }

    throw new Error('Demasiadas redirecciones');
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

    // Ruta para cargar ZIP via URL en la ruta
    if (pathname.startsWith('/http://') || pathname.startsWith('/https://')) {
        const zipUrl = pathname.substring(1);
        const redirectUrl = '/?url=' + encodeURIComponent(zipUrl);
        console.log('Redirigiendo a: ' + redirectUrl);
        res.writeHead(302, { 'Location': redirectUrl });
        res.end();
        return;
    }

    // API Proxy para descargar ZIPs
    if (pathname === '/api/proxy') {
        if (!query.url) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Parametro url requerido' }));
            return;
        }

        const targetUrl = decodeURIComponent(query.url);
        console.log('Proxy request: ' + targetUrl.substring(0, 60) + '...');

        try {
            const response = await fetchWithRedirects(targetUrl);

            // Buffer contenido completo
            const chunks = [];
            for await (const chunk of response.body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            const urlPath = new URL(targetUrl).pathname;
            const fileName = urlPath.split('/').pop() || 'archivo.zip';

            const headers = {
                'Content-Type': 'application/octet-stream',
                'Cache-Control': 'public, max-age=86400',
                'Content-Disposition': 'attachment; filename="' + fileName + '"',
                'Content-Length': buffer.length
            };

            console.log('Enviando respuesta: ' + buffer.length + ' bytes');
            res.writeHead(200, headers);
            res.end(buffer);
        } catch (err) {
            console.error('Error: ' + err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // API para obtener archivo del ZIP
    if (pathname === '/api/extract') {
        if (!query.url || !query.file) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'url y file requeridos' }));
            return;
        }

        const targetUrl = decodeURIComponent(query.url);
        const filePath = decodeURIComponent(query.file);
        console.log('Extrayendo: ' + filePath);

        try {
            const response = await fetchWithRedirects(targetUrl);
            const chunks = [];
            for await (const chunk of response.body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            // Devolver el ZIP completo, el cliente extrae con JSZip
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': buffer.length,
                'X-File-Path': filePath
            });
            res.end(buffer);
        } catch (err) {
            console.error('Error: ' + err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Servir archivos estaticos
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    const ext = path.extname(filePath);

    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.json') contentType = 'application/json';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404</h1>');
            } else {
                res.writeHead(500);
                res.end('Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}).listen(PORT, () => {
    console.log('Servidor en http://localhost:' + PORT);
    console.log('Proxy en /api/proxy?url=...');
});
