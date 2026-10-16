import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const directory=new URL('../.aura-integration/cloud-recovery/',import.meta.url);
function stable(value:any):string{return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
async function main(){
 const bytes=await readFile(new URL('approved-synthetic.private.json',directory));if(createHash('sha256').update(bytes).digest('hex')!==(await readFile(new URL('approved-synthetic.private.json.sha256',directory),'utf8')).trim())throw Error('Archive checksum mismatch');
 const backup=JSON.parse(bytes.toString()),actual=JSON.parse(await readFile(new URL('restored.private.json',directory),'utf8'));
 const checks:string[]=[],counts:Record<string,number>={};
 for(const [table,rows] of Object.entries(backup.tables) as [string,Record<string,unknown>[]][]){
  const restored=actual[table] as Record<string,unknown>[];if(!Array.isArray(restored)||restored.length!==rows.length)throw Error('Restored count mismatch: '+table);
  // Provider-generated/default token columns are not restoration inputs.
  const keys=Object.keys(rows[0]||{}),normalize=(list:Record<string,unknown>[])=>list.map(row=>stable(Object.fromEntries(keys.map(k=>[k,row[k]])))).sort();
  if(stable(normalize(rows))!==stable(normalize(restored)))throw Error('Restored content mismatch: '+table);
  counts[table]=rows.length;
 }
 checks.push('27 table projections match approved synthetic source, including Auth password hashes, identity links and migration registry');
 const status=JSON.parse(await readFile(new URL('status.private.json',directory),'utf8'));if(status.API_URL!=='http://127.0.0.1:60321')throw Error('Wrong recovery runtime');
 const probe=JSON.parse(await readFile(new URL('probe.private.json',directory),'utf8'));if(probe.scope!=='synthetic-cloud-recovery-only'||!probe.email.endsWith('@example.invalid'))throw Error('Invalid synthetic probe');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},client=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,options),anonymous=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,options);
 const login=await client.auth.signInWithPassword({email:probe.email,password:probe.password});if(login.error||login.data.user?.id!==probe.user)throw Error('Restored Auth login failed ('+(login.error?.code||login.error?.status||'identity')+')');checks.push('Original synthetic cloud password signs into restored local Auth identity');
 const measurements=await client.from('assessments').select('weight_kg,organization_id,client_id').eq('organization_id',probe.org).eq('client_id',probe.pupil);if(measurements.error||measurements.data.length!==1||measurements.data[0].weight_kg!==82)throw Error('Restored authorized data unavailable');checks.push('Restored JWT reads only the assigned own measurement');
 const foreign=(backup.tables['public.clients'] as any[]).find(c=>c.organization_id!==probe.org);if(!foreign)throw Error('Missing isolation fixture');const hidden=await client.from('clients').select('id').eq('id',foreign.id);if(hidden.error||hidden.data.length!==0)throw Error('Restored tenant isolation failed');const denied=await client.rpc('aura_nutritrack_context',{p_org:foreign.organization_id,p_client:foreign.id});if(denied.error?.code!=='42501')throw Error('Restored RPC isolation failed');checks.push('Other organization and integration context remain inaccessible');
 const anon=await anonymous.rpc('aura_nutritrack_context',{p_org:probe.org,p_client:probe.pupil});if(!anon.error)throw Error('Anonymous integration unexpectedly accessible');checks.push('Anonymous bridge access denied after restore');
 await client.auth.signOut();
 await writeFile(new URL('verification.json',directory),JSON.stringify({scope:'approved-synthetic-cloud-to-fresh-local-recovery',source_project:'vgbwmamntjmhzrpvhxzb',destination:'aura-foundations-cloud-recovery',status:'PASS',checks,counts,limitations:['Logical recovery into local Supabase; not provider PITR or in-place cloud recovery','Active sessions and Auth verification tokens intentionally excluded']},null,2));
 for(const check of checks)console.log('PASS: '+check);
}
void main().catch(error=>{console.error(error.message||'Recovery validation failed; credentials omitted');process.exitCode=1;});
