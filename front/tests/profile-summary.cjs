const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('src/app/services/profile-summary.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const m={exports:{}};new Function('module','exports',code)(m,m.exports);
const {mergeProfileSummary,profilePhotoUrl}=m.exports;
test('profile display fields merge without changing claims or source',()=>{
 const current={id:'a',firstname:'Old',role:'manager',email:'a@test',avatar:'/old.png'};
 const next=mergeProfileSummary(current,{_id:'a',firstname:'New',avatar:'/new.png',role:'admin',token:'secret',password:'secret'});
 assert.deepEqual(next,{...current,firstname:'New',avatar:'/new.png'});assert.equal(current.firstname,'Old');
});
test('late responses cannot resurrect a session or update a different account',()=>{
 const user={id:'b',role:'user'};assert.equal(mergeProfileSummary(user,{_id:'a',avatar:'new'}),user);assert.equal(mergeProfileSummary(null,{id:'a'}),null);assert.equal(mergeProfileSummary(user,{avatar:'new'}),user);
});
test('partial summaries preserve names and support explicit avatar removal',()=>{
 const current={id:'a',firstname:'Sam',avatar:'old'};assert.deepEqual(mergeProfileSummary(current,{id:'a',avatar:null}),{id:'a',firstname:'Sam',avatar:''});
});
test('avatar URLs resolve uploads and reject script, data and stale blob values',()=>{
 assert.equal(profilePhotoUrl('/uploads/avatars/a.png','https://api.test/'),'https://api.test/uploads/avatars/a.png');assert.equal(profilePhotoUrl('uploads/a.png',''),' /uploads/a.png'.trim());assert.equal(profilePhotoUrl('https://cdn.test/a.png',''),'https://cdn.test/a.png');for(const v of ['javascript:alert(1)','data:image/png;base64,x','blob:x','//evil.test/a',null])assert.equal(profilePhotoUrl(v,''),'');
});
