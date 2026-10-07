const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try {
  const page=await browser.newPage();
  await page.route('**/api/**',r=>r.fulfill({json:{courses:[],pagination:{total:0}}}));
  await page.goto('http://127.0.0.1:4200');
  await page.evaluate(()=>{
   const service=ng.getComponent(document.querySelector('app-root')).toast;
   service.show('Saved successfully.');service.show('Saved successfully.');
   service.show('Please retry.','error');
  });
  await page.locator('.toast-message').first().waitFor();
  assert.equal(await page.locator('.toast-message').count(),2);
  assert.equal(await page.locator('.toast-message[role="alert"]').count(),1);
  assert.equal(await page.locator('.toast-message[role="status"]').count(),1);
  await page.getByRole('button',{name:'Dismiss notification'}).first().click();
  await page.waitForFunction(()=>document.querySelectorAll('.toast-message').length===1,{},{timeout:2000});
  assert.equal(await page.locator('.toast-message').count(),1);
  console.log('PASS shared toast outlet: deduplication, success/error live regions and dismissal.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
