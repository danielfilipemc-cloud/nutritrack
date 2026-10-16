import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {loadStagingApproval} from './staging-safety';
import {assertFreshStagingTarget,assertFreshStagingEmpty} from './fresh-staging-safety';

// Explicit staging credentials only. Never loads .env.local or old fixture accounts.
// No delete/reset/cleanup: synthetic fixtures are retained for evidence and review.
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
type Check={name:string;result:'PASS'|'FAIL'};
async function main(){
 const url=process.env.AURA_STAGING_URL;
 if(!url)throw new Error('AURA_STAGING_URL is required');
 const fresh=process.argv.includes('--fresh-staging');
 const approval=fresh?assertFreshStagingTarget(url,process.env.AURA_FRESH_STAGING_PROJECT):await loadStagingApproval(url); // Must run before any request.
 const publishable=process.env.AURA_STAGING_PUBLISHABLE_KEY,secret=process.env.AURA_STAGING_SECRET_KEY;
 if(!publishable||!secret)throw new Error('Explicit staging publishable/admin credentials required');
 const admin=createClient(url,secret,options),anon=createClient(url,publishable,options);
 if(fresh){
  const orgs=await admin.from('organizations').select('id',{count:'exact',head:true});
  const users=await admin.auth.admin.listUsers({page:1,perPage:1});
  if(orgs.error||users.error)throw new Error('Fresh staging preflight failed; credentials and API bodies omitted');
  assertFreshStagingEmpty(orgs.count,users.data.users.length);
 }
 const run=randomUUID(),org=randomUUID(),otherOrg=randomUUID(),pupil=randomUUID(),secondPupil=randomUUID(),foreignPupil=randomUUID();
 const dir=new URL(`../.aura-integration/staging-${run}/`,import.meta.url);
 await mkdir(dir,{recursive:true});
 const checks:Check[]=[],accounts:{role:string;id:string}[]=[];
 const evidence={run,project_ref:approval.project_ref,synthetic_only:true,started_at:new Date().toISOString(),checks,accounts,organizations:[org,otherOrg],clients:[pupil,secondPupil,foreignPupil],status:'RUNNING'};
 const persist=()=>writeFile(new URL('evidence.json',dir),JSON.stringify(evidence,null,2),{mode:0o600});
 await persist();
 const check=async(name:string,action:()=>Promise<void>)=>{
  try{await action();checks.push({name,result:'PASS'});console.log(`PASS: ${name}`);}
  catch{checks.push({name,result:'FAIL'});throw new Error(`Staging validation failed: ${name}; credentials and API bodies omitted`);}
  finally{await persist();}
 };
 const value=<T>(r:{data:T;error:{code?:string;status?:number}|null}):NonNullable<T>=>{
  if(r.error||r.data===null)throw new Error(`Request failed (${r.error?.code??r.error?.status??'missing data'})`);
  return r.data as NonNullable<T>;
 };
 const ok=(r:{error:unknown})=>assert.equal(r.error,null);
 const rpc=async(client:SupabaseClient,name:string,args:Record<string,unknown>)=>{const result=await client.rpc(name,args);ok(result);return result.data;};
 const denied=async(client:SupabaseClient,name:string,args:Record<string,unknown>)=>assert.equal((await client.rpc(name,args)).error?.code,'42501');
 const actors:Record<string,{id:string;email:string;client:SupabaseClient;token:string}>={};
 try{
  await check('provision confirmed synthetic users through Auth Admin, without emails',async()=>{
   for(const role of ['owner','admin','coach','readOnly','unassigned','student','secondStudent','foreignOwner']){
    const email=`aura-${role.toLowerCase()}-${run}@example.invalid`,password=randomBytes(32).toString('base64url');
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{synthetic:true,aura_test_run:run}});
    if(created.error||!created.data.user)throw new Error('Synthetic account creation failed');
    const id=created.data.user.id;accounts.push({role,id});await persist();
    const client:SupabaseClient=createClient(url,publishable,options);
    const login=await client.auth.signInWithPassword({email,password});
    if(login.error||!login.data.session)throw new Error('Synthetic login failed');
    const token=login.data.session.access_token,claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
    assert.equal(claims.sub,id);assert.equal(claims.role,'authenticated');
    assert.equal(new URL(claims.iss).origin,new URL(url).origin);
    const identity=await client.auth.getUser();assert.equal(identity.data.user?.id,id);assert.equal(identity.error,null);
    actors[role]={id,email,client,token};
   }
  });
  await check('unconfirmed synthetic email cannot sign in',async()=>{
   const email=`aura-unconfirmed-${run}@example.invalid`,password=randomBytes(32).toString('base64url');
   const created=await admin.auth.admin.createUser({email,password,email_confirm:false,app_metadata:{synthetic:true,aura_test_run:run}});
   if(created.error||!created.data.user)throw new Error('Unconfirmed account creation failed');
   accounts.push({role:'unconfirmed',id:created.data.user.id});await persist();
   assert.equal((await anon.auth.signInWithPassword({email,password})).error?.code,'email_not_confirmed');
  });
  await check('seed two isolated synthetic organizations through service role',async()=>{
   ok(await admin.from('organizations').insert([{id:org,name:`Synthetic A ${run}`},{id:otherOrg,name:`Synthetic B ${run}`} ]));
   ok(await admin.from('organization_members').insert([
    ...['owner','admin','coach','readOnly','unassigned'].map(role=>({organization_id:org,user_id:actors[role].id,role:role==='readOnly'||role==='unassigned'?'coach':role})),
    {organization_id:otherOrg,user_id:actors.foreignOwner.id,role:'owner'}]));
   ok(await admin.from('clients').insert([{id:pupil,organization_id:org,full_name:'Synthetic pupil A'},{id:secondPupil,organization_id:org,full_name:'Synthetic pupil A2'},{id:foreignPupil,organization_id:otherOrg,full_name:'Synthetic pupil B'}]));
  });
  const owner=actors.owner.client,coach=actors.coach.client,student=actors.student.client;
  const grant=async(role:string,write:boolean)=>{
   for(const module of ['profile','assessments','followup','schedule'])await rpc(owner,'aura_capability_save',{p_org:org,p_user:actors[role].id,p_module:module,p_enabled:true,p_write:write});
   await rpc(owner,'aura_assignment_save',{p_org:org,p_client:pupil,p_user:actors[role].id,p_enabled:true});
  };
  const createArgs={p_org:org,p_client:pupil,p_date:'2026-01-01',p_weight:80,p_height:null,p_waist:null};
  let assessment:string;
  await check('competency without assignment grants no access',async()=>{
   await rpc(owner,'aura_capability_save',{p_org:org,p_user:actors.coach.id,p_module:'assessments',p_enabled:true,p_write:true});
   await denied(coach,'aura_assessment_create',createArgs);
   assert.equal(value(await coach.from('clients').select('id').eq('id',pupil)).length,0);
  });
  await check('assigned competent professional can create a server-authored assessment',async()=>{
   await grant('coach',true);await grant('readOnly',false);
   assessment=await rpc(coach,'aura_assessment_create',createArgs) as string;
   const rows=value(await coach.from('assessments').select('id,recorded_by,revision,student_visible').eq('id',assessment));
   assert.equal(rows.length,1);assert.equal(rows[0].recorded_by,actors.coach.id);assert.equal(rows[0].student_visible,false);
  });
  await check('owner/admin lack implicit access to measurements; unassigned and other tenant are isolated',async()=>{
   for(const role of ['owner','admin','unassigned','foreignOwner']){
    assert.equal(value(await actors[role].client.from('assessments').select('id').eq('id',assessment)).length,0);
    await denied(actors[role].client,'aura_assessment_create',createArgs);
   }
   assert.equal(value(await coach.from('clients').select('id').eq('id',foreignPupil)).length,0);
   await denied(actors.foreignOwner.client,'aura_assignment_save',{p_org:org,p_client:pupil,p_user:actors.foreignOwner.id,p_enabled:true});
   await denied(actors.admin.client,'aura_capability_save',{p_org:org,p_user:actors.admin.id,p_module:'assessments',p_enabled:true,p_write:true});
  });
  await check('read permission does not grant write and browser cannot bypass the command',async()=>{
   assert.equal(value(await actors.readOnly.client.from('assessments').select('id').eq('id',assessment)).length,1);
   await denied(actors.readOnly.client,'aura_assessment_create',createArgs);
   const direct=await coach.from('assessments').insert({organization_id:org,client_id:pupil,recorded_by:actors.coach.id,assessed_on:'2026-01-01',weight_kg:81});
   assert.equal(direct.error?.code,'42501');
  });
  await check('student invitation binds confirmed identity once without staff membership',async()=>{
   const token=await rpc(owner,'aura_student_invite_create',{p_org:org,p_client:pupil,p_email:actors.student.email});
   await denied(actors.secondStudent.client,'aura_student_invite_accept',{p_token:token});
   assert.equal(await rpc(student,'aura_student_invite_accept',{p_token:token}),pupil);
   await denied(student,'aura_student_invite_accept',{p_token:token});
   const secondToken=await rpc(owner,'aura_student_invite_create',{p_org:org,p_client:secondPupil,p_email:actors.secondStudent.email});
   assert.equal(await rpc(actors.secondStudent.client,'aura_student_invite_accept',{p_token:secondToken}),secondPupil);
   await denied(actors.secondStudent.client,'aura_student_assessments',{p_org:org,p_client:pupil,p_offset:0});
   assert.equal(value(await admin.from('organization_members').select('user_id').eq('user_id',actors.student.id)).length,0);
  });
  await check('followup and schedule require competency and assignment; student sees only own appointment',async()=>{
   await rpc(coach,'aura_followup_save',{p_org:org,p_client:pupil,p_goal:'Synthetic goal',p_status:'active',p_responsible:null,p_review:null,p_revision:0});
   const start=new Date(Date.now()+86400000),end=new Date(start.getTime()+3600000);
   const appointment=await rpc(coach,'aura_appointment_save',{p_org:org,p_id:null,p_client:pupil,p_professional:actors.coach.id,p_kind:'session',p_status:'scheduled',p_start:start.toISOString(),p_end:end.toISOString(),p_revision:0});
   assert.equal(value(await student.from('appointments').select('id').eq('id',appointment)).length,1);
   assert.equal(value(await actors.secondStudent.client.from('appointments').select('id').eq('id',appointment)).length,0);
   await rpc(owner,'aura_capability_save',{p_org:org,p_user:actors.coach.id,p_module:'schedule',p_enabled:false,p_write:false});
   const events=await rpc(coach,'aura_care_history',{p_org:org,p_client:pupil,p_offset:0});assert.equal(events.length,1);assert.equal(events[0].action,'followup_created');
   await denied(coach,'aura_appointment_save',{p_org:org,p_id:appointment,p_client:pupil,p_professional:actors.coach.id,p_kind:'session',p_status:'cancelled',p_start:start.toISOString(),p_end:end.toISOString(),p_revision:1});
  });
  await check('student sees only explicitly published own projection, not raw assessments or another pupil',async()=>{
   assert.equal(value(await student.from('assessments').select('id')).length,0);
   assert.equal((await rpc(student,'aura_student_assessments',{p_org:org,p_client:pupil,p_offset:0})).length,0);
   await denied(student,'aura_student_assessments',{p_org:org,p_client:secondPupil,p_offset:0});
   await denied(student,'aura_student_assessments',{p_org:otherOrg,p_client:foreignPupil,p_offset:0});
   await rpc(coach,'aura_assessment_share',{p_org:org,p_assessment:assessment,p_visible:true,p_revision:1});
   const rows=await rpc(student,'aura_student_assessments',{p_org:org,p_client:pupil,p_offset:0});assert.equal(rows.length,1);
   assert.deepEqual(Object.keys(rows[0]).sort(),['assessed_on','height_cm','id','waist_cm','weight_kg']);
   await denied(student,'aura_assessment_create',createArgs);
  });
  await check('concurrent PostgREST corrections produce one success and HTTP 409',async()=>{
   const args={p_org:org,p_assessment:assessment,p_revision:2,p_date:'2026-01-01',p_weight:79,p_height:null,p_waist:null,p_reason:'Synthetic correction only'};
   const results=await Promise.all([coach.rpc('aura_assessment_correct',args),coach.rpc('aura_assessment_correct',args)]);
   assert.equal(results.filter(r=>!r.error).length,1);const conflict=results.find(r=>r.error);assert.equal(conflict?.error?.code,'PT409');assert.equal(conflict?.status,409);
   assert.equal((await rpc(student,'aura_student_assessments',{p_org:org,p_client:pupil,p_offset:0})).length,0);
   const corrected=results.find(r=>!r.error)?.data;
   await rpc(coach,'aura_assessment_share',{p_org:org,p_assessment:corrected,p_visible:true,p_revision:1});
   assert.equal((await rpc(student,'aura_student_assessments',{p_org:org,p_client:pupil,p_offset:0}))[0].weight_kg,79);
  });
  await check('subject preferences, privacy request and visible export exclude private fields',async()=>{
   await rpc(student,'aura_consent_set',{p_org:org,p_client:pupil,p_purpose:'optional_notifications',p_version:'synthetic-test-v1',p_accepted:false});
   await denied(owner,'aura_consent_set',{p_org:org,p_client:pupil,p_purpose:'optional_notifications',p_version:'synthetic-test-v1',p_accepted:true});
   const request=await rpc(student,'aura_privacy_request_create',{p_org:org,p_client:pupil,p_kind:'export'});
   await rpc(owner,'aura_privacy_review',{p_org:org,p_request:request,p_status:'in_review',p_reference:'Synthetic review only',p_revision:1});
   const exported=await rpc(student,'aura_visible_export',{p_org:org,p_client:pupil});assert.equal(exported.scope,'visible_records_only');
   assert.equal(exported.assessments.length,1);for(const name of ['note','recorded_by','reason','review_reference'])assert.ok(!JSON.stringify(exported).includes(`"${name}"`));
  });
  await check('assignment and competency revocation take effect with unchanged existing JWT',async()=>{
   const token=actors.coach.token;
   await rpc(owner,'aura_assignment_save',{p_org:org,p_client:pupil,p_user:actors.coach.id,p_enabled:false});
   assert.equal(value(await coach.from('assessments').select('id').eq('client_id',pupil)).length,0);await denied(coach,'aura_assessment_create',createArgs);
   await rpc(owner,'aura_assignment_save',{p_org:org,p_client:pupil,p_user:actors.coach.id,p_enabled:true});
   await rpc(owner,'aura_capability_save',{p_org:org,p_user:actors.coach.id,p_module:'assessments',p_enabled:false,p_write:false});
   await denied(coach,'aura_assessment_create',createArgs);assert.equal((await coach.auth.getSession()).data.session?.access_token,token);
  });
  await check('student revocation takes effect with unchanged JWT',async()=>{
   const token=actors.student.token;await rpc(owner,'aura_student_revoke',{p_org:org,p_client:pupil});
   assert.equal(value(await student.from('clients').select('id')).length,0);
   await denied(student,'aura_student_assessments',{p_org:org,p_client:pupil,p_offset:0});await denied(student,'aura_visible_export',{p_org:org,p_client:pupil});
   assert.equal((await student.auth.getSession()).data.session?.access_token,token);
  });
  await check('professional membership removal revokes access with unchanged JWT',async()=>{
   const token=actors.readOnly.token;await rpc(owner,'aura_team_change',{p_org:org,p_user:actors.readOnly.id,p_role:null});
   assert.equal(value(await actors.readOnly.client.from('clients').select('id').eq('id',pupil)).length,0);
   await denied(actors.readOnly.client,'aura_client_permissions',{p_org:org,p_client:pupil});
   assert.equal((await actors.readOnly.client.auth.getSession()).data.session?.access_token,token);
  });
  await check('anonymous and forged JWT cannot invoke protected PostgREST RPC',async()=>{
   assert.ok((await anon.rpc('aura_student_assessments',{p_org:org,p_client:pupil,p_offset:0})).error);
   const parts=actors.coach.token.split('.'),signature=parts[2];parts[2]=(signature[0]==='a'?'b':'a')+signature.slice(1);
   const response=await fetch(`${url}/rest/v1/clients?select=id`,{headers:{apikey:publishable,Authorization:`Bearer ${parts.join('.')}`},signal:AbortSignal.timeout(15000)});
   assert.equal(response.status,401);
  });
  evidence.status='PASS';console.log(`Staging evidence retained: ${dir.pathname}; no cleanup or production operations`);
 }catch(error){evidence.status='FAIL';throw error;}
 finally{await persist();}
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Staging validation failed');process.exitCode=1;});
