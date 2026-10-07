// Runs in a second terminal while the backend stays running. Does not start/stop it.
require('dotenv').config({quiet:true});
const port = Number(process.env.PORT) || 5000;
(async () => {
  const url = `http://127.0.0.1:${port}/`;
  try {
    const response = await fetch(url, {signal:AbortSignal.timeout(3000)});
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error('Unexpected API response');
    console.log(`PASS: API responds at ${url}`);
    console.log(`MongoDB: ${body.services?.mongodb || 'unknown'}`);
    if (port !== 5000) console.warn(`The committed Angular proxy targets port 5000, not ${port}. Align back/.env PORT and front/proxy.conf.json, then restart both processes.`);
  } catch {
    console.error(`FAIL: API unavailable at ${url}. Keep npm run dev running in a separate terminal. Check its latest error/signal message and port setting.`);
    process.exitCode=1;
  }
})();
