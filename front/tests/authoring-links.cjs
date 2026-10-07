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
  // Real pointer interaction: stable DOM identity must preserve the first click.
  await page.locator('.rail-link[href="/admin-dashboard?tab=courses"]').click();
  await page.waitForTimeout(200);
  assert.equal(prompts,1);assert.match(page.url(),/tab=create/);
  assert.equal(await page.locator('#editor-title').inputValue(),'Unsaved title');
  page.removeAllListeners('dialog');
  page.on('dialog',async d=>{prompts++;await d.accept();});
  await page.locator('.rail-link[href="/admin-dashboard?tab=courses"]').click();await page.waitForURL(/tab=courses/);
  assert.equal(prompts,2);
  assert.equal(await page.locator('#editor-title').count(),0);
  console.log('PASS actual sidebar clicks: Cancel preserves the editor; Leave navigates.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
