export const environment = {
  // ✅ PRE-PRODUCTION build (ng build --configuration preprod).
  // Behaves like production (optimised, hashed bundles) but points at the
  // pre-production API, where NODE_ENV=preprod enables the login dev code so
  // the OTP is visible on screen during UAT.
  production: true,
  apiUrl: 'https://e-learning-preprod.prologic.com.tn:3501/api',
  backendUrl: 'https://e-learning-preprod.prologic.com.tn:3501'
};
