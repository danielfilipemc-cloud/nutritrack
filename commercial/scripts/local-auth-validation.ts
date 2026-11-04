import {readFile,mkdir,writeFile,readdir,realpath} from 'node:fs/promises';
import {sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {loadStagingApproval,type StagingApproval} from './staging-safety';
import {assertLocalAuthRuntime,localAuthTarget} from './local-auth-safety';

// No dotenv, fallback cloud target, migration, reset, cleanup or new container.
async function main(){
 const args=process.argv.slice(2);assert.ok(args.length===1&&['--check','--api','--browser'].includes(args[0]),'Use --check, --api or --browser');
 const root=new URL('../.aura-integration/local-runtime/baseline/',import.meta.url);
 const read=async(name:string)=>JSON.parse((await readFile(new URL(name,root),'utf8')).replace(/^\uFEFF/,''));
 const status=await read('status.private.json'),approval=await read('approval.json') as StagingApproval;
 assertLocalAuthRuntime(status,approval,process.env.AURA_LOCAL_AUTH_CONFIRM,process.env);
 const approvalFile=fileURLToPath(new URL('approval.json',root));
 const previous=process.env.AURA_STAGING_APPROVAL_FILE;
 try{process.env.AURA_STAGING_APPROVAL_FILE=approvalFile;await loadStagingApproval(localAuthTarget);}
 finally{if(previous===undefined)delete process.env.AURA_STAGING_APPROVAL_FILE;else process.env.AURA_STAGING_APPROVAL_FILE=previous;}
 const key=status.PUBLISHABLE_KEY||status.ANON_KEY,secret=status.SECRET_KEY||status.SERVICE_ROLE_KEY;
 for(const url of [localAuthTarget+'/auth/v1/health','http://127.0.0.1:57324/api/v1/messages']){
  const r=await fetch(url,{headers:{apikey:key},signal:AbortSignal.timeout(5000)});assert.equal(r.status,200,'Local service unavailable');
 }
 const admin=createClient(localAuthTarget,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 let identities=0;
 for(let page=1;;page++){
  const r=await admin.auth.admin.listUsers({page,perPage:100});assert.equal(r.error,null,'Local identity preflight failed');
  assert.ok(r.data.users.every(u=>u.app_metadata.synthetic===true&&u.email?.endsWith('@example.invalid')),'Non-synthetic identity: stop before mutation');
  identities+=r.data.users.length;if(r.data.users.length<100)break;
 }
 console.log('PASS: exact local target, restore evidence, services and synthetic-only identities ('+identities+')');
 if(args[0]==='--check')return;
 const privateRoot=await realpath(fileURLToPath(new URL('../.aura-integration/',import.meta.url)));
 const privateFile=async(file:string)=>{const resolved=await realpath(file);assert.ok(resolved.startsWith(privateRoot+sep),'Evidence must stay inside ignored runtime');return resolved;};
 if(args[0]==='--browser'){
  const reportFile=await privateFile(process.env.AURA_LOCAL_AUTH_REPORT||'');
  const report=JSON.parse(await readFile(reportFile,'utf8'));
  assert.equal(report.scope,'synthetic-local-auth-validation');assert.equal(report.status,'PASS');assert.equal(report.api_url,localAuthTarget);
  const fixture=await privateFile(report.browser_fixture);
  const account=JSON.parse(await readFile(fixture,'utf8'));assert.equal(account.scope,'synthetic-local-security');assert.equal(account.base_url,'http://127.0.0.1:3187');assert.ok(account.email.endsWith('@example.invalid'));
  const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:localAuthTarget,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key,NEXT_TELEMETRY_DISABLED:'1',AURA_E2E_AUTH:'1',AURA_LOCAL_SECURITY_FILE:fixture};
  try{
   execFileSync(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'build'],{env,cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'pipe',timeout:180000});
   execFileSync(process.execPath,[fileURLToPath(new URL('../node_modules/@playwright/test/cli.js',import.meta.url)),'test','--config','playwright.auth-local.config.cjs','--workers=1'],{env,cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'pipe',timeout:120000});
   await writeFile(reportFile+'.browser.json',JSON.stringify({scope:'synthetic-local-auth-browser',status:'PASS',completed_at:new Date().toISOString()},null,2),{mode:0o600});
   console.log('PASS: real local browser MFA; no screenshots, traces or videos');return;
  }catch{await writeFile(reportFile+'.browser.json',JSON.stringify({scope:'synthetic-local-auth-browser',status:'FAIL'},null,2),{mode:0o600});throw new Error('Local Auth browser failed; credentials and process output omitted');}
 }
 const directory=new URL('../.aura-integration/local-auth-'+randomUUID()+'/',import.meta.url);await mkdir(directory,{recursive:true});
 const report={scope:'synthetic-local-auth-validation',started_at:new Date().toISOString(),api_url:localAuthTarget,status:'RUNNING',checks:[] as string[],browser_fixture:''};
 const save=()=>writeFile(new URL('evidence.json',directory),JSON.stringify(report,null,2),{mode:0o600});await save();
 const env={...process.env,AURA_STAGING_URL:localAuthTarget,AURA_STAGING_PUBLISHABLE_KEY:key,AURA_STAGING_SECRET_KEY:secret,AURA_STAGING_APPROVAL_FILE:approvalFile};
 try{
  for(const [script,extra] of [['auth-local-security.cjs',['--repeat']],['audit-security-integration.ts',['--browser-credentials']]] as const){
   const before=new Set(await readdir(privateRoot));
   // Capture all output: unexpected errors must not print credentials or API payloads.
   execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL(script,import.meta.url)),...extra],{env,cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'pipe',timeout:120000});
   report.checks.push(script);await save();console.log('PASS: '+script);
   if(script==='audit-security-integration.ts'){
    const added=(await readdir(privateRoot)).filter(name=>name.startsWith('audit-')&&!before.has(name));assert.equal(added.length,1,'Exactly one new audit run required');
    const auditRoot=new URL('../.aura-integration/'+added[0]+'/',import.meta.url),audit=JSON.parse(await readFile(new URL('evidence.json',auditRoot),'utf8'));
    assert.equal(audit.status,'PASS');assert.equal(audit.scope,'synthetic-local-audit');report.browser_fixture=fileURLToPath(new URL('browser.private.json',auditRoot));
   }
  }
  report.status='PASS';await save();console.log('PASS: local Auth suites; report '+fileURLToPath(new URL('evidence.json',directory))+'; no cleanup');
 }catch{report.status='FAIL';await save();throw new Error('Local Auth suite failed; inspect ignored per-run evidence, not public payloads');}
}
void main().catch(()=>{console.error('Local Auth validation refused or failed; no credentials logged. Check local runtime, approval and ignored evidence.');process.exitCode=1;});
