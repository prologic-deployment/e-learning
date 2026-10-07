// Real API / disposable MongoDB. No mocked authentication or application data.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),crypto=require('crypto'),OTPAuth=require('../../back/node_modules/otpauth');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const email=`browser-${crypto.randomBytes(6).toString('hex')}@example.test`,password='BrowserTestSecure123!';
 await page.goto('http://127.0.0.1:4200/profile-authentication');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('Email address is required.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Create an account',exact:true}).click();
 for(const [label,value] of [['First name','Browser'],['Last name','Test'],['Date of birth','1995-01-01'],['Email address',email],['Password',password]]) await page.getByLabel(label).fill(value);
 await page.getByRole('button',{name:/^Create account/}).click();await page.getByText('Your account is ready. Sign in to begin.').waitFor();
 await page.getByLabel('Password',{exact:false}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
 await page.goto('http://127.0.0.1:4200/account/security');await page.getByLabel('Current password').fill(password);
 const pending=page.waitForResponse(r=>r.url().endsWith('/two-factor/setup')&&r.request().method()==='POST');await page.getByRole('button',{name:'Set up authenticator',exact:true}).click();
 const setup=await(await pending).json();assert.ok(setup.secret);
 await page.getByRole('img',{name:/Authenticator setup QR/}).waitFor();await page.getByText('Cannot scan? Use the manual setup key').click();await page.getByText(setup.secret,{exact:true}).waitFor();
 const totp=new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(setup.secret),digits:6,period:30,algorithm:'SHA1'});
 await page.getByLabel('Code from your authenticator').fill('000000');await page.getByRole('button',{name:'Confirm and enable',exact:true}).click();await page.getByText(/Invalid authenticator code/).waitFor();
 await page.getByLabel('Code from your authenticator').fill(totp.generate());const confirmed=page.waitForResponse(r=>r.url().endsWith('/two-factor/confirm'));
 await page.getByRole('button',{name:'Confirm and enable',exact:true}).click();const codes=(await(await confirmed).json()).recoveryCodes;assert.equal(codes.length,10);
 await page.getByRole('heading',{name:'Your recovery codes'}).waitFor();assert.equal(await page.locator('.recovery-list code').count(),10);
 const stored=await page.evaluate(()=>JSON.stringify(localStorage));assert.ok(!stored.includes(setup.secret)&&!stored.includes(codes[0]));
 await page.getByRole('button',{name:'I have saved my codes'}).click();
 await page.getByRole('button',{name:'Open account menu'}).click();await page.getByRole('menuitem',{name:'Sign out',exact:true}).click();await page.waitForURL('**/profile-authentication');
 await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:false}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('heading',{name:'Check your authenticator.'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('token')),null);
 await page.getByRole('button',{name:'Use a recovery code instead'}).click();await page.getByLabel('Recovery code').fill(codes[0]);await page.getByRole('button',{name:'Verify and sign in'}).click();await page.waitForURL('**/dashboard');
 await page.goto('http://127.0.0.1:4200/account/security');await page.getByText('9 recovery codes remaining.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Disable authenticator…',exact:true}).click();await page.getByLabel('Current password').fill(password);await page.getByRole('button',{name:'Use a recovery code instead'}).click();await page.getByLabel('Unused recovery code').fill(codes[1]);
 await page.getByRole('button',{name:'Disable authenticator',exact:true}).click();await page.getByRole('button',{name:'Set up authenticator',exact:true}).waitFor();assert.deepEqual(errors,[]);
 await page.evaluate(()=>localStorage.clear());
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:4200/profile-authentication');await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`../docs/product-quality/auth-${viewport.width}.png`,fullPage:true,animations:"disabled"});
 }
 console.log('PASS: registration, password login, QR/manual setup, invalid/valid confirmation, recovery display, logout, factor challenge, recovery login, secure disable; desktop/mobile no overflow; no page errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
