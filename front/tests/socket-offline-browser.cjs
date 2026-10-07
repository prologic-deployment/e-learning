// Run against ng serve with the development API stopped; validates honest outage UI.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{
  const page=await browser.newPage();let probes=0;const appSockets=[],errors=[];
  page.on('request',r=>{if(new URL(r.url()).pathname==='/api/health')probes++;});
  page.on('websocket',ws=>{if(ws.url().includes('/socket.io/'))appSockets.push(ws.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4200');
  await page.evaluate(()=>{localStorage.setItem('token','isolated-test');localStorage.setItem('user',JSON.stringify({_id:'fixture-user',role:'user'}));});
  await page.goto('http://127.0.0.1:4200/dashboard');
  await page.getByRole('button',{name:'Retry notifications'}).waitFor();
  assert.equal(probes,1);assert.equal(appSockets.length,0);
  await page.getByRole('button',{name:'Retry notifications'}).click();
  await page.getByRole('button',{name:'Retry notifications'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('app-root')?.textContent.includes('Live notifications are disconnected'));
  assert.equal(probes,2);assert.equal(appSockets.length,0);assert.deepEqual(errors,[]);
  console.log('PASS real Angular dev proxy: unavailable backend, visible retry, one readiness probe per attempt, no application WebSocket loop.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
