const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript');
const failures=[];
const emoji=/\p{Emoji_Presentation}|\uFE0F/u;
function walk(dir){
 for(const name of fs.readdirSync(dir)){
  const file=path.join(dir,name);
  if(fs.statSync(file).isDirectory()){walk(file);continue;}
  const text=fs.readFileSync(file,'utf8');
  if(file.endsWith('.ts')){
   const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
   const visit=node=>{
    if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&emoji.test(node.text))failures.push(file);
    ts.forEachChild(node,visit);
   };
   visit(source);
  }else if(file.endsWith('.html')&&emoji.test(text.replace(/<!--[\s\S]*?-->/g,'')))failures.push(file);
 }
}
walk('src/app');
assert.deepEqual([...new Set(failures)],[],'No emoji literals in application UI text');
const code=ts.transpileModule(fs.readFileSync('src/app/services/system-text.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exported={};new Function('exports',code)(exported);
assert.equal(exported.plainSystemText('Completed '+String.fromCodePoint(0x1f393)),'Completed');
assert.equal(exported.plainSystemText(undefined),'');
const dashboard=fs.readFileSync('src/app/components/pages/dashboard/user-dashboard/user-dashboard.component.html','utf8');
assert.ok(!dashboard.includes('b.badge?.icon'),'Stored icon identifiers must not be rendered as text');
console.log('PASS UI emoji scan, legacy system-message cleanup and badge-icon rendering contract.');
