const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const rx=require('rxjs');
const {EventEmitter}=require('node:events');
function fixture(){
 const pending=[],sockets=[];
 const auth={user:null,token:null,currentUser$:new rx.BehaviorSubject(null),getCurrentUser(){return this.user},getToken(){return this.token}};
 const http={get(url){assert.equal(url,'/api/health');const subject=new rx.Subject();pending.push(subject);return subject;}};
 class Socket extends EventEmitter{connect(){this.started=true;}disconnect(){this.closed=true;} }
 const imported=name=>{
  if(name==='@angular/core')return {Injectable:()=>value=>value};
  if(name==='socket.io-client')return {io:(url,options)=>{const socket=new Socket();socket.options=options;sockets.push(socket);return socket;}};
  if(name==='rxjs')return rx;
  if(name.includes('environment'))return {environment:{apiUrl:'/api',backendUrl:''}};
  return {};
 };
 const compiled=ts.transpileModule(fs.readFileSync('src/app/services/socket.service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
 const module={exports:{}};new Function('require','exports','module',compiled)(imported,module.exports,module);
 const service=new module.exports.SocketService(auth,http);let state;service.state$.subscribe(v=>state=v);
 const login=()=>{auth.user={_id:'fixture-user'};auth.token='fixture-token';auth.currentUser$.next(auth.user);};
 return {service,auth,pending,sockets,login,state:()=>state};
}
test('backend unavailable: no socket storm, visible offline state and explicit retry',()=>{
 const f=fixture();f.login();f.service.connect();f.service.connect();assert.equal(f.pending.length,1);
 f.pending[0].error(new Error('ECONNREFUSED'));assert.equal(f.state(),'offline');assert.equal(f.sockets.length,0);
 f.service.connect();assert.equal(f.pending.length,1);
 f.service.retry();assert.equal(f.pending.length,2);f.pending[1].next({ready:true});f.pending[1].complete();
 assert.equal(f.sockets.length,1);assert.equal(f.sockets[0].options.reconnection,false);assert.equal(f.sockets[0].options.auth.token,'fixture-token');
 f.service.connect();assert.equal(f.sockets.length,1);
 f.sockets[0].emit('connect');assert.equal(f.state(),'connected');
 f.sockets[0].emit('disconnect','transport close');assert.equal(f.state(),'offline');assert.ok(f.sockets[0].closed);
 assert.equal(f.pending.length,2);f.service.disconnect();
});
test('logout cancels readiness and token refresh replaces the old socket',()=>{
 const f=fixture();f.login();f.auth.user=null;f.auth.token=null;f.auth.currentUser$.next(null);
 f.pending[0].next({ready:true});assert.equal(f.sockets.length,0);assert.equal(f.state(),'idle');
 f.login();f.pending[1].next({ready:true});f.pending[1].complete();f.sockets[0].emit('connect');
 f.auth.token='replacement-token';f.auth.currentUser$.next(f.auth.user);assert.ok(f.sockets[0].closed);
 f.pending[2].next({ready:true});f.pending[2].complete();assert.equal(f.sockets[1].options.auth.token,'replacement-token');
 f.service.disconnect();assert.ok(f.sockets[1].closed);
});
