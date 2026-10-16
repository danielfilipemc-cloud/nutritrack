import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {loadStagingApproval} from './staging-safety';
import {businessToday} from '../lib/care';
import {parseNutritrackBackup} from '../lib/nutritrack-import';
async function main(){
 const url=process.env.AURA_STAGING_URL,key=process.env.AURA_STAGING_PUBLISHABLE_KEY,secret=process.env.AURA_STAGING_SECRET_KEY;
 if(!url||!key||!secret)throw Error('Explicit staging credentials required; no env file fallback');
 const cloud=process.argv.includes('--cloud');
 if(cloud){if(url!=='https://vgbwmamntjmhzrpvhxzb.supabase.co'||process.env.AURA_BRIDGE_CLOUD_CONFIRM!=='vgbwmamntjmhzrpvhxzb')throw Error('Only explicitly approved dedicated cloud staging is allowed');}
 else{const approval=await loadStagingApproval(url);if(approval.kind!=='local'||approval.project_ref!=='aura-foundations-local')throw Error('Only the synthetic local runtime is allowed');}
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(url,secret,options);
 if(cloud){for(let page=1;;page++){const users=await admin.auth.admin.listUsers({page,perPage:100});if(users.error)throw Error('Staging preflight failed');if(users.data.users.some(u=>u.app_metadata.synthetic!==true||!u.email?.endsWith('@example.invalid')))throw Error('Non-synthetic Auth data found; refusing test');if(users.data.users.length<100)break;}}
 const run=randomUUID(),org=randomUUID(),foreignOrg=randomUUID(),pupil=randomUUID(),foreignPupil=randomUUID();
 const directory=new URL(`../.aura-integration/nutritrack-${run}/`,import.meta.url);await mkdir(directory,{recursive:true});
 const report={run,scope:cloud?'synthetic-cloud-nutritrack':'synthetic-local-nutritrack',status:'RUNNING',checks:[] as string[],accounts:[] as string[],organizations:[org,foreignOrg]};
 const save=()=>writeFile(new URL('evidence.json',directory),JSON.stringify(report,null,2),{mode:0o600});
 const value=<T>(r:{data:T;error:unknown})=>{assert.equal(r.error,null);return r.data as NonNullable<T>;};
 const denied=async(client:SupabaseClient,name:string,args:Record<string,unknown>,code='42501')=>assert.equal((await client.rpc(name,args)).error?.code,code);
 const check=async(name:string,fn:()=>Promise<void>)=>{await fn();report.checks.push(name);await save();console.log('PASS: '+name);};
 const actors:Record<string,{id:string;client:SupabaseClient;token:string}>={};
 try{
  for(const role of ['owner','coach','reader','foreign']){
   const email=`aura-bridge-${role}-${run}@example.invalid`,password=randomBytes(32).toString('base64url');const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{synthetic:true,aura_bridge_run:run}});assert.equal(created.error,null);const user=created.data.user;assert.ok(user);report.accounts.push(user.id);await save();
   const client:SupabaseClient=createClient(url,key,options),login=await client.auth.signInWithPassword({email,password});assert.equal(login.error,null);assert.ok(login.data.session);actors[role]={id:user.id,client,token:login.data.session.access_token};
  }
  value(await admin.from('organizations').insert([{id:org,name:'Synthetic NutriTrack bridge'},{id:foreignOrg,name:'Synthetic foreign bridge'}]));
  value(await admin.from('organization_members').insert(Object.entries(actors).map(([role,a])=>({organization_id:role==='foreign'?foreignOrg:org,user_id:a.id,role:role==='owner'||role==='foreign'?'owner':'coach'}))));
  value(await admin.from('clients').insert([{id:pupil,organization_id:org,full_name:'Synthetic bridge pupil'},{id:foreignPupil,organization_id:foreignOrg,full_name:'Foreign synthetic bridge pupil'}]));
  const owner=actors.owner.client,coach=actors.coach.client,reader=actors.reader.client,foreign=actors.foreign.client;
  const ctx={p_org:org,p_client:pupil};
  await check('no implicit manager access and explicit competency plus assignment required',async()=>{await denied(owner,'aura_nutritrack_context',ctx);for(const role of ['owner','coach','reader']){for(const module of ['profile','assessments'])value(await owner.rpc('aura_capability_save',{p_org:org,p_user:actors[role].id,p_module:module,p_enabled:true,p_write:role!=='reader'}));value(await owner.rpc('aura_assignment_save',{p_org:org,p_client:pupil,p_user:actors[role].id,p_enabled:true}));}});
  const link=value(await owner.rpc('aura_nutritrack_link_save',{...ctx,p_subject:'synthetic-'+run,p_active:true}));
  const rows=parseNutritrackBackup(JSON.stringify({app:'NutriTrack Pro',version:2,data:{weightLog:[{date:businessToday(),weight:81}],bodyMeasurements:[{date:businessToday(),weight:81,waist:90}]}}),businessToday());
  const input={...ctx,p_link:link,p_records:rows};
  await check('only assigned writer imports; reader, foreign tenant and browser table writes are denied',async()=>{
   await denied(reader,'aura_nutritrack_import',input);await denied(foreign,'aura_nutritrack_import',input);await denied(coach,'aura_nutritrack_link_save',{...ctx,p_subject:'other',p_active:true});
   assert.equal((await owner.from('nutritrack_links').update({active:false}).eq('id',link)).error?.code,'42501');
  });
  await check('concurrent identical real API imports create one assessment and one duplicate',async()=>{
   const responses=await Promise.all([coach.rpc('aura_nutritrack_import',input),coach.rpc('aura_nutritrack_import',input)]);const statuses=responses.map(r=>value(r)[0].status).sort();assert.deepEqual(statuses,['created','duplicate']);
   assert.equal(value(await coach.from('assessments').select('id').eq('organization_id',org).eq('client_id',pupil)).length,1);
  });
  await check('source changes require reviewed revision and preserve old versions and provenance',async()=>{
   await denied(coach,'aura_nutritrack_import',{...input,p_records:[{...rows[0],weight_kg:80}]},'PT409');
   value(await coach.rpc('aura_nutritrack_import',{...input,p_records:[{...rows[0],weight_kg:80,expected_revision:1}]}));
   const records=value(await coach.from('assessments').select('id,superseded_at,source_system,source_revision,revision').eq('organization_id',org).eq('client_id',pupil));assert.equal(records.length,2);assert.equal(records.filter(r=>!r.superseded_at).length,1);assert.ok(records.every(r=>r.source_system==='nutritrack'));
   const timeline=value(await coach.rpc('aura_client_timeline',ctx));assert.equal(timeline.items.filter((r:any)=>r.kind==='assessment').length,1);assert.equal(timeline.items.find((r:any)=>r.kind==='assessment').details.source,'nutritrack');
  });
  await check('local correction cannot be silently overwritten and a bad batch rolls back all rows',async()=>{
   const current=value(await coach.from('assessments').select('id,revision').eq('organization_id',org).eq('client_id',pupil).is('superseded_at',null))[0];
   value(await coach.rpc('aura_assessment_correct',{p_org:org,p_assessment:current.id,p_revision:current.revision,p_date:businessToday(),p_weight:79,p_height:null,p_waist:90,p_reason:'Synthetic local correction'}));
   await denied(coach,'aura_nutritrack_import',{...input,p_records:[{...rows[0],weight_kg:78,expected_revision:2}]},'PT409');
   await denied(coach,'aura_nutritrack_import',{...input,p_records:[{...rows[0],source_record_id:'new-day'},{...rows[0],source_record_id:'bad-day',weight_kg:-1}]},'22023');
   assert.equal(value(await coach.from('assessments').select('id').eq('organization_id',org).eq('client_id',pupil)).length,3);
  });
  await check('link revocation blocks imports while preserving history and existing JWT',async()=>{
   value(await owner.rpc('aura_nutritrack_link_save',{...ctx,p_subject:'synthetic-'+run,p_active:false}));await denied(coach,'aura_nutritrack_import',input);assert.equal(value(await reader.rpc('aura_nutritrack_context',ctx)).link.active,false);
   assert.equal((await coach.auth.getSession()).data.session?.access_token,actors.coach.token);
  });
  report.status='PASS';
 }catch{report.status='FAIL';throw Error('NutriTrack integration failed; credentials and API bodies omitted');}finally{await save();}
 console.log('Synthetic evidence retained: '+directory.pathname);
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
