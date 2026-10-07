const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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
const factor = require('../src/services/totp.service');
const app = express();
app.use(express.json());
app.use('/auth', require('../src/routes/auth.routes'));
const password = 'TestOnlySecure123!';
const base = { firstname:'Isolated', lastname:'Test', password, dateOfBirth:'1995-01-01' };
const post = (path, body, token) => {
    const req = request(app).post('/auth' + path);
    return (token ? req.auth(token, {type:'bearer'}) : req).send(body);
};
const status = token => request(app).get('/auth/two-factor').auth(token, {type:'bearer'});

test('Every role can configure only its own authenticator', {timeout:180000}, async t => {
    const mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    try {
        await request(app).get('/auth/two-factor').expect(401);
        await post('/two-factor/setup', {currentPassword:password}).expect(401);
        const other = await User.create({...base, email:'other-factor@example.test', role:'user'});
        const otherLogin = await post('/login', {email:other.email,password}).expect(200);
        for (const role of ['user','trainer','manager','admin']) {
            await t.test(role + ': setup, confirm, challenged login, recovery and disable', async () => {
                const user = await User.create({...base, email:role+'-factor@example.test', role});
                const login = await post('/login', {email:user.email,password}).expect(200);
                let token = login.body.token;
                assert.equal((await status(token).expect(200)).body.enabled,false);
                await post('/two-factor/setup', {currentPassword:'incorrect'},token).expect(400);
                // User identifiers in a request must never select another account.
                const setup = await post('/two-factor/setup', {currentPassword:password,userId:other.id},token).expect(200);
                assert.equal(setup.headers['cache-control'],'no-store');
                assert.ok(setup.body.secret);
                assert.match(setup.body.qrCode,/^data:image\/png;base64,/);
                const untouched = await User.collection.findOne({_id:other._id});
                assert.ok(!untouched.twoFactor?.pendingSecret);
                await post('/two-factor/confirm', {setupToken:setup.body.setupToken,code:factor.totp(setup.body.secret).generate()},otherLogin.body.token).expect(400);
                await post('/two-factor/confirm', {setupToken:setup.body.setupToken,code:'invalid'},token).expect(400);
                const enabled = await post('/two-factor/confirm', {
                    setupToken:setup.body.setupToken,code:factor.totp(setup.body.secret).generate(),userId:other.id,
                },token).expect(200);
                assert.equal(enabled.body.recoveryCodes.length,10);
                await status(token).expect(401); // Enabling invalidates the old session.
                token = enabled.body.token;
                assert.deepEqual((await status(token).expect(200)).body,{enabled:true,recoveryCodesRemaining:10});
                assert.equal((await status(otherLogin.body.token).expect(200)).body.enabled,false);
                const challenge = await post('/login', {email:user.email,password}).expect(200);
                assert.equal(challenge.body.requiresTwoFactor,true);
                assert.equal(challenge.body.token,undefined);
                const verified = await post('/two-factor/verify', {
                    challenge:challenge.body.challenge,recoveryCode:enabled.body.recoveryCodes[0],
                }).expect(200);
                assert.ok(verified.body.token);
                await post('/two-factor/disable', {currentPassword:'incorrect',recoveryCode:enabled.body.recoveryCodes[1]},verified.body.token).expect(400);
                const disabled = await post('/two-factor/disable', {
                    currentPassword:password,recoveryCode:enabled.body.recoveryCodes[1],userId:other.id,
                },verified.body.token).expect(200);
                assert.equal((await status(disabled.body.token).expect(200)).body.enabled,false);
                assert.equal((await status(otherLogin.body.token).expect(200)).body.enabled,false);
            });
        }
    } finally {
        await mongoose.disconnect();
        await mongo.stop();
    }
});
