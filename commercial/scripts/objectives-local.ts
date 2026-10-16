import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {loadStagingApproval} from './staging-safety';
import {addDays,businessToday} from '../lib/care';
type Actor={id:string;email:string;password:string;client:SupabaseClient;token:string};
async function main(){
 const args=process.argv.slice(2);assert.ok(!args.length||args.length===1&&args[0]==='--demo-credentials');
 const url=process.env.AURA_STAGING_URL;if(!url)throw new Error('Explicit local URL required');
 const approval=await loadStagingApproval(url);
 if(approval.kind!=='local'||approval.project_ref!=='aura-foundations-local')throw new Error('Only the upgraded dedicated local runtime is permitted');
 const key=process.env.AURA_STAGING_PUBLISHABLE_KEY,secret=process.env.AURA_STAGING_SECRET_KEY;if(!key||!secret)throw new Error('Explicit local credentials required');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(url,secret,options);
 const run=randomUUID(),org=randomUUID(),foreignOrg=randomUUID(),pupil=randomUUID(),foreignPupil=randomUUID();
 const directory=new URL(`../.aura-integration/objectives-${run}/`,import.meta.url);await mkdir(directory,{recursive:true});
 const report={run,status:'RUNNING',scope:'synthetic-local-objectives',checks:[] as string[],accounts:[] as string[],organizations:[org,foreignOrg],clients:[pupil,foreignPupil]};
 const save=()=>writeFile(new URL('evidence.json',directory),JSON.stringify(report,null,2),{mode:0o600});
 const value=<T>(r:{data:T;error:unknown})=>{assert.equal(r.error,null);return r.data;};
 const denied=async(db:SupabaseClient,fn:string,input:Record<string,unknown>,code='42501')=>assert.equal((await db.rpc(fn,input)).error?.code,code);
 const check=async(name:string,fn:()=>Promise<void>)=>{await fn();report.checks.push(name);await save();console.log('PASS: '+name);};
 const actors:Record<string,Actor>={};
 try{
  for(const role of ['owner','coach','reader','student','foreign']){
   const email=`aura-objectives-${role}-${run}@example.invalid`,password=randomBytes(32).toString('base64url');
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{synthetic:true,aura_objectives_run:run}});assert.equal(created.error,null);assert.ok(created.data.user);
   const id=created.data.user.id;report.accounts.push(id);await save();
   const client:SupabaseClient=createClient(url,key,options),login=await client.auth.signInWithPassword({email,password});assert.equal(login.error,null);assert.ok(login.data.session);
   actors[role]={id,email,password,client,token:login.data.session.access_token};
  }
  value(await admin.from('organizations').insert([{id:org,name:'Synthetic objectives demo'},{id:foreignOrg,name:'Synthetic foreign objectives'}]));
  value(await admin.from('organization_members').insert(['owner','coach','reader','foreign'].map(role=>({organization_id:role==='foreign'?foreignOrg:org,user_id:actors[role].id,role:role==='owner'||role==='foreign'?'owner':'coach'}))));
  const name='Aluno fictício — objetivos';value(await admin.from('clients').insert([{id:pupil,organization_id:org,full_name:name},{id:foreignPupil,organization_id:foreignOrg,full_name:'Foreign synthetic pupil'}]));
  const owner=actors.owner.client,coach=actors.coach.client,reader=actors.reader.client,student=actors.student.client,foreign=actors.foreign.client;
  const input={p_org:org,p_client:pupil,p_id:null as string|null,p_title:'Rever presença semanal (exemplo)',p_state:'active',p_due:addDays(businessToday(),7),p_revision:0};
  const rows=async(db:SupabaseClient)=>value(await db.from('client_objectives').select('*').eq('organization_id',org).eq('client_id',pupil))!;
  await check('default management and unassigned identities have no objective access',async()=>{
   for(const actor of [owner,coach,student,foreign]){assert.equal((await rows(actor)).length,0);await denied(actor,'aura_objective_save',input);}
  });
  for(const role of ['coach','reader']){
   for(const module of ['profile','followup'])value(await owner.rpc('aura_capability_save',{p_org:org,p_user:actors[role].id,p_module:module,p_enabled:true,p_write:role==='coach'}));
   value(await owner.rpc('aura_assignment_save',{p_org:org,p_client:pupil,p_user:actors[role].id,p_enabled:true}));
  }
  let goalId:string;
  await check('assigned writer creates a server-versioned objective; browser direct writes stay denied',async()=>{
   goalId=value(await coach.rpc('aura_objective_save',input));assert.ok(goalId);
   const goal=(await rows(coach))[0];assert.equal(goal.revision,1);assert.equal(goal.completed_at,null);assert.equal(goal.title,input.p_title);
   assert.equal((await coach.from('client_objectives').insert({organization_id:org,client_id:pupil,title:'Bypass'})).error?.code,'42501');
   assert.equal((await coach.from('client_objectives').update({title:'Bypass'}).eq('id',goalId)).error?.code,'42501');
   assert.equal((await coach.from('client_objectives').delete().eq('id',goalId)).error?.code,'42501');
  });
  await check('read-only competency permits consultation but no mutation',async()=>{assert.equal((await rows(reader)).length,1);await denied(reader,'aura_objective_save',input);});
  await check('two concurrent real PostgREST edits yield one success and one HTTP409',async()=>{
   const responses=await Promise.all(['A','B'].map(suffix=>coach.rpc('aura_objective_save',{...input,p_id:goalId,p_revision:1,p_title:'Pedido concorrente '+suffix})));
   assert.equal(responses.filter(r=>!r.error).length,1);const conflict=responses.find(r=>r.error)!;assert.equal(conflict.status,409);assert.equal(conflict.error?.code,'PT409');
  });
  await check('closure is server-timestamped and requires explicit reopening without rewriting audit text',async()=>{
   let goal=(await rows(coach))[0];value(await coach.rpc('aura_objective_save',{...input,p_id:goalId,p_revision:goal.revision,p_title:goal.title,p_state:'completed'}));
   goal=(await rows(coach))[0];assert.ok(goal.completed_at);assert.equal(goal.revision,3);
   await denied(coach,'aura_objective_save',{...input,p_id:goalId,p_revision:3,p_title:'Changed while closed'},'22023');
   value(await coach.rpc('aura_objective_save',{...input,p_id:goalId,p_revision:3,p_title:goal.title}));
   const events=value(await coach.rpc('aura_objective_history',{p_org:org,p_client:pupil,p_offset:0})) as Record<string,unknown>[];
   assert.equal(events.length,4);assert.ok(events.some(e=>e.action==='reopened'));assert.ok(events.every(e=>!('title' in e)&&!('actor_id' in e)));
  });
  await check('student projection and foreign organization cannot read staff objectives or bypass export',async()=>{
   const token=value(await owner.rpc('aura_student_invite_create',{p_org:org,p_client:pupil,p_email:actors.student.email}));value(await student.rpc('aura_student_invite_accept',{p_token:token}));
   assert.equal((await rows(student)).length,0);await denied(student,'aura_objective_history',{p_org:org,p_client:pupil,p_offset:0});
   const exported=value(await student.rpc('aura_visible_export',{p_org:org,p_client:pupil}));assert.deepEqual(exported.objectives,[]);
   assert.equal((await rows(foreign)).length,0);await denied(foreign,'aura_objective_save',input);
   const staffExport=value(await reader.rpc('aura_visible_export',{p_org:org,p_client:pupil}));assert.equal(staffExport.objectives.length,1);
  });
  await check('archive retains readable history but blocks edits',async()=>{
   const revision=value(await owner.rpc('aura_client_change',{p_org:org,p_client:pupil,p_name:name,p_archived:true,p_revision:1}));
   assert.equal((await rows(coach)).length,1);await denied(coach,'aura_objective_save',input,'23514');
   value(await owner.rpc('aura_client_change',{p_org:org,p_client:pupil,p_name:name,p_archived:false,p_revision:Number(revision)}));
  });
  await check('assignment revocation blocks reads, history and writes with the unchanged JWT',async()=>{
   value(await owner.rpc('aura_assignment_save',{p_org:org,p_client:pupil,p_user:actors.coach.id,p_enabled:false}));assert.equal((await rows(coach)).length,0);
   await denied(coach,'aura_objective_history',{p_org:org,p_client:pupil,p_offset:0});await denied(coach,'aura_objective_save',input);assert.equal((await coach.auth.getSession()).data.session?.access_token,actors.coach.token);
  });
  if(args.length){
   // Deliberate synthetic demo grants, never a bulk permission backfill.
   for(const module of ['followup','assessments'])value(await owner.rpc('aura_capability_save',{p_org:org,p_user:actors.owner.id,p_module:module,p_enabled:true,p_write:true}));
   value(await owner.rpc('aura_assignment_save',{p_org:org,p_client:pupil,p_user:actors.owner.id,p_enabled:true}));
   value(await owner.rpc('aura_assessment_create',{p_org:org,p_client:pupil,p_date:businessToday(),p_weight:80,p_height:175,p_waist:null}));
   await writeFile(new URL('demo.private.json',directory),JSON.stringify({scope:'synthetic-local-only',email:actors.owner.email,password:actors.owner.password,profile_url:`http://127.0.0.1:3187/alunos/${pupil}?org=${org}`},null,2),{mode:0o600});
   console.log('Synthetic demo credentials retained in ignored '+directory.pathname+'demo.private.json; not printed.');
  }
  report.status='PASS';
 }catch{report.status='FAIL';throw new Error('Local objectives validation failed; credentials and API bodies omitted');}
 finally{await save();}
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
