import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {loadStagingApproval} from './staging-safety';
import {businessToday,addDays} from '../lib/care';

// Deliberately has no env-file fallback, reset, cleanup, or email delivery.
async function main(){
 const url=process.env.AURA_STAGING_URL,key=process.env.AURA_STAGING_PUBLISHABLE_KEY,secret=process.env.AURA_STAGING_SECRET_KEY;
 assert.equal(url,'https://vgbwmamntjmhzrpvhxzb.supabase.co');
 assert.equal(process.env.AURA_DEMO_CONFIRM,'vgbwmamntjmhzrpvhxzb');assert.ok(key&&secret);
 const approval=await loadStagingApproval(url);assert.equal(approval.kind,'cloud');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(url,secret,options);
 for(let page=1;;page++){
  const r=await admin.auth.admin.listUsers({page,perPage:100});assert.equal(r.error,null);
  assert.ok(r.data.users.every(u=>u.app_metadata.synthetic===true&&u.email?.endsWith('@example.invalid')),'Synthetic-only staging required');
  if(r.data.users.length<100)break;
 }
 const run=randomUUID(),org=randomUUID(),pupil=randomUUID(),directory=new URL(`../.aura-integration/online-demo-${run}/`,import.meta.url);
 await mkdir(directory,{recursive:true});
 const manifest={scope:'synthetic-cloud-online-demo',run,base_url:'https://aura-business-staging.onrender.com',organization:org,client:pupil,profile_url:`https://aura-business-staging.onrender.com/alunos/${pupil}?org=${org}`,status:'PROVISIONING',accounts:[] as {role:string;id:string;email:string;password:string}[]};
 const save=()=>writeFile(new URL('credentials.private.json',directory),JSON.stringify(manifest,null,2),{mode:0o600});await save();
 const value=<T>(r:{data:T;error:unknown})=>{if(r.error){const code=(r.error as {code?:string}).code;throw new Error('Backend rejected fixture: '+(code||'unknown'));}return r.data as NonNullable<T>;};
 const clients:Record<string,SupabaseClient>={};
 for(const role of ['manager','coach','student']){
  const email=`aura-demo-${role}-${run}@example.invalid`,password=randomBytes(32).toString('base64url');
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{synthetic:true,aura_online_demo:run}});assert.equal(created.error,null);const user=created.data.user;assert.ok(user);
  manifest.accounts.push({role,id:user.id,email,password});await save();
  const db:SupabaseClient=createClient(url,key,options);const login=await db.auth.signInWithPassword({email,password});assert.equal(login.error,null);assert.ok(login.data.session);clients[role]=db;
 }
 const manager=manifest.accounts[0],coach=manifest.accounts[1],student=manifest.accounts[2];console.log('STEP: accounts ready');
 value(await admin.from('organizations').insert({id:org,name:'AURA Studio — demonstração fictícia'}));
 value(await admin.from('organization_members').insert([{organization_id:org,user_id:manager.id,role:'owner'},{organization_id:org,user_id:coach.id,role:'coach'}]));
 value(await admin.from('clients').insert({id:pupil,organization_id:org,full_name:'Alex — aluno fictício'}));
 for(const module of ['profile','assessments','followup','schedule'])value(await clients.manager.rpc('aura_capability_save',{p_org:org,p_user:coach.id,p_module:module,p_enabled:true,p_write:true}));
 value(await clients.manager.rpc('aura_assignment_save',{p_org:org,p_client:pupil,p_user:coach.id,p_enabled:true}));
 console.log('STEP: permissions ready');const today=businessToday();let latest='';
 for(const [offset,weight] of [[-60,83],[-30,82],[0,81]])latest=value(await clients.coach.rpc('aura_assessment_create',{p_org:org,p_client:pupil,p_date:addDays(today,offset),p_weight:weight,p_height:175,p_waist:90}));
 value(await clients.coach.rpc('aura_assessment_share',{p_org:org,p_assessment:latest,p_visible:true,p_revision:1}));
 const token=value(await clients.manager.rpc('aura_student_invite_create',{p_org:org,p_client:pupil,p_email:student.email}));
 value(await clients.student.rpc('aura_student_invite_accept',{p_token:token}));
 console.log('STEP: student linked and assessment shared');value(await clients.coach.rpc('aura_followup_save',{p_org:org,p_client:pupil,p_goal:'Exemplo fictício de acompanhamento semanal',p_status:'active',p_responsible:null,p_review:today,p_revision:0}));
 value(await clients.coach.rpc('aura_objective_save',{p_org:org,p_client:pupil,p_id:null,p_title:'Rever rotina semanal — demonstração',p_state:'active',p_due:today,p_revision:0}));
 const start=new Date(Date.now()+86400000),end=new Date(start.getTime()+3600000);
 value(await clients.coach.rpc('aura_appointment_save',{p_org:org,p_id:null,p_client:pupil,p_professional:coach.id,p_kind:'session',p_status:'scheduled',p_start:start.toISOString(),p_end:end.toISOString(),p_revision:0}));
 assert.equal(value(await clients.manager.from('assessments').select('id').eq('organization_id',org)).length,0);
 assert.equal(value(await clients.student.from('assessments').select('id')).length,0);
 assert.equal(value(await clients.student.rpc('aura_student_assessments',{p_org:org,p_client:pupil,p_offset:0})).length,1);
 manifest.status='READY';await save();for(const db of Object.values(clients))await db.auth.signOut();
 console.log('PASS: synthetic manager, assigned coach and pupil prepared; private credentials retained outside Git. Run '+run);
}
void main().catch(e=>{console.error(e instanceof Error&&/^Backend rejected fixture: [A-Z0-9a-z]+$/.test(e.message)?e.message:'Staging demo provisioning failed; inspect private partial manifest before retrying. Credentials omitted.');process.exitCode=1;});
