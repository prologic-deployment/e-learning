// Diagnostics only. No service is started/stopped and no secret values are printed.
require('dotenv').config({path:process.env.AUTH_ENV_FILE || require('node:path').join(__dirname,'../.env'),quiet:true});
const port = Number(process.env.PORT) || 5000;
(async () => {
  try {
    require('../src/services/totp.service').key();
    console.log('PASS: TOTP key format is configured in this environment.');
  } catch {
    console.error('FAIL: TOTP_ENCRYPTION_KEY missing/invalid. Run npm run auth:configure; an invalid file value requires -- --replace-invalid and a database with no enrolled/pending authenticators.');
    process.exitCode = 1;
  }
  const origin = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(origin+'/api/health', {signal:AbortSignal.timeout(3000)});
    const body = await response.json();
    if (!response.ok || !body.ready) throw new Error('API/database not ready');
    console.log(`PASS: API and MongoDB ready at ${origin}`);
    const handshake=await fetch(origin+'/socket.io/?EIO=4&transport=polling',{signal:AbortSignal.timeout(3000)});
    const payload=await handshake.text();
    if(!handshake.ok || !payload.startsWith('0'))throw new Error('Socket.IO transport unavailable');
    const {sid}=JSON.parse(payload.slice(1));
    if(typeof sid!=='string')throw new Error('Invalid Socket.IO handshake');
    await fetch(origin+'/socket.io/?EIO=4&transport=polling&sid='+encodeURIComponent(sid),{method:'POST',headers:{'Content-Type':'text/plain'},body:'1',signal:AbortSignal.timeout(3000)});
    console.log('PASS: Socket.IO transport reachable. Application connections still require JWT authentication.');
  } catch {
    console.error(`FAIL: API/Socket.IO unavailable or not ready at ${origin}. Inspect the BACKEND terminal for startup/configuration errors; Angular compilation does not start Node or MongoDB.`);
    process.exitCode=1;
  }
  console.log(`Angular proxy must use ${origin}. In the FRONTEND PowerShell terminal: $env:API_PROXY_TARGET="${origin}"; npm start`);
  console.log('Keep npm run dev running in a separate BACKEND terminal. Restart ng serve after changing API_PROXY_TARGET.');
})();
