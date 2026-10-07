const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
process.env.RATE_LIMIT_LOGIN_MAX = '1000';
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const User = require('../src/models/User');
const Challenge = require('../src/models/AuthChallenge');
const factor = require('../src/services/totp.service');
const { authenticate } = require('../src/services/session.service');
const { protect, authorize } = require('../src/middlewares/auth.middleware');
const app = express(); app.use(express.json());
app.use('/auth', require('../src/routes/auth.routes'));
app.get('/private', protect, (req,res) => res.json(req.user));
app.get('/admin', protect, authorize('admin'), (req,res) => res.json({ok:true}));
const post = (path, body, token) => { const r = request(app).post('/auth' + path); return (token ? r.set('Authorization','Bearer ' + token) : r).send(body); };
const get = (path, token) => request(app).get(path).set('Authorization','Bearer ' + token);
const password = 'TestOnlySecure123!';
test('Authenticator authentication against an isolated real MongoDB', {timeout:180000}, async t => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  try {
    await Promise.all([User.init(), Challenge.init()]);
    const user = await User.create({firstname:'Isolated',lastname:'Test',email:'totp@example.test',password,dateOfBirth:'1995-01-01',role:['user']});
    let token, setup, codes, originalToken;
    const login = () => post('/login', {email:user.email,password});
    await t.test('password-only login, active account check and authorization', async () => {
      const r = await login(); assert.equal(r.status,200); assert.ok(r.body.token); token = originalToken = r.body.token;
      assert.equal((await get('/private',token)).status,200); assert.equal((await get('/admin',token)).status,403);
      await User.updateOne({_id:user._id},{$set:{isActive:false}}); assert.equal((await login()).status,400); assert.equal((await get('/private',token)).status,401);
      await User.updateOne({_id:user._id},{$set:{isActive:true}});
      assert.equal((await post('/verify-otp',{})).status,404);
    });
    await t.test('setup requires password, returns local QR/manual key and encrypts pending secret', async () => {
      assert.equal((await post('/two-factor/setup',{currentPassword:'wrong'},token)).status,400);
      const r = await post('/two-factor/setup',{currentPassword:password},token); assert.equal(r.status,200); setup=r.body;
      assert.match(setup.uri,/^otpauth:\/\/totp\/FormaPath/); assert.match(setup.qrCode,/^data:image\/png;base64,/); assert.ok(setup.secret);
      const raw = await User.collection.findOne({_id:user._id}); assert.notEqual(raw.twoFactor.pendingSecret,setup.secret); assert.ok(!JSON.stringify(raw).includes(setup.secret));
      assert.throws(() => factor.decrypt(raw.twoFactor.pendingSecret,new mongoose.Types.ObjectId()));
      assert.equal((await login()).body.requiresTwoFactor,undefined);
    });
    await t.test('invalid confirmation rejected; correct confirmation enables and revokes old sessions', async () => {
      assert.equal((await post('/two-factor/confirm',{setupToken:setup.setupToken,code:'bad'},token)).status,400);
      const r = await post('/two-factor/confirm',{setupToken:setup.setupToken,code:factor.totp(setup.secret).generate()},token);
      assert.equal(r.status,200); assert.equal(r.body.recoveryCodes.length,10); codes=r.body.recoveryCodes; token=r.body.token;
      assert.equal((await get('/private',originalToken)).status,401);
      const info=await get('/private',token); assert.equal(info.status,200); for(const key of ['password','twoFactor','tokenVersion']) assert.equal(info.body[key],undefined);
      const status=await get('/auth/two-factor',token); assert.deepEqual(status.body,{enabled:true,recoveryCodesRemaining:10});
      const raw=await User.collection.findOne({_id:user._id}); assert.equal(raw.twoFactor.pendingSecret,undefined); assert.ok(!JSON.stringify(raw).includes(codes[0]));
    });
    await t.test('password yields challenge only; setup code replay rejected; challenge is not a session', async () => {
      const r=await login(); assert.equal(r.body.requiresTwoFactor,true); assert.equal(r.body.token,undefined); assert.equal((await get('/private',r.body.challenge)).status,401);
      const raw=await Challenge.findOne({user:user._id}); assert.notEqual(raw.hash,r.body.challenge);
      const replay=await post('/two-factor/verify',{challenge:r.body.challenge,code:factor.totp(setup.secret).generate()}); assert.equal(replay.status,400);
    });
    await t.test('fresh TOTP yields exactly one session under concurrent verification', async () => {
      const r=await login(); const code=factor.totp(setup.secret).generate({timestamp:Date.now()+30000});
      const results=await Promise.all([1,2].map(()=>post('/two-factor/verify',{challenge:r.body.challenge,code})));
      assert.equal(results.filter(x=>x.status===200).length,1); token=results.find(x=>x.status===200).body.token;
      assert.equal((await post('/two-factor/verify',{challenge:r.body.challenge,code})).status,400);
    });
    await t.test('recovery codes are consumed atomically and cannot be reused', async () => {
      const [a,b]=await Promise.all([login(),login()]);
      const results=await Promise.all([a,b].map(r=>post('/two-factor/verify',{challenge:r.body.challenge,recoveryCode:codes[0]})));
      assert.equal(results.filter(r=>r.status===200).length,1);
      const c=await login(); assert.equal((await post('/two-factor/verify',{challenge:c.body.challenge,recoveryCode:codes[0]})).status,400);
      assert.equal((await get('/auth/two-factor',token)).body.recoveryCodesRemaining,9);
    });
    await t.test('challenge expiry is enforced before TTL cleanup', async () => {
      const r=await login(); await Challenge.updateOne({hash:factor.digest(r.body.challenge)},{$set:{expiresAt:new Date(Date.now()-1000)}});
      assert.equal((await post('/two-factor/verify',{challenge:r.body.challenge,recoveryCode:codes[1]})).status,400);
    });
    await t.test('account-wide attempt budget cannot be bypassed by issuing new challenges', async () => {
      await User.updateOne({_id:user._id},{$set:{'twoFactor.failures':0,'twoFactor.blockedUntil':null}});
      for(let i=0;i<5;i++){const r=await login(); assert.equal((await post('/two-factor/verify',{challenge:r.body.challenge,code:'bad'})).status,400);}
      const r=await login(); assert.equal((await post('/two-factor/verify',{challenge:r.body.challenge,recoveryCode:codes[1]})).status,429);
      await User.updateOne({_id:user._id},{$set:{'twoFactor.blockedUntil':new Date(Date.now()-1)}});
      assert.equal((await post('/two-factor/verify',{challenge:r.body.challenge,recoveryCode:codes[1]})).status,200);
    });
    await t.test('password reset is single-use, revokes sessions and preserves TOTP', async () => {
      const reset=crypto.randomBytes(32).toString('hex'); await User.updateOne({_id:user._id},{$set:{resetPasswordToken:factor.digest(reset),resetPasswordExpires:new Date(Date.now()+60000)}});
      assert.equal((await post('/reset-password/'+reset,{newPassword:password})).status,200); assert.equal((await post('/reset-password/'+reset,{newPassword:password})).status,400);
      assert.equal((await get('/private',token)).status,401); const r=await login(); assert.equal(r.body.requiresTwoFactor,true);
      const verified=await post('/two-factor/verify',{challenge:r.body.challenge,recoveryCode:codes[2]}); assert.equal(verified.status,200);token=verified.body.token;
    });
    await t.test('disable requires password AND proof; wipes secrets and revokes prior sessions', async () => {
      assert.equal((await post('/two-factor/disable',{currentPassword:'wrong',recoveryCode:codes[3]},token)).status,400);
      assert.equal((await post('/two-factor/disable',{currentPassword:password},token)).status,400);
      const r=await post('/two-factor/disable',{currentPassword:password,recoveryCode:codes[3]},token); assert.equal(r.status,200);
      assert.equal((await get('/private',token)).status,401); token=r.body.token;
      const raw=await User.collection.findOne({_id:user._id}); assert.equal(raw.twoFactor.secret,undefined); assert.equal(raw.twoFactor.recoveryHashes.length,0);
      assert.ok((await login()).body.token);
    });
    await t.test('logout invalidates REST and shared socket authenticator validation', async () => {
      assert.ok(await authenticate(token)); assert.equal((await post('/logout',{},token)).status,200);
      assert.equal((await get('/private',token)).status,401); await assert.rejects(authenticate(token));
    });
    await t.test('all four roles use password-only flow when disabled; public registration cannot elevate', async () => {
      for(const role of ['user','trainer','manager','admin']) {
        const u=await User.create({firstname:'Role',lastname:'Test',email:role+'@example.test',password,dateOfBirth:'1995-01-01',role:[role]});
        const r=await post('/login',{email:u.email,password}); assert.equal(r.status,200);assert.equal(r.body.user.role,role);
        assert.equal((await get('/admin',r.body.token)).status,role==='admin'?200:403);
      }
      const r=await post('/register',{firstname:'New',lastname:'Test',email:'new@example.test',password,dateOfBirth:'1995-01-01',role:'admin'});assert.equal(r.status,201);
      assert.deepEqual((await User.findOne({email:'new@example.test'})).role,['user']);
    });
    await t.test('setup cancellation, expiry and missing-key failure are safe', async () => {
      const r=await login(); const fresh=r.body.token;
      let setupResult=await post('/two-factor/setup',{currentPassword:password},fresh);
      assert.equal(setupResult.status,200);
      await request(app).delete('/auth/two-factor/setup').set('Authorization','Bearer '+fresh).expect(200);
      assert.equal((await post('/two-factor/confirm',{setupToken:setupResult.body.setupToken,code:factor.totp(setupResult.body.secret).generate()},fresh)).status,400);
      setupResult=await post('/two-factor/setup',{currentPassword:password},fresh);
      await User.updateOne({_id:user._id},{$set:{'twoFactor.pendingExpires':new Date(Date.now()-1)}});
      assert.equal((await post('/two-factor/confirm',{setupToken:setupResult.body.setupToken,code:factor.totp(setupResult.body.secret).generate()},fresh)).status,400);
      const key=process.env.TOTP_ENCRYPTION_KEY;delete process.env.TOTP_ENCRYPTION_KEY;
      assert.equal((await post('/two-factor/setup',{currentPassword:password},fresh)).status,503);
      process.env.TOTP_ENCRYPTION_KEY=key;
    });
    await t.test('every role requires TOTP once enabled and fresh TOTP can securely disable', async () => {
      for(const role of ['user','trainer','manager','admin']) {
        const r=await post('/login',{email:role+'@example.test',password});
        const setupResult=await post('/two-factor/setup',{currentPassword:password},r.body.token);
        const secret=setupResult.body.secret;
        const confirmation=await post('/two-factor/confirm',{setupToken:setupResult.body.setupToken,code:factor.totp(secret).generate()},r.body.token);
        assert.equal(confirmation.status,200);
        const challenge=await post('/login',{email:role+'@example.test',password});assert.equal(challenge.body.token,undefined);assert.ok(challenge.body.challenge);
        const verified=await post('/two-factor/verify',{challenge:challenge.body.challenge,recoveryCode:confirmation.body.recoveryCodes[0]});assert.equal(verified.status,200);assert.equal(verified.body.user.role,role);
        const disabled=await post('/two-factor/disable',{currentPassword:password,code:factor.totp(secret).generate({timestamp:Date.now()+30000})},verified.body.token);assert.equal(disabled.status,200);
      }
    });
    await t.test('clock drift is bounded; encryption key is mandatory and AAD-bound', () => {
      const secret=factor.createSecret(),now=1800000000000;
      for(const delta of [-1,0,1]) assert.equal(factor.verifyStep(secret,factor.totp(secret).generate({timestamp:now+delta*30000}),now),Math.floor(now/30000)+delta);
      assert.equal(factor.verifyStep(secret,factor.totp(secret).generate({timestamp:now+90000}),now),null);
      const key=process.env.TOTP_ENCRYPTION_KEY; delete process.env.TOTP_ENCRYPTION_KEY; assert.throws(()=>factor.encrypt(secret,'test'),/not configured/); process.env.TOTP_ENCRYPTION_KEY=key;
    });
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});
