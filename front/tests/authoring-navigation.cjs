const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try {
  const page=await browser.newPage();
  await page.route('**/api/**',r=>r.fulfill({json:{courses:[],users:[],stats:{}}}));
  await page.goto('http://127.0.0.1:4200');
  await page.evaluate(()=>{localStorage.setItem('token','test-only');localStorage.setItem('user',JSON.stringify({role:'admin'}));});
  await page.goto('http://127.0.0.1:4200/admin-dashboard?tab=create');
  await page.locator('#editor-title').fill('Unsaved title');
  let prompts=0;
  page.on('dialog',async d=>{prompts++;await d.dismiss();});
  // Drive the real Angular Router so guards also cover query-parameter transitions.
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('app-course-builder'));void c.router.navigateByUrl('/admin-dashboard?tab=courses');});
  await page.waitForTimeout(200);
  assert.equal(prompts,1);assert.match(page.url(),/tab=create/);
  assert.equal(await page.locator('#editor-title').inputValue(),'Unsaved title');
  // Cancelling logout must not clear the session before the route guard runs.
  await page.evaluate(()=>ng.getComponent(document.querySelector('app-workspace-shell')).logout());
  assert.equal(prompts,2);
  assert.equal(await page.evaluate(()=>localStorage.getItem('token')),'test-only');
  assert.equal(await page.locator('#editor-title').inputValue(),'Unsaved title');
  page.removeAllListeners('dialog');
  page.on('dialog',async d=>{prompts++;await d.accept();});
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('app-course-builder'));void c.router.navigateByUrl('/admin-dashboard?tab=courses');});await page.waitForURL(/tab=courses/);
  assert.equal(prompts,3);
  assert.equal(await page.locator('#editor-title').count(),0);
  console.log('PASS cancel preserves dirty editor; confirm leaves query-param workspace.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
