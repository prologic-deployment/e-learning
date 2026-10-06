/**
 * E2E test helper — logs in via the OTP flow (DEV_EXPOSE_OTP=true) and
 * returns an authenticated fetch wrapper for a given role account.
 */
const BASE = process.env.API_BASE || 'http://localhost:5000';

async function login(email, password) {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginBody = await loginRes.json();

  const otp = loginBody.devOtp;
  if (!otp) {
    throw new Error(`No devOtp in login response for ${email}: ${JSON.stringify(loginBody).slice(0, 200)}`);
  }

  const verifyRes = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  const verifyBody = await verifyRes.json();
  const token = verifyBody?.data?.token || verifyBody?.token;
  if (!token) {
    throw new Error(`OTP verification failed for ${email}: ${JSON.stringify(verifyBody).slice(0, 200)}`);
  }
  return token;
}

/**
 * Returns a callable: api(method, path, body) → { status, body }
 */
function makeApi(token) {
  return async function api(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let parsed = null;
    const text = await res.text();
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text.slice(0, 200) }; }
    return { status: res.status, body: parsed };
  };
}

const results = [];
function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  results.push({ name, ok, detail: String(detail).slice(0, 300) });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail && !ok ? ` — ${String(detail).slice(0, 300)}` : ''}`);
  return ok;
}

function summary(suiteName) {
  const failed = results.filter(r => !r.ok);
  console.log(`\n===== ${suiteName}: ${results.length - failed.length}/${results.length} passed =====`);
  failed.forEach(f => console.log(`   FAILED: ${f.name} ${f.detail}`));
  return failed.length;
}

module.exports = { login, makeApi, check, summary, BASE };
