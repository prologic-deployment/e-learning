const User = require('../models/User');
const Challenge = require('../models/AuthChallenge');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const QRCode = require('qrcode');
const factor = require('../services/totp.service');
const { session, disconnectSessions } = require('../services/session.service');
const { sendEmail } = require('../services/email.service');
const config = require('../config/env');
const fields = '+password +tokenVersion +twoFactor +loginAttempts +loginBlockedUntil';
const fail = (status, message) => Object.assign(new Error(message), { status });
const wrap = handler => async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try { await handler(req, res); }
  catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Check the required fields and password requirements.' });
    if (error.code === 11000) return res.status(409).json({ message: 'An account already exists with these details.' });
    // Never forward request bodies, cryptographic errors or provider responses to logs.
    res.status(500).json({ message: 'The request could not be completed. Please try again.' });
  }
};
const text = (value, max = 320) => typeof value === 'string' && value.length <= max ? value.trim() : '';
const passwordValid = value => typeof value === 'string' && /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(value) && Buffer.byteLength(value) <= 72;
const passwordMatches = (value, hash) => typeof value === 'string' && Buffer.byteLength(value) <= 72 ? bcrypt.compare(value, hash) : Promise.resolve(false);
const versionFilter = user => ({ _id: user._id, tokenVersion: user.tokenVersion ? user.tokenVersion : { $in: [0, null] }, isActive: true });
async function credentials(req) {
  const user = await User.findById(req.user._id).select(fields);
  if (!user?.isActive || !(await passwordMatches(req.body.currentPassword, user.password))) throw fail(400, 'Current password is incorrect.');
  if ((user.tokenVersion || 0) !== req.user.tokenVersion) throw fail(401, 'Session expired. Sign in again.');
  return user;
}
// A database-backed account budget, shared across workers and newly issued challenges.
async function reserveFactor(user) {
  const now = new Date();
  const updated = await User.findOneAndUpdate({ ...versionFilter(user), $or: [
    { 'twoFactor.blockedUntil': null }, { 'twoFactor.blockedUntil': { $lte: now } }
  ] }, [
    { $set: { 'twoFactor.failures': { $add: [{ $cond: [
      { $and: [{ $ne: [{ $ifNull: ['$twoFactor.blockedUntil', null] }, null] }, { $lte: ['$twoFactor.blockedUntil', now] }] }, 0,
      { $ifNull: ['$twoFactor.failures', 0] }] }, 1] } } },
    { $set: { 'twoFactor.blockedUntil': { $cond: [{ $gte: ['$twoFactor.failures', 5] }, new Date(Date.now() + 600000), null] } } }
  ], { new: true, updatePipeline: true }).select(fields);
  if (!updated) throw fail(429, 'Too many attempts or an expired session. Wait ten minutes, then sign in again.');
  return updated;
}
function factorFilter(user, body) {
  if (body.recoveryCode !== undefined) {
    const hash = factor.recoveryHash(body.recoveryCode);
    if (!hash || !user.twoFactor.recoveryHashes.includes(hash)) throw fail(400, 'Invalid or already used recovery code.');
    return { query: { 'twoFactor.recoveryHashes': hash }, pull: { 'twoFactor.recoveryHashes': hash } };
  }
  const step = factor.verifyStep(factor.decrypt(user.twoFactor.secret, user._id), body.code);
  if (step === null || step <= user.twoFactor.lastStep) throw fail(400, 'Invalid or already used code. Wait for a fresh code and try again.');
  return { query: { 'twoFactor.lastStep': { $lt: step } }, set: { 'twoFactor.lastStep': step } };
}
exports.register = wrap(async (req, res) => {
  const { password, dateOfBirth } = req.body;
  const email = text(req.body.email).toLowerCase(), firstname = text(req.body.firstname, 100), lastname = text(req.body.lastname, 100);
  if (!firstname || !lastname || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !passwordValid(password) || !dateOfBirth || !Number.isFinite(Date.parse(dateOfBirth)) || Date.parse(dateOfBirth) > Date.now())
    throw fail(400, 'Enter your name, a valid email and birth date, and a password of 8–72 bytes with an uppercase letter and number.');
  const user = await User.create({ firstname, lastname, email, password, dateOfBirth, phone: text(req.body.phone, 40), role: ['user'] });
  res.status(201).json({ success: true, message: 'Account created. You can sign in now.', data: { id: user._id } });
});
exports.login = wrap(async (req, res) => {
  const email = text(req.body.email).toLowerCase();
  const user = await User.findOne({ email }).select(fields);
  if (!user?.isActive || (user.loginBlockedUntil && user.loginBlockedUntil > new Date())) throw fail(400, 'Invalid credentials or account temporarily unavailable.');
  if (!(await passwordMatches(req.body.password, user.password))) {
    await User.updateOne({ _id: user._id }, [
      { $set: { loginAttempts: { $add: [{ $ifNull: ['$loginAttempts', 0] }, 1] } } },
      { $set: { loginBlockedUntil: { $cond: [{ $gte: ['$loginAttempts', 5] }, new Date(Date.now() + 600000), null] },
        loginAttempts: { $cond: [{ $gte: ['$loginAttempts', 5] }, 0, '$loginAttempts'] } } }
    ], { updatePipeline: true });
    throw fail(400, 'Invalid credentials or account temporarily unavailable.');
  }
  await User.updateOne(versionFilter(user), { $set: { loginAttempts: 0, loginBlockedUntil: null } });
  if (!user.twoFactor.enabled) return res.json({ success: true, ...session(user) });
  factor.key(); // Fail closed if the persistent encryption key is missing.
  const challenge = crypto.randomBytes(32).toString('hex');
  await Challenge.create({ hash: factor.digest(challenge), user: user._id, tokenVersion: user.tokenVersion || 0, expiresAt: new Date(Date.now() + 300000) });
  res.json({ requiresTwoFactor: true, challenge, expiresIn: 300 });
});
exports.verifyFactor = wrap(async (req, res) => {
  if (!/^[a-f0-9]{64}$/.test(text(req.body.challenge, 64))) throw fail(400, 'Sign-in request expired. Start again.');
  const challenge = await Challenge.findOneAndUpdate({ hash: factor.digest(req.body.challenge), expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { new: true });
  if (!challenge) throw fail(400, 'Sign-in request expired or exhausted. Start again.');
  let user = await User.findById(challenge.user).select(fields);
  if (!user?.twoFactor.enabled || !user.isActive || user.tokenVersion !== challenge.tokenVersion) throw fail(400, 'Sign-in request expired. Start again.');
  user = await reserveFactor(user);
  const proof = factorFilter(user, req.body);
  const updated = await User.findOneAndUpdate({ ...versionFilter(user), 'twoFactor.enabled': true, 'twoFactor.secret': user.twoFactor.secret, ...proof.query }, {
    $set: { ...proof.set, 'twoFactor.failures': 0, 'twoFactor.blockedUntil': null }, ...(proof.pull ? { $pull: proof.pull } : {})
  }, { new: true }).select(fields);
  if (!updated) throw fail(400, 'Code already used or security settings changed. Start again.');
  const consumed = await Challenge.deleteOne({ _id: challenge._id, expiresAt: { $gt: new Date() } });
  if (!consumed.deletedCount) throw fail(400, 'Sign-in request already used or expired. Start again.');
  res.json({ success: true, ...session(updated) });
});
exports.factorStatus = wrap(async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactor');
  res.json({ enabled: !!user.twoFactor?.enabled, recoveryCodesRemaining: user.twoFactor?.recoveryHashes?.length || 0 });
});
exports.beginSetup = wrap(async (req, res) => {
  const user = await credentials(req);
  if (user.twoFactor.enabled) throw fail(409, 'Authenticator is already enabled.');
  const secret = factor.createSecret(), setupToken = crypto.randomBytes(32).toString('hex');
  const uri = factor.totp(secret, user.email).toString();
  const qrCode = await QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 2, width: 256 });
  const result = await User.updateOne({ ...versionFilter(user), 'twoFactor.enabled': { $ne: true } }, { $set: {
    'twoFactor.pendingSecret': factor.encrypt(secret, user._id), 'twoFactor.pendingHash': factor.digest(setupToken), 'twoFactor.pendingExpires': new Date(Date.now() + 600000)
  } });
  if (!result.modifiedCount) throw fail(409, 'Security settings changed. Start again.');
  res.json({ secret, uri, qrCode, setupToken, expiresIn: 600 });
});
exports.confirmSetup = wrap(async (req, res) => {
  let user = await User.findById(req.user._id).select(fields);
  user = await reserveFactor(user);
  const tf = user.twoFactor;
  if (tf.enabled || !tf.pendingSecret || !tf.pendingExpires || tf.pendingExpires <= new Date() || factor.digest(text(req.body.setupToken, 64)) !== tf.pendingHash)
    throw fail(400, 'Setup expired. Start a new setup.');
  const step = factor.verifyStep(factor.decrypt(tf.pendingSecret, user._id), req.body.code);
  if (step === null) throw fail(400, 'Invalid authenticator code. Check your device time and try again.');
  const recovery = factor.recoveryCodes();
  const updated = await User.findOneAndUpdate({ ...versionFilter(user), 'twoFactor.enabled': { $ne: true }, 'twoFactor.pendingHash': tf.pendingHash, 'twoFactor.pendingExpires': { $gt: new Date() } }, {
    $set: { 'twoFactor.enabled': true, 'twoFactor.secret': tf.pendingSecret, 'twoFactor.lastStep': step, 'twoFactor.recoveryHashes': recovery.hashes, 'twoFactor.failures': 0, 'twoFactor.blockedUntil': null },
    $unset: { 'twoFactor.pendingSecret': 1, 'twoFactor.pendingHash': 1, 'twoFactor.pendingExpires': 1 }, $inc: { tokenVersion: 1 }
  }, { new: true }).select(fields);
  if (!updated) throw fail(409, 'Setup has already been used or expired.');
  disconnectSessions(user._id);
  res.json({ success: true, recoveryCodes: recovery.codes, ...session(updated) });
});
exports.cancelSetup = wrap(async (req, res) => {
  await User.updateOne({ _id: req.user._id, 'twoFactor.enabled': { $ne: true } }, { $unset: { 'twoFactor.pendingSecret': 1, 'twoFactor.pendingHash': 1, 'twoFactor.pendingExpires': 1 } });
  res.json({ success: true });
});
exports.disableFactor = wrap(async (req, res) => {
  let user = await credentials(req);
  if (!user.twoFactor.enabled) throw fail(409, 'Authenticator is not enabled.');
  user = await reserveFactor(user);
  const proof = factorFilter(user, req.body);
  const updated = await User.findOneAndUpdate({ ...versionFilter(user), password: user.password, 'twoFactor.enabled': true, 'twoFactor.secret': user.twoFactor.secret, ...proof.query }, {
    $set: { twoFactor: { enabled: false, lastStep: -1, recoveryHashes: [], failures: 0, blockedUntil: null } }, $inc: { tokenVersion: 1 }
  }, { new: true }).select(fields);
  if (!updated) throw fail(400, 'Code already used or security settings changed. Start again.');
  disconnectSessions(user._id);
  res.json({ success: true, ...session(updated), message: 'Authenticator disabled. Other sessions have been signed out.' });
});
exports.logout = wrap(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  await Challenge.deleteMany({ user: req.user._id });
  disconnectSessions(req.user._id);
  res.json({ success: true });
});
exports.forgotPassword = wrap(async (req, res) => {
  const user = await User.findOne({ email: text(req.body.email).toLowerCase(), isActive: true });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await User.updateOne({ _id: user._id }, { $set: { resetPasswordToken: factor.digest(token), resetPasswordExpires: new Date(Date.now() + 600000) } });
    const link = `${config.frontendUrl}/reset-password/${token}`;
    sendEmail({ to: user.email, subject: 'Reset your FormaPath password', html: `<h2>Reset your password</h2><p><a href="${link}">Choose a new password</a></p><p>This link expires in ten minutes. Your authenticator protection remains enabled.</p>` }).catch(() => {});
  }
  res.json({ success: true, message: 'If that account exists, a reset link has been sent.' });
});
exports.resetPassword = wrap(async (req, res) => {
  const password = req.body.newPassword || req.body.password;
  if (!passwordValid(password)) throw fail(400, 'Use 8–72 bytes, including an uppercase letter and a number.');
  if (!/^[a-f0-9]{64}$/.test(req.params.token)) throw fail(400, 'Invalid or expired reset link.');
  const user = await User.findOneAndUpdate({ resetPasswordToken: factor.digest(req.params.token), resetPasswordExpires: { $gt: new Date() }, isActive: true }, {
    $set: { password: await bcrypt.hash(password, 10) }, $inc: { tokenVersion: 1 },
    $unset: { resetPasswordToken: 1, resetPasswordExpires: 1, 'twoFactor.pendingSecret': 1, 'twoFactor.pendingHash': 1, 'twoFactor.pendingExpires': 1 }
  }, { new: true });
  if (!user) throw fail(400, 'Invalid or expired reset link.');
  disconnectSessions(user._id);
  res.json({ success: true, message: 'Password updated. Sign in again; your authenticator remains enabled if configured.' });
});
exports.changePassword = wrap(async (req, res) => {
  const user = await credentials(req);
  if (!passwordValid(req.body.newPassword)) throw fail(400, 'Use 8–72 bytes, including an uppercase letter and a number.');
  const updated = await User.updateOne({ ...versionFilter(user), password: user.password }, {
    $set: { password: await bcrypt.hash(req.body.newPassword, 10) }, $inc: { tokenVersion: 1 },
    $unset: { 'twoFactor.pendingSecret': 1, 'twoFactor.pendingHash': 1, 'twoFactor.pendingExpires': 1 }
  });
  if (!updated.modifiedCount) throw fail(409, 'Password changed by another request. Sign in again.');
  disconnectSessions(user._id);
  res.json({ success: true, message: 'Password changed. Sign in again on all devices.' });
});
