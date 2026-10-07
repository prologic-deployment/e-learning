const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4200/');await page.getByRole('button',{name:'Switch to dark mode'}).click();
 for(const width of [320,390,768,1440,1920,2560]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.locator('.landing').evaluate(e=>Math.round(e.getBoundingClientRect().width)),width);
  assert.equal(await page.locator('.landing').evaluate(e=>e.getBoundingClientRect().left),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>scrollTo(0,900));assert.equal(Math.round((await page.locator('.site-header').boundingBox()).y),0);
 }
 await page.setViewportSize({width:1920,height:1080});await page.getByRole('button',{name:'Language',exact:true}).click();await page.getByRole('menuitemradio',{name:'Français',exact:true}).click();assert.equal(await page.locator('html').getAttribute('lang'),'fr');
 assert.match(await page.locator('.locale-trigger img').getAttribute('src'),/fr.svg/);await page.getByRole('button',{name:'Langue',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('menu').count(),0);
 await page.locator('.desktop-nav').getByRole('link',{name:'Pour votre équipe'}).click();await page.waitForFunction(()=>{const section=document.querySelector('#for-every-role').getBoundingClientRect(),header=document.querySelector('.site-header').getBoundingClientRect();return section.top>=header.bottom&&section.top<header.bottom+40;}).catch(async e=>{console.log(await page.evaluate(()=>({header:document.querySelector('.site-header').getBoundingClientRect().toJSON(),section:document.querySelector('#for-every-role').getBoundingClientRect().toJSON(),margin:getComputedStyle(document.querySelector('#for-every-role')).scrollMarginTop,offset:getComputedStyle(document.querySelector('.landing')).getPropertyValue('--header-offset')})));throw e;});
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'../docs/product-quality/landing-wide-dark.png',animations:'disabled'});
 assert.equal(await page.locator('.chat-launcher').evaluate(e=>getComputedStyle(e).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});assert.match(await page.locator('.chat-launcher').evaluate(e=>getComputedStyle(e).animationName),/chat-arrive/);
 assert.deepEqual(errors,[]);console.log('PASS: flags/menu/Escape, full-bleed dark canvas 320–2560px, sticky header, unobscured anchors, finite chat motion and reduced motion.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
