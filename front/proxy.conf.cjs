// Executed by the DEV SERVER, never bundled into browser code.
const target = process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000';
const parsed = new URL(target);
if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
  throw new Error('API_PROXY_TARGET must be an HTTP(S) origin without credentials, query or path.');
}
let lastWarning = 0;
function onError(error, req, res) {
  if (Date.now() - lastWarning > 10000) {
    console.error(`[FormaPath proxy] Backend ${target} unavailable (${error.code || 'connection error'}). Start the backend and run npm run doctor in back/. PORT must match API_PROXY_TARGET. Restart ng serve after changing its target.`);
    lastWarning = Date.now();
  }
  if (typeof res.writeHead === 'function') {
    if (!res.headersSent) res.writeHead(503, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({code:'DEV_BACKEND_UNAVAILABLE',message:'Development backend is unavailable. Start the API and check its port.'}));
  } else res.destroy(); // Failed upgrade: this is a socket, not an HTTP response.
}
console.log(`[FormaPath proxy] /api, /socket.io and /uploads -> ${target}`);
module.exports = Object.fromEntries(['/api','/socket.io','/uploads'].map(context => [context, {
  target, changeOrigin:true, secure:true, ws:context==='/socket.io', onError,
}]));
