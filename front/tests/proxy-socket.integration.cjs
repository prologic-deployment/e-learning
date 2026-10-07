const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http'),net=require('node:net'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {io}=require('socket.io-client');
const {createProxyMiddleware}=require('http-proxy-middleware');
const {MongoMemoryServer}=require('../../back/node_modules/mongodb-memory-server');
async function freePort(){const s=net.createServer().listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;}
function event(emitter,name){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Timed out waiting for '+name)),10000);emitter.once(name,(...args)=>{clearTimeout(timer);resolve(args);});});}
test('real API readiness, authenticated Socket.IO upgrade and backend-down proxy response',{timeout:120000},async()=>{
 const mongo=await MongoMemoryServer.create();const port=await freePort();let child,proxy,socket,anonymous;
 const env={...process.env,NODE_ENV:'test',PORT:String(port),MONGO_URI:mongo.getUri(),CACHE_ENABLED:'false',JWT_SECRET:crypto.randomBytes(48).toString('hex'),ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),TOTP_ENCRYPTION_KEY:crypto.randomBytes(32).toString('base64')};
 try{
  child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'../../back'),env,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{let logs='';const timer=setTimeout(()=>reject(new Error('Backend startup timed out')),30000);const collect=data=>{logs+=data;if(logs.includes('Server started on port')){clearTimeout(timer);resolve();}};child.stdout.on('data',collect);child.stderr.on('data',collect);child.once('exit',()=>{clearTimeout(timer);reject(new Error('Backend exited before ready'));});});
  process.env.API_PROXY_TARGET='http://127.0.0.1:'+port;
  const config=require('../proxy.conf.cjs');
  const api=createProxyMiddleware('/api',config['/api']),ws=createProxyMiddleware('/socket.io',config['/socket.io']);
  proxy=http.createServer((req,res)=>api(req,res,()=>ws(req,res,()=>{res.writeHead(404);res.end();})));
  proxy.on('upgrade',ws.upgrade);proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
  const origin='http://127.0.0.1:'+proxy.address().port;
  const health=await fetch(origin+'/api/health');assert.equal(health.status,200);assert.deepEqual(await health.json(),{ready:true});assert.equal(health.headers.get('cache-control'),'no-store');
  const post=(url,body)=>fetch(origin+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const user={email:'socket@example.test',firstname:'Fixture',lastname:'Only',dateOfBirth:'1990-01-01',password:'FixturePassword123!'};
  assert.equal((await post('/api/auth/register',user)).status,201);
  const session=await (await post('/api/auth/login',user)).json();assert.ok(session.token);
  anonymous=io(origin,{autoConnect:false,reconnection:false,transports:['websocket']});
  const denied=event(anonymous,'connect_error');anonymous.connect();await denied;assert.equal(anonymous.connected,false);anonymous.disconnect();
  socket=io(origin,{auth:{token:session.token},autoConnect:false,reconnection:false,transports:['polling','websocket']});
  const connected=event(socket,'connect');socket.connect();await connected;
  if(socket.io.engine.transport.name!=='websocket')await event(socket.io.engine,'upgrade');
  assert.equal(socket.io.engine.transport.name,'websocket');socket.emit('register',session.user._id);
  // Doctor exercises the same running server and transport, using an environment-only test key.
  const doctor=spawn(process.execPath,['scripts/doctor.cjs'],{cwd:path.resolve(__dirname,'../../back'),env,stdio:['ignore','pipe','pipe']});let doctorOutput='';doctor.stdout.on('data',s=>doctorOutput+=s);doctor.stderr.on('data',s=>doctorOutput+=s);
  const [doctorCode]=await once(doctor,'exit');assert.equal(doctorCode,0);assert.match(doctorOutput,/Socket.IO transport reachable/);
  const disconnected=event(socket,'disconnect'),exited=once(child,'exit');child.kill('SIGTERM');await disconnected;await exited;
  const offline=await fetch(origin+'/api/health');assert.equal(offline.status,503);assert.equal((await offline.json()).code,'DEV_BACKEND_UNAVAILABLE');
 }finally{
  anonymous?.disconnect();socket?.disconnect();
  if(child && child.exitCode===null){const exited=once(child,'exit');child.kill('SIGKILL');await exited;}
  if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}
  await mongo.stop();
 }
});
