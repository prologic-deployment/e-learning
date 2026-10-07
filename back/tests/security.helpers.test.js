/**
 * ✅ Security regression tests — auth & content-access helpers.
 * Run with: node tests/security.helpers.test.js
 */
const assert = require("assert");
const crypto = require("crypto");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${name}\n     ${e.message}`);
  }
}

// Load with stubbed env so no real secrets are needed
process.env.NODE_ENV = "development";
process.env.ENCRYPTION_KEY = "test-encryption-key-with-enough-length";

const { stripAnswers } = require("../src/middlewares/auth.middleware");
const {
  encryptAES,
  decryptAES,
  hashSHA256,
  generateSecureToken
} = require("../src/services/encryption.service");

// ============ stripAnswers ============

test("stripAnswers removes correctAnswer from lesson quiz", () => {
  const input = {
    quiz: {
      questions: [
        { texte: "Q1", options: ["a", "b"], correctAnswer: 1 },
        { texte: "Q2", options: ["x", "y", "z"], correctAnswer: 2 }
      ]
    }
  };
  const out = JSON.parse(JSON.stringify(stripAnswers(input)));
  assert.strictEqual(out.quiz.questions[0].correctAnswer, undefined);
  assert.strictEqual(out.quiz.questions[1].correctAnswer, undefined);
  assert.strictEqual(out.quiz.questions[0].texte, "Q1"); // content preserved
});

test("stripAnswers removes correctAnswer from quiz2 and finalExam", () => {
  const input = {
    quiz2: { questions: [{ texte: "A", options: ["1"], correctAnswer: 0 }] },
    finalExam: { questions: [{ texte: "B", options: ["1", "2"], correctAnswer: 1 }] }
  };
  const out = JSON.parse(JSON.stringify(stripAnswers(input)));
  assert.strictEqual(out.quiz2.questions[0].correctAnswer, undefined);
  assert.strictEqual(out.finalExam.questions[0].correctAnswer, undefined);
});

test("stripAnswers handles null/empty input without crashing", () => {
  assert.strictEqual(stripAnswers(null), null);
  assert.deepStrictEqual(stripAnswers({}), {});
});

// ============ encryption.service ============

test("encryptAES/decryptAES round-trips correctly (GCM)", () => {
  const secret = "+216 20 111 111";
  const encrypted = encryptAES(secret);
  assert.ok(encrypted.startsWith("v2:"), "new ciphertext must use v2 GCM format");
  assert.strictEqual(decryptAES(encrypted), secret);
});

test("same plaintext encrypts to different ciphertexts (random IV)", () => {
  const a = encryptAES("hello");
  const b = encryptAES("hello");
  assert.notStrictEqual(a, b);
  assert.strictEqual(decryptAES(a), decryptAES(b));
});

test("tampered ciphertext fails authentication (GCM auth tag)", () => {
  const encrypted = encryptAES("sensitive data");
  const parts = encrypted.split(":");
  // Flip a hex char in the ciphertext portion
  const flipped = parts[3][0] === "0" ? "1" + parts[3].slice(1) : "0" + parts[3].slice(1);
  const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${flipped}`;
  assert.strictEqual(decryptAES(tampered), null, "tampered data must not decrypt");
});

test("legacy CBC ciphertext is still decryptable (migration support)", () => {
  // Build a legacy-format ciphertext with the legacy key
  const legacyKey = crypto.scryptSync("default-key-change-me-in-production-32chars", "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", legacyKey, iv);
  let enc = cipher.update("legacy-phone", "utf8", "hex");
  enc += cipher.final("hex");
  const legacy = `${iv.toString("hex")}:${enc}`;

  assert.strictEqual(decryptAES(legacy), "legacy-phone");
});

test("decryptAES returns null on garbage instead of crashing", () => {
  assert.strictEqual(decryptAES("not-a-valid-format"), null);
  assert.strictEqual(decryptAES(null), null);
  assert.strictEqual(decryptAES(""), null);
});



test("hashSHA256 produces consistent hex digests", () => {
  const h1 = hashSHA256("reset-token-123");
  const h2 = hashSHA256("reset-token-123");
  assert.strictEqual(h1, h2);
  assert.ok(/^[a-f0-9]{64}$/.test(h1));
  assert.notStrictEqual(hashSHA256("other"), h1);
});

// ============ tokenVersion revocation logic ============

test("tokenVersion mismatch detection logic", () => {
  // simulateCheck returns TRUE when the session must be REJECTED
  const simulateCheck = (decoded, user) =>
    typeof decoded.tokenVersion === "number" &&
    decoded.tokenVersion !== (user.tokenVersion || 0);

  // Old token (v0) vs user after password change (v1) → rejected
  assert.strictEqual(simulateCheck({ tokenVersion: 0 }, { tokenVersion: 1 }), true);
  // Current token → accepted (no mismatch)
  assert.strictEqual(simulateCheck({ tokenVersion: 1 }, { tokenVersion: 1 }), false);
  // Legacy token without tokenVersion → accepted (back-compat)
  assert.strictEqual(simulateCheck({}, { tokenVersion: 0 }), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
