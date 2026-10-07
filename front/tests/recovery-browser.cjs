const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4200/forgot-password');assert.equal(await page.locator('app-navbar').count(),0);
 await page.getByRole('button',{name:/Send reset link/}).click();await page.getByText('Account email is required.',{exact:true}).waitFor();
 await page.getByLabel('Account email').fill('not-an-email');await page.getByLabel('Account email').blur();await page.getByText('Enter a valid email address.').waitFor();
 await page.getByLabel('Account email').fill('nonexistent-browser@example.test');await page.context().setOffline(true);await page.getByRole('button',{name:/Send reset link/}).click();await page.getByText(/We could not request/).waitFor();assert.equal(await page.getByRole('button',{name:/Send reset link/}).isEnabled(),true);
 await page.context().setOffline(false);await page.getByRole('button',{name:/Send reset link/}).click();await page.getByText(/If an account exists/).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.goto('http://127.0.0.1:4200/reset-password/incomplete');await page.getByText(/incomplete or invalid/).waitFor();assert.equal(await page.locator('form').count(),0);
 await page.goto('http://127.0.0.1:4200/reset-password/'+'a'.repeat(64));await page.getByLabel('New password',{exact:false}).first().fill('NewPassword123!');await page.getByLabel('Confirm new password').fill('Different123!');await page.getByRole('button',{name:'Save new password'}).click();await page.getByText(/passwords do not match/).waitFor();
 await page.getByLabel('Confirm new password').fill('NewPassword123!');await page.getByRole('button',{name:'Save new password'}).click();await page.getByText('Invalid or expired reset link.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Save new password'}).isEnabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS recovery forms: required/email validation, offline error and retry, generic real response, malformed/expired reset links, password mismatch, pending cleanup and mobile overflow.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
