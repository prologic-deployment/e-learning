const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  hash: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenVersion: { type: Number, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 }
});
module.exports = mongoose.model('AuthChallenge', schema);
