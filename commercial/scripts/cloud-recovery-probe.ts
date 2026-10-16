import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {businessToday} from '../lib/care';
async function main(){
 if(process.env.AURA_STAGING_URL!=='https://vgbwmamntjmhzrpvhxzb.supabase.co'||process.env.AURA_BRIDGE_CLOUD_CONFIRM!=='vgbwmamntjmhzrpvhxzb')throw Error('Only approved synthetic cloud staging allowed');
 const file=new URL('../.aura-integration/cloud-recovery/probe.private.json',import.meta.url);try{await access(file);throw Error('Probe exists; retain evidence');}catch(e:any){if(e.code!=='ENOENT')throw e;}
 const url=process.env.AURA_STAGING_URL,key=process.env.AURA_STAGING_PUBLISHABLE_KEY,secret=process.env.AURA_STAGING_SECRET_KEY;if(!key||!secret)throw Error('Explicit staging credentials required');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(url,secret,options),client=createClient(url,key,options);
 const run=randomUUID(),org=randomUUID(),pupil=randomUUID(),email=`aura-recovery-${run}@example.invalid`,password=randomBytes(32).toString('base64url');
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{synthetic:true,aura_recovery_run:run}});assert.equal(created.error,null);assert.ok(created.data.user);const user=created.data.user.id;
 const ok=(r:{error:unknown})=>assert.equal(r.error,null);
 ok(await admin.from('organizations').insert({id:org,name:'Synthetic cloud recovery probe'}));ok(await admin.from('organization_members').insert({organization_id:org,user_id:user,role:'owner'}));ok(await admin.from('clients').insert({id:pupil,organization_id:org,full_name:'Synthetic recovered pupil'}));ok(await client.auth.signInWithPassword({email,password}));
 for(const module of ['profile','assessments'])ok(await client.rpc('aura_capability_save',{p_org:org,p_user:user,p_module:module,p_enabled:true,p_write:true}));ok(await client.rpc('aura_assignment_save',{p_org:org,p_client:pupil,p_user:user,p_enabled:true}));
 ok(await client.rpc('aura_assessment_create',{p_org:org,p_client:pupil,p_date:businessToday(),p_weight:82,p_height:175,p_waist:null}));
 await mkdir(new URL('../.aura-integration/cloud-recovery/',import.meta.url),{recursive:true});await writeFile(file,JSON.stringify({scope:'synthetic-cloud-recovery-only',run,org,pupil,user,email,password},null,2),{mode:0o600});console.log('PASS: synthetic cloud recovery identity created; credentials stored only in ignored private file');
}
void main().catch(()=>{console.error('Cloud recovery probe failed; credentials omitted');process.exitCode=1;});
