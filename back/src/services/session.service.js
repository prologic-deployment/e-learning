const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');
function session(user) {
  const role = Array.isArray(user.role) ? user.role[0] : user.role;
  return {
    token: jwt.sign({ id: String(user._id), role, tokenVersion: user.tokenVersion || 0, purpose: 'session' }, config.jwtSecret,
      { algorithm: 'HS256', expiresIn: config.jwtExpiresIn, issuer: 'formapath-api', audience: 'formapath-client' }),
    user: { id: user._id, firstname: user.firstname, lastname: user.lastname, email: user.email, role }
  };
}
async function authenticate(token) {
  const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'formapath-api', audience: 'formapath-client' });
  if (decoded.purpose !== 'session' || typeof decoded.tokenVersion !== 'number') throw new Error('Not a session');
  const user = await User.findById(decoded.id).select('+tokenVersion');
  if (!user?.isActive || decoded.tokenVersion !== (user.tokenVersion || 0)) throw new Error('Session revoked');
  return user;
}
function disconnectSessions(userId) {
  // All authenticated sockets join their account room at connection time.
  global.io?.in(`account:${userId}`).disconnectSockets(true);
}
module.exports = { session, authenticate, disconnectSessions };
