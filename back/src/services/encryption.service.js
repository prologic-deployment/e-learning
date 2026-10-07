const config = require('../config/env');
const crypto = require('crypto');

/**
 * ✅ AES-256-GCM field encryption (authenticated — tamper-proof, replaces CBC).
 * - Random IV per encryption
 * - 32-byte key derived with scrypt from the app secret
 * - Output format: v2:iv:tag:ciphertext (hex)
 * - Legacy CBC payloads ("iv:ciphertext") remain decryptable so old data stays readable.
 */

const KEY_CACHE = { v2: null, legacy: null };

function deriveKey(secret, salt, len = 32) {
  return crypto.scryptSync(secret, salt, len);
}

function getKeys() {
  if (!KEY_CACHE.v2) {
    KEY_CACHE.v2 = deriveKey(config.encryptionKey, 'el-v2');
    // Legacy key kept ONLY to decrypt old CBC data written before this change
    KEY_CACHE.legacy = deriveKey('default-key-change-me-in-production-32chars', 'salt');
  }
  return KEY_CACHE;
}

function encryptAES(data) {
  try {
    if (!data) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKeys().v2, iv);
    let encrypted = cipher.update(String(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `v2:${iv.toString('hex')}:${tag}:${encrypted}`;
  } catch (error) {
    console.error(' Encryption error:', error.message);
    throw new Error('Encryption failed');
  }
}

function decryptAES(encryptedData) {
  try {
    if (!encryptedData) return null;

    // v2 (GCM) payload
    if (encryptedData.startsWith('v2:')) {
      const [, ivHex, tagHex, encrypted] = encryptedData.split(':');
      const decipher = crypto.createDecipheriv('aes-256-gcm', getKeys().v2, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }

    // Legacy CBC payload ("iv:ciphertext")
    const parts = encryptedData.split(':');
    if (parts.length === 2) {
      const [ivHex, encrypted] = parts;
      const decipher = crypto.createDecipheriv('aes-256-cbc', getKeys().legacy, Buffer.from(ivHex, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }

    throw new Error('Unknown ciphertext format');
  } catch (error) {
    console.error(' Decryption error:', error.message);
    return null; // fail closed but do not crash reads
  }
}

// Raw hash helpers (reset tokens etc.)
function hashSHA256(data) {
  if (!data) return null;
  return crypto.createHash('sha256').update(data).digest('hex');
}

function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function encryptFields(obj, fields) {
  const out = { ...obj };
  fields.forEach(f => { if (out[f]) out[f] = encryptAES(out[f]); });
  return out;
}

function decryptFields(obj, fields) {
  const out = { ...obj };
  fields.forEach(f => {
    if (out[f]) {
      const d = decryptAES(out[f]);
      if (d !== null) out[f] = d;
    }
  });
  return out;
}

module.exports = {
  encryptAES,
  decryptAES,
  encryptFields,
  decryptFields,
  hashSHA256,
  verifySHA256: (data, hash) => hashSHA256(data) === hash,
  generateSecureToken
};
