const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});const errors=[];let checks=0;
 fs.mkdirSync('../docs/product-quality/sidebar-notifications',{recursive:true});
 try {
 for(const role of ['admin','trainer','manager','user']){
 const c=await b.newContext({viewport:{width:1440,height:900}});
 const login=await c.request.post('http://127.0.0.1:4200/api/auth/login',{data:{email:role+'@dashboard.example.test',password:'DashboardTestOnly123!'}});assert.equal(login.status(),200);
 await c.addInitScript(s=>{localStorage.setItem('token',s.token);localStorage.setItem('user',JSON.stringify(s.user));},await login.json());
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));let offline=true,probes=0;
 await p.route('**/api/health',r=>{probes++;return offline?r.fulfill({status:503,contentType:'application/json',body:'{"ready":false}'}):r.continue();});
 const base='http://127.0.0.1:4200/'+(role==='user'?'dashboard':role+'-dashboard');await p.goto(base);
 const notice=p.locator('.connection-notice'),rail=p.locator('.workspace-rail');await notice.waitFor();
 async function clearOfSidebar(){const n=await notice.boundingBox(),r=await rail.boundingBox(),h=await p.locator('.workspace-topbar').boundingBox();assert.ok(n.x>=r.x+r.width-1);assert.ok(n.y>=h.y+h.height-1);const retry=p.getByRole('button',{name:'Retry notifications',exact:true});assert.equal(await retry.evaluate(e=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),true);checks++;}
 await clearOfSidebar();await p.getByRole('button',{name:'Collapse navigation',exact:true}).click();await p.waitForFunction(()=>Math.abs(document.querySelector('.workspace-rail').getBoundingClientRect().width-80)<1);await clearOfSidebar();
 assert.equal(await p.getByRole('button',{name:'Expand navigation',exact:true}).getAttribute('aria-expanded'),'false');assert.ok(await p.locator('.workspace-rail .rail-link[aria-label]').count()>3);checks++;
 await p.reload();await notice.waitFor();assert.equal(Math.round((await rail.boundingBox()).width),80);checks++;
 const expand=p.getByRole('button',{name:'Expand navigation',exact:true});await expand.focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('.workspace-rail').getBoundingClientRect().width>247);await clearOfSidebar();
 await p.getByRole('button',{name:'Use dark theme',exact:true}).click();
 if(role==='admin')await p.screenshot({path:'../docs/product-quality/sidebar-notifications/desktop-dark.png',fullPage:true});
 await p.setViewportSize({width:1000,height:560});await p.getByRole('button',{name:'Collapse navigation',exact:true}).click();await p.waitForFunction(()=>Math.abs(document.querySelector('.workspace-rail').getBoundingClientRect().width-80)<1);await clearOfSidebar();
 // Short desktop viewports keep the final navigation destination reachable.
 const security=p.locator('.workspace-rail .rail-link').last();await security.focus();assert.equal(await security.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),true);checks++;
 await p.setViewportSize({width:375,height:640});const mobile=p.getByRole('button',{name:'Open navigation',exact:true});await mobile.waitFor();assert.equal(await rail.isVisible(),false);const n=await notice.boundingBox();assert.ok(n.x>=0&&n.x+n.width<=375);checks++;
 await mobile.click();const sheet=p.locator('.mobile-sheet');await sheet.waitFor();assert.ok(await p.locator('.cdk-overlay-backdrop').count()>0);
 await p.keyboard.press('Escape');await sheet.waitFor({state:'detached'});assert.equal(await mobile.evaluate(e=>e===document.activeElement),true);checks++;
 await mobile.click();await sheet.waitFor();await p.locator('.cdk-overlay-backdrop').click({position:{x:370,y:200},force:true});await sheet.waitFor({state:'detached'});checks++;
 await mobile.click();await sheet.waitFor();await sheet.getByRole('link',{name:'Security & 2FA',exact:true}).click();await p.waitForURL('**/account/security');await sheet.waitFor({state:'detached'});checks++;
 await mobile.click();await sheet.waitFor();await p.waitForFunction(()=>document.querySelector('.mobile-sheet').getBoundingClientRect().x>=-1);if(role==='admin')await p.screenshot({path:'../docs/product-quality/sidebar-notifications/mobile-drawer.png',animations:'disabled'});
 await p.setViewportSize({width:1440,height:900});await sheet.waitFor({state:'detached'});await notice.waitFor();await clearOfSidebar();
 await p.emulateMedia({reducedMotion:'reduce'});await p.getByRole('button',{name:'Expand navigation',exact:true}).click();const d=await rail.evaluate(e=>parseFloat(getComputedStyle(e).transitionDuration));assert.ok(d<0.001,'reduced motion must remove navigation motion, got '+d);checks++;
 await p.setViewportSize({width:320,height:640});const small=await notice.boundingBox();assert.ok(small.x>=0&&small.x+small.width<=320);assert.equal(await p.getByRole('button',{name:'Retry notifications',exact:true}).isVisible(),true);checks++;
 offline=false;const before=probes;await p.getByRole('button',{name:'Retry notifications',exact:true}).click();
 await p.waitForFunction(()=>window.ng.getComponent(document.querySelector('app-root')).socketService.state.value==='connected');assert.ok(probes>before);assert.equal(await notice.count(),0);checks++;
 await c.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: '+checks+' sidebar/notification checks across four roles; no runtime errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
