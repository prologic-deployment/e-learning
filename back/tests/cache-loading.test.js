const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const singleton=require('../src/config/redis.config');
const {RedisClient}=singleton;
const {cache}=require('../src/middlewares/cache.middleware');
class FakeRedis extends EventEmitter {
  constructor(options){super();this.options=options;this.status='wait';}
  async connect(){this.status='ready';this.emit('ready');}
  disconnect(){this.status='end';this.emit('end');}
}
test('ready listener registered before connect; disconnected client is never exposed',async()=>{
 const wrapper=new RedisClient(FakeRedis);await wrapper.connect();assert.ok(wrapper.getClient());
 assert.equal(wrapper.client.options.enableOfflineQueue,false);assert.equal(wrapper.client.options.maxRetriesPerRequest,0);
 wrapper.client.status='reconnecting';wrapper.client.emit('reconnecting');assert.equal(wrapper.getClient(),null);
 await wrapper.disconnect();assert.equal(wrapper.client,null);
});
test('absent cache falls through immediately',async()=>{
 let next=0;const old=singleton.getClient;singleton.getClient=()=>null;
 try{await cache()({method:'GET'}, {},()=>next++);assert.equal(next,1);}finally{singleton.getClient=old;}
});
test('cache read failure falls back to the real handler',async()=>{
 const old=singleton.getClient;singleton.getClient=()=>({get:async()=>{throw new Error('isolated cache fault');}});let next=0;
 try{await cache()({method:'GET',url:'/test'}, {},()=>next++);assert.equal(next,1);}finally{singleton.getClient=old;}
});
test('cache write that never resolves does not hold application response',async()=>{
 const old=singleton.getClient;singleton.getClient=()=>({get:async()=>null,setex:()=>new Promise(()=>{})});
 let sent;const res={statusCode:200,json(data){sent=data;return this;}};
 try{await cache()({method:'GET',url:'/test'},res,()=>{});assert.equal(res.json({real:'response'}),res);assert.deepEqual(sent,{real:'response'});}finally{singleton.getClient=old;}
});
test('cache hit returns data without calling application handler',async()=>{
 const old=singleton.getClient;singleton.getClient=()=>({get:async()=>JSON.stringify({items:[]})});let body;
 const res={status(){return this;},json(value){body=value;}};
 try{await cache()({method:'GET',url:'/test'},res,()=>assert.fail('unexpected handler'));assert.deepEqual(body.items,[]);assert.equal(body._cache.hit,true);}finally{singleton.getClient=old;}
});
