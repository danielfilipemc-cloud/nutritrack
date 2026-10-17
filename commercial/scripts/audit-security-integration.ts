import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {loadStagingApproval} from './staging-safety';
import {businessToday} from '../lib/care';
function totp(secret:string,time:number){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.replace(/=+$/,''))bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(time/30000)));const hash=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=hash[hash.length-1]&15;return String((hash.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');}
async function main(){
 const url=process.env.AURA_STAGING_URL,key=process.env.AURA_STAGING_PUBLISHABLE_KEY,secret=process.env.AURA_STAGING_SECRET_KEY;if(!url||!key||!secret)throw Error('Explicit test environment required');
 const approval=await loadStagingApproval(url),cloud=process.argv.includes('--cloud');
 if(cloud)assert.ok(url==='https://vgbwmamntjmhzrpvhxzb.supabase.co'&&approval.kind==='cloud'&&process.env.AURA_AUDIT_CLOUD_CONFIRM==='vgbwmamntjmhzrpvhxzb');else assert.ok(url==='http://127.0.0.1:57321'&&approval.kind==='local');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(url,secret,options);
 for(let page=1;;page++){const r=await admin.auth.admin.listUsers({page,perPage:100});assert.equal(r.error,null);assert.ok(r.data.users.every(u=>u.app_metadata.synthetic===true&&u.email?.endsWith('@example.invalid')));if(r.data.users.length<100)break;}
 const run=randomUUID(),org=randomUUID(),foreignOrg=randomUUID(),pupil=randomUUID(),foreignPupil=randomUUID(),other=randomUUID();
 const directory=new URL(`../.aura-integration/audit-${run}/`,import.meta.url);await mkdir(directory,{recursive:true});
 const report={run,scope:cloud?'synthetic-cloud-audit':'synthetic-local-audit',status:'RUNNING',checks:[] as string[],organizations:[org,foreignOrg],accounts:[] as string[],observations:{} as Record<string,unknown>};
 const save=()=>writeFile(new URL('evidence.json',directory),JSON.stringify(report,null,2),{mode:0o600});await save();
 const value=<T extends {data:unknown;error:unknown}>(r:T)=>{assert.equal(r.error,null);return r.data as NonNullable<T['data']>;};
 const check=async(name:string,fn:()=>Promise<void>)=>{await fn();report.checks.push(name);await save();console.log('PASS: '+name);};
 const actors:Record<string,{id:string;email:string;password:string;db:SupabaseClient;token:string}>={};
 try{
  for(const role of ['owner','admin','coach','student','unassigned','revoked','foreign']){
   const email=`aura-audit-${role}-${run}@example.invalid`,password=randomBytes(32).toString('base64url')+'Aa9!';const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{synthetic:true,aura_audit_run:run}});assert.equal(created.error,null);assert.ok(created.data.user);const id=created.data.user.id;report.accounts.push(id);await save();
   const db:SupabaseClient=createClient(url,key,options),login=await db.auth.signInWithPassword({email,password});assert.equal(login.error,null);assert.ok(login.data.session);actors[role]={id,email,password,db,token:login.data.session.access_token};
  }
  value(await admin.from('organizations').insert([{id:org,name:'Synthetic independent audit'},{id:foreignOrg,name:'Synthetic foreign audit'}]));
  value(await admin.from('organization_members').insert(Object.entries(actors).filter(([role])=>role!=='student').map(([role,a])=>({organization_id:role==='foreign'?foreignOrg:org,user_id:a.id,role:role==='owner'||role==='foreign'?'owner':role==='admin'?'admin':'coach'}))));
  value(await admin.from('clients').insert([{id:pupil,organization_id:org,full_name:'Synthetic audit pupil'},{id:other,organization_id:org,full_name:'Synthetic other pupil'},{id:foreignPupil,organization_id:foreignOrg,full_name:'Synthetic foreign audit pupil'}]));
  const owner=actors.owner.db,coach=actors.coach.db,student=actors.student.db,ctx={p_org:org,p_client:pupil};
  const deny=async(db:SupabaseClient,fn:string,args:Record<string,unknown>,code='42501')=>assert.equal((await db.rpc(fn,args)).error?.code,code);
  await check('owner/admin have no implicit measurements; unassigned and foreign actors cannot read private context',async()=>{
   for(const role of ['owner','admin','coach','unassigned','revoked','foreign'])assert.equal(value(await actors[role].db.from('assessments').select('id').eq('client_id',pupil)).length,0);
   for(const role of ['coach','unassigned','revoked','foreign'])await deny(actors[role].db,'aura_privacy_context',ctx);
  });
  for(const role of ['owner','coach','revoked']){for(const module of ['profile','assessments','followup','schedule'])value(await owner.rpc('aura_capability_save',{p_org:org,p_user:actors[role].id,p_module:module,p_enabled:true,p_write:true}));value(await owner.rpc('aura_assignment_save',{...ctx,p_user:actors[role].id,p_enabled:true}));}
  const invite=value(await owner.rpc('aura_student_invite_create',{...ctx,p_email:actors.student.email}));value(await student.rpc('aura_student_invite_accept',{p_token:invite}));
  let pupilRequest='';
  await check('pupil sees only own request; managers see minimal queue without references or author IDs',async()=>{
   value(await owner.rpc('aura_privacy_request_create',{...ctx,p_kind:'export'}));value(await actors.admin.db.rpc('aura_privacy_request_create',{...ctx,p_kind:'erasure'}));pupilRequest=value(await student.rpc('aura_privacy_request_create',{...ctx,p_kind:'erasure'}));
   const own=value(await student.rpc('aura_privacy_context',ctx));assert.equal(own.requests.length,1);assert.equal(own.requests[0].id,pupilRequest);assert.equal(own.can_review,false);
   for(const role of ['owner','admin']){const data=value(await actors[role].db.rpc('aura_privacy_context',ctx));assert.equal(data.requests.length,3);assert.ok(data.requests.every((r:Record<string,unknown>)=>!('requested_by' in r)&&!('review_reference' in r)));}
   await deny(student,'aura_privacy_context',{p_org:org,p_client:other});await deny(actors.foreign.db,'aura_privacy_context',ctx);
  });
  await check('concurrent real privacy reviews yield one success and one HTTP409; internal history stays private',async()=>{
   const args={p_org:org,p_request:pupilRequest,p_status:'in_review',p_revision:1};const responses=await Promise.all([owner.rpc('aura_privacy_review',{...args,p_reference:'Synthetic reference owner'}),actors.admin.db.rpc('aura_privacy_review',{...args,p_reference:'Synthetic reference admin'})]);
   assert.equal(responses.filter(r=>!r.error).length,1);assert.equal(responses.find(r=>r.error)?.status,409);
   const input={...ctx,p_request:pupilRequest};assert.equal(value(await owner.rpc('aura_privacy_review_history',input)).length,1);for(const role of ['student','coach','foreign','unassigned'])await deny(actors[role].db,'aura_privacy_review_history',input);
  });
  await check('membership removal revokes reads and commands immediately with the unchanged access JWT',async()=>{
   const token=actors.revoked.token;value(await owner.rpc('aura_team_change',{p_org:org,p_user:actors.revoked.id,p_role:null}));assert.equal(value(await actors.revoked.db.from('clients').select('id').eq('id',pupil)).length,0);await deny(actors.revoked.db,'aura_assessment_create',{...ctx,p_date:businessToday(),p_weight:80,p_height:null,p_waist:null});assert.equal((await actors.revoked.db.auth.getSession()).data.session?.access_token,token);
  });
  await check('three real measurement batches resume after lost acknowledgement and an intervening assignment revocation',async()=>{
   const link=value(await owner.rpc('aura_nutritrack_link_save',{...ctx,p_subject:'synthetic-audit-'+run,p_active:true}));
   const rows=Array.from({length:120},(_,i)=>{const date=new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10);return {source_record_id:'day:'+date,observed_on:date,weight_kg:80,height_cm:null,waist_cm:90,expected_revision:0};});
   const send=(r:unknown[])=>coach.rpc('aura_nutritrack_import',{...ctx,p_link:link,p_records:r});value(await send(rows.slice(0,50)));assert.ok(value(await send(rows.slice(0,50))).every((r:{status:string})=>r.status==='duplicate'));value(await send(rows.slice(50,100)));
   const token=actors.coach.token;value(await owner.rpc('aura_assignment_save',{...ctx,p_user:actors.coach.id,p_enabled:false}));assert.equal((await send(rows.slice(100))).error?.code,'42501');assert.equal((await coach.auth.getSession()).data.session?.access_token,token);
   value(await owner.rpc('aura_assignment_save',{...ctx,p_user:actors.coach.id,p_enabled:true}));value(await send(rows.slice(100)));assert.equal(value(await coach.from('assessments').select('id').eq('client_id',pupil)).length,120);
   const race=await Promise.all([send([{...rows[0],weight_kg:79,expected_revision:1}]),send([{...rows[0],weight_kg:78,expected_revision:1}])]);assert.equal(race.filter(r=>!r.error).length,1);assert.equal(race.find(r=>r.error)?.status,409);
  });
  let aal2='';
  await check('real TOTP step-up enables policy; old AAL1 and missing-factor sessions cannot execute sensitive commands',async()=>{
   await deny(owner,'aura_security_policy_save',{p_org:org,p_required:true,p_revision:0},'PT403');
   const enrolled=value(await owner.auth.mfa.enroll({factorType:'totp',friendlyName:'Synthetic audit '+run}));const challenge=value(await owner.auth.mfa.challenge({factorId:enrolled.id}));const health=await fetch(url+'/auth/v1/health',{headers:{apikey:key}}),serverTime=new Date(health.headers.get('date')||'').getTime();assert.ok(Number.isFinite(serverTime));
   const verified=value(await owner.auth.mfa.verify({factorId:enrolled.id,challengeId:challenge.id,code:totp(enrolled.totp.secret,serverTime)}));aal2=verified.access_token;
   if(!cloud&&process.argv.includes('--browser-credentials'))await writeFile(new URL('browser.private.json',directory),JSON.stringify({scope:'synthetic-local-security',base_url:'http://127.0.0.1:3187',organization:org,email:actors.owner.email,password:actors.owner.password,totp_secret:enrolled.totp.secret},null,2),{mode:0o600});
   value(await owner.rpc('aura_security_policy_save',{p_org:org,p_required:true,p_revision:0}));
   const response=await fetch(url+'/rest/v1/rpc/aura_privacy_review',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+actors.owner.token,'Content-Type':'application/json'},body:JSON.stringify({p_org:org,p_request:pupilRequest,p_status:'blocked',p_reference:'Synthetic stale session',p_revision:2})});assert.equal(response.status,403);assert.equal((await response.json()).code,'PT403');
   await deny(actors.admin.db,'aura_privacy_review',{p_org:org,p_request:pupilRequest,p_status:'blocked',p_reference:'Synthetic AAL1 admin',p_revision:2},'PT403');
   value(await owner.rpc('aura_privacy_review',{p_org:org,p_request:pupilRequest,p_status:'blocked',p_reference:'Synthetic AAL2 review',p_revision:2}));
   const claims=JSON.parse(Buffer.from(aal2.split('.')[1],'base64url').toString());report.observations.access_token_ttl_seconds=claims.exp-claims.iat;report.observations.aal=claims.aal;
  });
  await check('opt-in MFA gates raw RLS reads and pupil projections, not just command buttons',async()=>{
   assert.equal(value(await owner.from('assessments').select('id').eq('client_id',pupil)).length,121);
   const read=await fetch(url+'/rest/v1/assessments?select=id&client_id=eq.'+pupil,{headers:{apikey:key,Authorization:'Bearer '+actors.owner.token}});assert.equal(read.status,200);assert.deepEqual(await read.json(),[]);
   await deny(student,'aura_privacy_context',ctx,'PT403');await deny(student,'aura_student_assessments',{...ctx,p_offset:0});
  });
  await check('global logout invalidates sensitive database command even with the previous AAL2 JWT',async()=>{
   assert.equal((await owner.auth.signOut({scope:'global'})).error,null);const r=await fetch(url+'/rest/v1/rpc/aura_privacy_review',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+aal2,'Content-Type':'application/json'},body:JSON.stringify({p_org:org,p_request:pupilRequest,p_status:'in_review',p_reference:'Synthetic logged out',p_revision:3})});assert.equal(r.status,403);assert.equal((await r.json()).code,'PT403');
   const read=await fetch(url+'/rest/v1/assessments?select=id&client_id=eq.'+pupil,{headers:{apikey:key,Authorization:'Bearer '+aal2}});assert.equal(read.status,200);assert.deepEqual(await read.json(),[]);
  });
  for(const [role,a] of Object.entries(actors))if(role!=='owner')await a.db.auth.signOut();report.status='PASS';await save();console.log('PASS: audit run '+run+'; no real data or destructive operation.');
 }catch(e){report.status='FAIL';await save();throw e;}
}
void main().catch(e=>{console.error('Audit integration failed; inspect ignored evidence. Error code: '+(e&&typeof e==='object'&&'code' in e?String(e.code):'assertion'));process.exitCode=1;});
