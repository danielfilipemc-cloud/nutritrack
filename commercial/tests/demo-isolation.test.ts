import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createDemoStudents,parseDemoAssessment,emptyAssessment} from '../app/demo/experiencia/model';

// Follow the actual module graph (including re-exports), not only direct imports.
// The demo may depend on React and these reviewed presentation/pure modules only.
test('public Premium demo module closure cannot import professional or data adapters',()=>{
 const root=path.resolve(import.meta.dirname,'..');
 const permitted=new Set(['app/layout.tsx','components/AuraBrand.tsx','components/StudentIdentity.tsx','components/ProfileNavigation.tsx','components/ProgressChart.tsx','components/ClientProgressSummary.tsx','lib/nutrition.ts','lib/nutrition-contract.ts','lib/nutrition-demo.ts','lib/care.ts','lib/chart.ts','lib/validation.ts']);
 const visited=new Set<string>();
 function visit(file:string) {
  if(visited.has(file))return;visited.add(file);
  const relative=path.relative(root,file).replaceAll(path.sep,'/');
  assert.ok(relative.startsWith('app/demo/experiencia/')||permitted.has(relative),`Unreviewed dependency in demo: ${relative}`);
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  function walk(node:ts.Node) {
   if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))resolve(node.moduleSpecifier.text);
   if(ts.isCallExpression(node)){
    if(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require'){
     assert.ok(node.arguments[0]&&ts.isStringLiteral(node.arguments[0]),'Dynamic module name is forbidden in demo');
     resolve((node.arguments[0] as ts.StringLiteral).text);
    }
   }
   if(ts.isIdentifier(node))assert.ok(!['fetch','XMLHttpRequest','WebSocket','EventSource','localStorage','sessionStorage','indexedDB','sendBeacon','serviceWorker','process','eval','Function','globalThis','window','document','navigator','Worker','SharedWorker'].includes(node.text),`${relative}: forbidden I/O identifier ${node.text}`);
   ts.forEachChild(node,walk);
  }
  function resolve(specifier:string) {
   if(specifier==='react')return;
   if(specifier.endsWith('.css')){
    const css=readFileSync(path.resolve(path.dirname(file),specifier),'utf8');
    assert.doesNotMatch(css,/@import|url\(\s*['"]?(?:https?:|\/\/)/i,'Demo and layout styles must stay local');return;
   }
   assert.ok(specifier.startsWith('.'),`External module forbidden: ${specifier}`);
   const base=path.resolve(path.dirname(file),specifier);
   const resolved=[base,base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(p=>existsSync(p));
   assert.ok(resolved,`Missing module: ${specifier}`);visit(resolved);
  }
  walk(source);
 }
 visit(path.join(root,'app/demo/experiencia/page.tsx'));
 visit(path.join(root,'app/layout.tsx'));
 for(const name of ['StudentIdentity','ProfileNavigation','ProgressChart','ClientProgressSummary'])assert.ok(visited.has(path.join(root,`components/${name}.tsx`)),`${name} must actually be reused`);
});
test('synthetic students and their histories are independent for every session',()=>{
 const first=createDemoStudents(),second=createDemoStudents();
 first[0].assessments.push({date:'2026-10-20',weight:45,height:null,waist:null});first[0].care.goal='Alteração fictícia';
 assert.equal(second[0].assessments.length,2);assert.notEqual(second[0].care.goal,first[0].care.goal);
 assert.equal(first[1].assessments.length,2);
});
test('demo measurements reject empty, invalid, over-precise and future entries',()=>{
 for(const patch of [{},{weight:'0'},{weight:'501'},{weight:'68.123'},{height:'170.12'},{weight:'Infinity'},{weight:'70',date:'2026-02-30'},{weight:'70',date:'2026-10-21'}])assert.throws(()=>parseDemoAssessment({...emptyAssessment,...patch}));
 assert.deepEqual(parseDemoAssessment({...emptyAssessment,weight:'68.5'}),{date:'2026-10-20',weight:68.5,height:null,waist:null});
 assert.equal(parseDemoAssessment({...emptyAssessment,height:'170.1'}).height,170.1);
});
