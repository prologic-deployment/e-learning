/**
 * ONE-SHOT cleanup: removes leftover test artifacts from crashed E2E runs
 * (courses titled "E2E Workflow Course ...") with full cascade, mirroring
 * deleteCourse. Local dev DB only.
 */
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/elearning_pfe').then(async () => {
  const db = mongoose.connection.db;
  const orphans = await db.collection('courses')
    .find({ title: /^E2E Workflow Course/ }).project({ _id: 1 }).toArray();
  const ids = orphans.map(c => c._id);
  if (!ids.length) console.log('No orphaned test courses found.');
  let r = [];
  if (ids.length) {
    r = await Promise.all([
      db.collection('lessons').deleteMany({ course: { $in: ids } }),
      db.collection('enrollments').deleteMany({ course: { $in: ids } }),
      db.collection('purchases').deleteMany({ course: { $in: ids } }),
      db.collection('reviews').deleteMany({ course: { $in: ids } }),
      db.collection('certificates').deleteMany({ course: { $in: ids } }),
      db.collection('courses').deleteMany({ _id: { $in: ids } })
    ]);
    console.log(`Removed ${ids.length} orphaned test course(s):`,
      r.map(x => x.deletedCount).join('/'));
  }

  // ✅ CACHE HYGIENE: direct-Mongo deletes bypass the app's cache
  // invalidation — stale course listings would keep serving dead ids.
  try {
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    const keys = await redis.keys('cache:*');
    if (keys.length) await redis.del(...keys);
    console.log(`Cleared ${keys.length} cache key(s).`);
    redis.disconnect();
  } catch (e) {
    console.log('Cache clear skipped:', e.message);
  }

  await mongoose.disconnect();
}).catch(e => { console.error(e); process.exit(1); });
