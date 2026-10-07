const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try {
  const page=await browser.newPage();
  const oldEmoji=String.fromCodePoint(0x1f393);
  await page.route('**/api/**',r=>{
   const url=r.request().url();
   if(url.endsWith('/badges/my-badges'))return r.fulfill({json:[{badge:{name:'Scholar '+oldEmoji,icon:'bx bx-graduation',description:'Earned a certificate.'}}]});
   if(url.endsWith('/notifications'))return r.fulfill({json:{notifications:[{_id:'test',title:'Certificate '+oldEmoji,message:'Completed '+oldEmoji,isRead:false}],unreadCount:1}});
   return r.fulfill({status:503,json:{message:'Isolated test: optional service unavailable'}});
  });
  await page.goto('http://127.0.0.1:4200');
  await page.evaluate(()=>{localStorage.setItem('token','test-only');localStorage.setItem('user',JSON.stringify({role:'user'}));});
  await page.goto('http://127.0.0.1:4200/dashboard?tab=badges');
  await page.getByRole('heading',{name:'Scholar',exact:true}).waitFor();
  assert.equal(await page.locator('.achievement-icon .bx-medal').count(),1);
  assert.ok(!(await page.locator('.achievement').innerText()).includes('bx bx-graduation'));
  await page.locator('.rail-link[href="/dashboard?tab=notifications"]').click();
  await page.getByRole('heading',{name:'Certificate',exact:true}).waitFor();
  assert.ok(!(await page.locator('.notification-copy').innerText()).includes(oldEmoji));
  console.log('PASS legacy badge identifiers render as icons; persisted notification emoji removed from presentation.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
