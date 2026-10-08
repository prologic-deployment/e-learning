const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});const errors=[];let checks=0;
 const origin='http://127.0.0.1:4200',prefix='Band check '+Date.now();
 try{
 for(const role of ['trainer','admin']){
 const c=await browser.newContext({viewport:{width:1440,height:1000}});
 const login=await c.request.post(origin+'/api/auth/login',{data:{email:role+'@dashboard.example.test',password:'DashboardTestOnly123!'}});assert.equal(login.status(),200);const session=await login.json();
 if(role==='trainer')for(const price of [0,0.01,49.99,50,99.99,100,199.99,200,500]){const r=await c.request.post(origin+'/api/courses',{headers:{Authorization:'Bearer '+session.token},data:{title:prefix+' '+price,description:'Disposable filter boundary test',price}});assert.equal(r.status(),201);}
 await c.addInitScript(s=>{localStorage.setItem('token',s.token);localStorage.setItem('user',JSON.stringify(s.user));},session);
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/'+role+'-dashboard?tab=courses');await p.locator('.detail-record-row').first().waitFor();
 assert.equal(await p.getByRole('spinbutton').count(),0);checks++;
 await p.getByRole('searchbox',{name:'Search records',exact:true}).fill(prefix);
 for(const [label,count] of [['Free',1],['Paid · under 50 TND',2],['50–under 100 TND',2],['100–under 200 TND',2],['200 TND and above',2],['All prices',9]]){
 await p.getByRole('button',{name:'Filter Price',exact:true}).click();await p.getByRole('menuitemradio',{name:label,exact:true}).click();await p.waitForFunction(n=>document.querySelectorAll('.detail-record-row').length===n,count);checks++;
 }
 await p.getByRole('button',{name:'Filter Price',exact:true}).click();await p.getByRole('menuitemradio',{name:'Free',exact:true}).click();
 await p.getByRole('button',{name:/Reset filters/}).click();assert.equal(await p.getByRole('searchbox',{name:'Search records',exact:true}).inputValue(),'');assert.match(await p.getByRole('button',{name:'Filter Price',exact:true}).innerText(),/All prices/);checks++;
 await p.getByRole('button',{name:'Use dark theme',exact:true}).click();await p.getByRole('button',{name:'Filter Price',exact:true}).focus();await p.keyboard.press('Enter');await p.getByRole('menuitemradio',{name:'Free',exact:true}).waitFor();await p.keyboard.press('Escape');assert.equal(await p.getByRole('button',{name:'Filter Price',exact:true}).evaluate(e=>e===document.activeElement),true);checks++;
 await p.setViewportSize({width:375,height:812});await p.getByRole('button',{name:'Filter Price',exact:true}).click();const menu=p.locator('.filter-menu');await menu.waitFor();const box=await menu.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=376);checks++;
 if(role==='admin'){fs.mkdirSync('../docs/product-quality/price-bands',{recursive:true});await p.screenshot({path:'../docs/product-quality/price-bands/mobile-dark.png',fullPage:true});}
 await c.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: '+checks+' price-band browser checks; real API records, no runtime errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
