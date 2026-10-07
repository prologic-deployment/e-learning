// Low-memory local preview of an already built SPA, with same-origin API/WS proxy.
// Not a production hosting configuration.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const proxy = require('http-proxy').createProxyServer({
    target: process.env.API_TARGET || 'http://127.0.0.1:5000',
    changeOrigin: true,
    ws: true,
});
const root = path.resolve(__dirname, '../dist/edla-ng');
const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon',
};
proxy.on('error', (_, req, res) => {
    if (res.writeHead) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                message:
                    'The learning API is unavailable. Configure and start the backend, then try again.',
            }),
        );
    } else res.destroy();
});
const server = http.createServer((req, res) => {
    if (/^\/(api|socket.io|uploads)(\/|\?|$)/.test(req.url)) return proxy.web(req, res);
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://preview').pathname);
    } catch {
        res.writeHead(400);
        return res.end();
    }
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) {
        res.writeHead(403);
        return res.end();
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
        file = path.join(root, 'index.html');
    if (!fs.existsSync(file)) {
        res.writeHead(503);
        return res.end('Build the Angular app before starting the preview.');
    }
    res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
});
server.on('connection', socket => socket.on('error', () => socket.destroy()));
server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/socket.io')) proxy.ws(req, socket, head);
    else socket.destroy();
});
server.listen(Number(process.env.PORT) || 4200, '0.0.0.0', () =>
    console.log('E-Learning preview listening on 0.0.0.0:' + (process.env.PORT || 4200)),
);
