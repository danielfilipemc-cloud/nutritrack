import assert from 'node:assert/strict';
const base='https://aura-business-staging.onrender.com';
async function main(){
 const chunks=new Set<string>();
 for(const path of ['/api/health','/','/demo','/demo/aluno-360','/alunos','/agenda','/equipa','/acessos','/aluno','/marca']){
  const r=await fetch(base+path,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);assert.equal(new URL(r.url).origin,base);
  assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.ok(r.headers.get('cache-control')?.includes('no-store'));assert.equal(r.headers.get('x-powered-by'),null);
  const body=await r.text();if(path==='/api/health')assert.equal(JSON.parse(body).status,'ok');
  for(const match of body.matchAll(/src="([^"<>]+\.js[^"<>]*)"/g)){const url=new URL(match[1].replaceAll('&amp;','&'),base);assert.equal(url.origin,base);chunks.add(url.href);}
  console.log('PASS: staging '+path+' and security headers');
 }
 let hasStaging=false;
 for(const url of chunks){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const js=await r.text();
  assert.ok(!/sb_secret_[A-Za-z0-9_-]{20,}/.test(js),'Privileged key-shaped value found in public bundle');
  assert.ok(!/vfplbkfxipfictuwkkoe|maipjryehnllaifxhunf/.test(js),'Protected project found in public bundle');
  if(js.includes('vgbwmamntjmhzrpvhxzb.supabase.co'))hasStaging=true;
 }
 assert.ok(hasStaging,'Frontend must reference the dedicated staging');console.log(`PASS: ${chunks.size} JS assets; staging reference present, protected references/secret-shaped values absent. This is a bounded public asset scan, not a complete secret audit.`);
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Staging smoke failed');process.exitCode=1;});
