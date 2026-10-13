import assert from "node:assert/strict";
import {existsSync} from "node:fs";
if(existsSync(".env.admin.local"))process.loadEnvFile(".env.admin.local");
const base="https://aura-business-demo.onrender.com";
async function main(){
 const chunks=new Set<string>();
 const secret=process.env.SUPABASE_SECRET_KEY;
 for(const path of ["/api/health","/","/avaliacoes","/marca","/demo"]){
  const response=await fetch(base+path,{signal:AbortSignal.timeout(45000)});
  assert.equal(response.status,200,`${path}: HTTP 200 required`);
  assert.equal(new URL(response.url).origin,base,"Unexpected redirect origin");
  assert.equal(response.headers.get("x-frame-options"),"DENY");
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.ok(response.headers.get("cache-control")?.includes("no-store"));
  assert.equal(response.headers.get("x-powered-by"),null);
  const body=await response.text();
  if(path==="/api/health")assert.equal(JSON.parse(body).status,"ok");else assert.ok(body.includes("AURA"));
  if(secret)assert.ok(!body.includes(secret),"Administrative secret leaked in HTML");
  for(const match of body.matchAll(/src="([^"<>]+\.js[^"<>]*)"/g)){
   const url=new URL(match[1].replaceAll("&amp;","&"),base);
   if(url.origin===base&&url.pathname.startsWith("/_next/"))chunks.add(url.href);
  }
  console.log(`PASS: ${path}, HTTP 200 and security headers`);
 }
 for(const url of chunks){
  const r=await fetch(url,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);
  const js=await r.text();if(secret)assert.ok(!js.includes(secret),"Administrative secret leaked in JS bundle");
 }
 console.log(`PASS: ${chunks.size} public JS bundles served${secret?", local administrative key absent from inspected HTML/JS":"; secret scan skipped (no local administrative key)"}.`);
 console.log("This smoke test does not execute browser interactions or authenticate UI forms.");
}
void main().catch(e=>{console.error(e instanceof Error?e.message:"Deploy smoke failed");process.exitCode=1;});
