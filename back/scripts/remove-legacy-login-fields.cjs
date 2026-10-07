// Explicit, idempotent maintenance operation. Back up the database before --apply.
require('dotenv').config({quiet:true});
const mongoose = require('mongoose');
(async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required; no default database is permitted.');
  await mongoose.connect(process.env.MONGO_URI);
  const users=mongoose.connection.collection('users');
  const names=['otp','otpExpires','otpAttempts','otpBlockedUntil'];
  const filter={$or:names.map(name=>({[name]:{$exists:true}}))};
  console.log(`Users with obsolete login fields: ${await users.countDocuments(filter)}`);
  if(process.argv.includes('--apply')) {
    const result=await users.updateMany(filter,{$unset:Object.fromEntries(names.map(name=>[name,'']))});
    console.log(`Removed obsolete fields from ${result.modifiedCount} users. Passwords and authenticators were not changed.`);
  } else console.log('Read-only check. Back up first, then run with --apply to remove obsolete fields.');
  await mongoose.disconnect();
})().catch(()=>{console.error('Migration failed. Check database connectivity/configuration.');process.exit(1);});
