import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {loadStagingApproval} from './staging-safety';
import {loadEvolutionWindow} from '../lib/evolution';
import {businessToday} from '../lib/care';

// Explicit local credentials only. No .env fallback, email, deletion or reset.
async function main(){
 const url=process.env.AURA_STAGING_URL;if(!url)throw new Error('Explicit local URL required');
 const approval=await loadStagingApproval(url);
 if(approval.kind!=='local'||approval.project_ref!=='aura-foundations-local')throw new Error('Only the upgraded local foundation runtime is permitted');
 const key=process.env.AURA_STAGING_PUBLISHABLE_KEY,secret=process.env.AURA_STAGING_SECRET_KEY;
 if(!key||!secret)throw new Error('Explicit local credentials required');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(url,secret,options),run=randomUUID(),checks:string[]=[];
 const directory=new URL(`../.aura-integration/evolution-${run}/`,import.meta.url);
 await mkdir(directory,{recursive:true});
 const report={run,scope:'synthetic-local-evolution',checks,accounts:[] as string[],organizations:[] as string[],status:'RUNNING'};
 const save=()=>writeFile(new URL('evidence.json',directory),JSON.stringify(report,null,2),{mode:0o600});
 const value=<T>(result:{data:T;error:unknown})=>{assert.equal(result.error,null);return result.data;};
 const pass=async(name:string,fn:()=>Promise<void>)=>{await fn();checks.push(name);await save();console.log('PASS: '+name);};
 try{
  const actors:{org:string;pupil:string;id:string;client:SupabaseClient;token:string}[]=[];
  for(let i=0;i<2;i++){
   const org=randomUUID(),pupil=randomUUID(),email=`aura-evolution-${i}-${run}@example.invalid`,password=randomBytes(32).toString('base64url');
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{synthetic:true,aura_evolution_run:run}});
   assert.equal(created.error,null);const user=created.data.user;assert.ok(user);
   report.accounts.push(user.id);report.organizations.push(org);await save();
   value(await admin.from('organizations').insert({id:org,name:`Synthetic evolution ${i}`}));
   value(await admin.from('organization_members').insert({organization_id:org,user_id:user.id,role:'owner'}));
   value(await admin.from('clients').insert({id:pupil,organization_id:org,full_name:`Synthetic evolution pupil ${i}`}));
   const client:SupabaseClient=createClient(url,key,options);
   const login=await client.auth.signInWithPassword({email,password});
   assert.equal(login.error,null);const session=login.data.session;assert.ok(session);
   actors.push({org,pupil,id:user.id,client,token:session.access_token});
  }
  const [own,foreign]=actors;
  const rows=Array.from({length:1205},()=>({id:randomUUID(),organization_id:own.org,client_id:own.pupil,recorded_by:own.id,assessed_on:businessToday(),weight_kg:80}));
  // Privileged fixture seeding only; browser writes still use protected RPCs.
  for(let offset=0;offset<rows.length;offset+=200)value(await admin.from('assessments').insert(rows.slice(offset,offset+200)));
  value(await admin.from('assessments').insert({organization_id:foreign.org,client_id:foreign.pupil,recorded_by:foreign.id,assessed_on:businessToday(),weight_kg:70}));
  await pass('seed 1205 synthetic measurements; owner still has no implicit sensitive read',async()=>{
   assert.equal(value(await own.client.from('assessments').select('id').eq('organization_id',own.org))!.length,0);
  });
  for(const actor of actors){
   value(await actor.client.rpc('aura_capability_save',{p_org:actor.org,p_user:actor.id,p_module:'assessments',p_enabled:true,p_write:false}));
   value(await actor.client.rpc('aura_assignment_save',{p_org:actor.org,p_client:actor.pupil,p_user:actor.id,p_enabled:true}));
  }
  const query=()=>own.client.from('assessments').select('id,organization_id,client_id').eq('organization_id',own.org).eq('client_id',own.pupil).is('superseded_at',null).lte('assessed_on',businessToday()).order('assessed_on',{ascending:false}).order('id',{ascending:false});
  const read=async(offset:number,size:number)=>value(await query().range(offset,offset+size-1))!;
  await pass('real PostgREST caps an oversized request at 1000 rows',async()=>{assert.equal(value(await query().limit(2001))!.length,1000);});
  await pass('shared evolution loader retrieves all 1205 without false completeness at 1000',async()=>{
   const partial=await loadEvolutionWindow(read,1000);assert.equal(partial!.rows.length,1000);assert.equal(partial!.more,true);
   const full=await loadEvolutionWindow(read,1400);assert.equal(full!.rows.length,1205);assert.equal(full!.more,false);
   assert.equal(new Set(full!.rows.map(row=>row.id)).size,1205);
   assert.ok(full!.rows.every(row=>row.organization_id===own.org&&row.client_id===own.pupil));
  });
  await pass('foreign competent owner sees own record and zero records from the other organization',async()=>{
   assert.equal(value(await foreign.client.from('assessments').select('id').eq('organization_id',foreign.org))!.length,1);
   assert.equal(value(await foreign.client.from('assessments').select('id').eq('organization_id',own.org))!.length,0);
  });
  await pass('competency revocation blocks the shared loader with the same JWT',async()=>{
   value(await own.client.rpc('aura_capability_save',{p_org:own.org,p_user:own.id,p_module:'assessments',p_enabled:false,p_write:false}));
   assert.deepEqual(await loadEvolutionWindow(read,200),{rows:[],more:false});
   assert.equal((await own.client.auth.getSession()).data.session!.access_token,own.token);
  });
  report.status='PASS';
 }catch{report.status='FAIL';throw new Error('Local evolution validation failed; API bodies and credentials omitted');}
 finally{await save();}
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
