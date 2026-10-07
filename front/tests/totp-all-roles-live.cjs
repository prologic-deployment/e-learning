// Requires the disposable totp-browser-api fixture and a development frontend.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const OTPAuth=require('../../back/node_modules/otpauth');
const password='TestOnlySecure123!';
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try {
  for(const role of ['user','trainer','manager','admin']){
   const context=await browser.newContext();
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const login=await page.request.post('http://127.0.0.1:5000/api/auth/login',{data:{email:role+'@authoring.example.test',password}});
   assert.equal(login.status(),200);
   const session=await login.json();assert.ok(session.token);
   await page.goto('http://127.0.0.1:4200');
   await page.evaluate(session=>{localStorage.setItem('token',session.token);localStorage.setItem('user',JSON.stringify(session.user));},session);
   const dashboard=role==='user'?'/dashboard':'/'+role+'-dashboard';
   await page.goto('http://127.0.0.1:4200'+dashboard);
   const card=page.locator('app-account-security-card');
   await card.getByText('Not enabled',{exact:true}).waitFor();
   await card.getByRole('link',{name:'Configure my 2FA'}).click();
   await page.waitForURL('**/account/security');
   await page.getByRole('heading',{name:'Two-factor authentication (2FA)',exact:true}).waitFor();
   await page.getByLabel('Current password',{exact:false}).fill(password);
   await page.getByRole('button',{name:'Set up authenticator',exact:true}).click();
   await page.locator('.manual-key').waitFor({state:'attached'});
   const secret=(await page.locator('.manual-key').textContent()).trim();
   const code=new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(secret),algorithm:'SHA1',digits:6,period:30}).generate();
   await page.getByLabel('Code from your authenticator',{exact:false}).fill(code);
   await page.getByRole('button',{name:'Confirm and enable',exact:true}).click();
   await page.getByRole('heading',{name:'Your recovery codes'}).waitFor();
   const codes=await page.locator('.recovery-list code').allTextContents();assert.equal(codes.length,10);
   assert.ok(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes(secret));
   await page.getByRole('button',{name:'I have saved my codes'}).click();
   await page.reload();await page.getByText('Enabled',{exact:true}).waitFor();
   const challenge=await page.request.post('http://127.0.0.1:5000/api/auth/login',{data:{email:role+'@authoring.example.test',password}});
   const challenged=await challenge.json();assert.equal(challenged.requiresTwoFactor,true);assert.equal(challenged.token,undefined);
   await page.getByRole('button',{name:'Disable authenticator…',exact:true}).click();
   await page.getByLabel('Current password',{exact:false}).fill(password);
   await page.getByRole('button',{name:'Use a recovery code instead'}).click();
   await page.getByLabel('Unused recovery code',{exact:false}).fill(codes[0].trim());
   await page.getByRole('button',{name:'Disable authenticator',exact:true}).click();
   await page.getByText('Not enabled',{exact:true}).waitFor();
   assert.deepEqual(errors,[]);
   await context.close();
   console.log('PASS '+role+': dashboard 2FA entry, QR/manual setup, enable, recovery codes, persisted status, challenged login and safe disable.');
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error.message);process.exit(1);});
