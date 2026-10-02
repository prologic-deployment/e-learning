export const environment = {
  production: true,
  // ✅ Real deployment endpoints (nginx serves the built app on :3500; the
  // Node API is a separate host on :3501 and is called cross-origin, so the
  // backend's CORS_ORIGINS must include the :3500 origin).
  apiUrl: 'https://e-learning-backend.prologic.com.tn:3501/api',
  backendUrl: 'https://e-learning-backend.prologic.com.tn:3501'
};
