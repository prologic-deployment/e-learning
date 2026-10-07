const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const net=require('node:net');
const crypto=require('node:crypto');
const path=require('node:path');
const {MongoMemoryServer}=require('mongodb-memory-server');
async function freePort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(r=>server.close(r));return port;}
test('real backend starts without Mongoose deprecations and closes on explicit signals',{timeout:180000},async t=>{
 const mongo=await MongoMemoryServer.create();
 try{
  for(const signal of ['SIGINT','SIGTERM'])await t.test(signal,async()=>{
   const port=await freePort();
   const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,NODE_ENV:'test',MONGO_URI:mongo.getUri(),PORT:String(port),CACHE_ENABLED:'false',JWT_SECRET:crypto.randomBytes(48).toString('hex'),ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),TOTP_ENCRYPTION_KEY:crypto.randomBytes(32).toString('base64')},stdio:['ignore','pipe','pipe']});
   let logs='';const exited=once(child,'exit');
   try{
    await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(new Error('Backend did not become ready')),30000);
     const collect=data=>{logs+=data.toString();if(logs.includes('Server started on port')){clearTimeout(timer);resolve();}};
     child.stdout.on('data',collect);child.stderr.on('data',collect);
     child.once('exit',()=>{clearTimeout(timer);reject(new Error('Exited before ready'));});
    });
    const response=await fetch(`http://127.0.0.1:${port}/`);assert.equal(response.status,200);assert.equal((await response.json()).success,true);
    assert.ok(!logs.includes('[MONGOOSE]'),logs);assert.ok(!logs.includes('injected env'),logs);
    child.kill(signal);const [code]=await exited;assert.equal(code,0);assert.ok(logs.includes(`received ${signal}`));assert.ok(logs.includes('Shutdown complete'));
    await assert.rejects(fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(1000)}));
   }finally{if(child.exitCode===null)child.kill('SIGKILL');}
  });
 }finally{await mongo.stop();}
});
