// Isolated browser fixture only: four complete account-security flows share one IP.
// Deployment limits are unchanged; this process creates its own in-memory database.
process.env.RATE_LIMIT_LOGIN_MAX = '100';
require('./authoring-browser-api.cjs');
