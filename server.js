const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { request } = require('undici');

const PORT = process.env.PORT || 3000;

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
            const response = await request(targetUrl, {
                method: 'GET',
                headersTimeout: 30000,
                bodyTimeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/octet-stream, application/zip, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.google.com/'
                }
            });

            const headers = {
                'Content-Type': response.headers['content-type'] || 'application/octet-stream',
                'Cache-Control': 'public, max-age=86400'
            };

            if (response.headers['content-length']) {
                headers['Content-Length'] = response.headers['content-length'];
            }

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
