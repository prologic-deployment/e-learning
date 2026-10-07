const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {MongoMemoryServer}=require('mongodb-memory-server');
const mongoose=require('mongoose');
const dotenv=require('dotenv');
const run=(script,env)=>new Promise(resolve=>{
 const p=spawn(process.execPath,[script],{cwd:path.join(__dirname,'..'),env,stdio:['ignore','pipe','pipe']});
 let output='';p.stdout.on('data',s=>output+=s);p.stderr.on('data',s=>output+=s);
 p.on('close',code=>resolve({code,output}));
});
test('Persistent TOTP provisioning preserves keys and refuses replacement of enrolled keys',{timeout:120000},async()=>{
 const mongo=await MongoMemoryServer.create();const dir=await fs.mkdtemp(path.join(os.tmpdir(),'factor-config-'));const file=path.join(dir,'.env');
 const env={...process.env,NODE_ENV:'test',AUTH_ENV_FILE:file,MONGO_URI:mongo.getUri('config_test')};delete env.TOTP_ENCRYPTION_KEY;
 try{
  await fs.writeFile(file,'# Other configuration must survive\nPORT=5000\nTOTP_ENCRYPTION_KEY=\n');
  let result=await run('scripts/configure-totp.cjs',env);assert.equal(result.code,0,result.output);
  let text=await fs.readFile(file,'utf8');const key=dotenv.parse(text).TOTP_ENCRYPTION_KEY;
  assert.equal(Buffer.from(key,'base64').length,32);assert.ok(text.includes('PORT=5000'));assert.ok(!result.output.includes(key));
  assert.equal((await fs.stat(file)).mode&0o777,0o600);
  result=await run('scripts/configure-totp.cjs',env);assert.equal(result.code,0);assert.ok((await fs.readFile(file,'utf8'))===text);
  await fs.writeFile(file,'PORT=5000\nTOTP_ENCRYPTION_KEY=invalid\n');
  result=await run('scripts/configure-totp.cjs',env);assert.equal(result.code,1);assert.ok((await fs.readFile(file,'utf8')).includes('=invalid'));
  await fs.writeFile(file,'PORT=5000\n');await mongoose.connect(env.MONGO_URI);
  await mongoose.connection.collection('users').insertOne({twoFactor:{enabled:true,secret:'stored-encrypted-material'}});
  result=await run('scripts/configure-totp.cjs',env);assert.equal(result.code,1);assert.match(result.output,/ORIGINAL/);assert.ok(!(await fs.readFile(file,'utf8')).includes('TOTP_ENCRYPTION_KEY='));
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('users').insertOne({twoFactor:{pendingSecret:'pending-encrypted-material'}});
  result=await run('scripts/configure-totp.cjs',env);assert.equal(result.code,1);assert.match(result.output,/ORIGINAL/);
  const base={...env,NODE_ENV:'production',JWT_SECRET:crypto.randomBytes(48).toString('hex'),ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex')};
  const validator=path.join(dir,'validate.cjs');await fs.writeFile(validator,`require(${JSON.stringify(path.join(__dirname,'../src/config/env.js'))}).validateEnv();`);
  result=await run(validator,base);assert.equal(result.code,1);assert.match(result.output,/TOTP_ENCRYPTION_KEY/);
  result=await run(validator,{...base,TOTP_ENCRYPTION_KEY:crypto.randomBytes(32).toString('base64')});assert.equal(result.code,0,result.output);
 }finally{await mongoose.disconnect();await mongo.stop();await fs.rm(dir,{recursive:true,force:true});}
});
