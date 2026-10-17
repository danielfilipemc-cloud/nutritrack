import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {loadStagingApproval} from './staging-safety';
async function main(){
 const url=process.env.AURA_STAGING_URL,secret=process.env.AURA_STAGING_SECRET_KEY,user=process.env.AURA_RECOVERY_PROBE_USER;
 assert.equal(url,'https://vgbwmamntjmhzrpvhxzb.supabase.co');assert.equal(process.env.AURA_AUDIT_CLOUD_CONFIRM,'vgbwmamntjmhzrpvhxzb');assert.ok(secret&&user);assert.equal((await loadStagingApproval(url)).kind,'cloud');
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),identity=await admin.auth.admin.getUserById(user);assert.equal(identity.error,null);const actor=identity.data.user;
 assert.ok(actor?.app_metadata.synthetic===true);const email=actor.email;
 assert.ok(email&&email.startsWith('aura-audit-unassigned-')&&email.endsWith('@example.invalid'));
 // Generates a token for this unassigned synthetic identity only. No email is sent,
 // no token is consumed, and the action link/token is never logged or persisted.
 const generated=await admin.auth.admin.generateLink({type:'recovery',email});assert.equal(generated.error,null);assert.ok(generated.data.properties.action_link);
 const target=new URL(generated.data.properties.action_link).searchParams.get('redirect_to');assert.ok(target);const origin=new URL(target).origin,expected='https://aura-business-staging.onrender.com';
 const report={scope:'synthetic-staging-recovery-link-configuration',checked_at:new Date().toISOString(),default_recovery_redirect_origin:origin,expected_origin:expected,matches:origin===expected,email_delivered:false,token_consumed:false};
 const directory=new URL('../.aura-integration/auth-readiness/',import.meta.url);await mkdir(directory,{recursive:true});await writeFile(new URL('recovery-link-observation.json',directory),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));
 if(!report.matches)process.exitCode=1;
}
void main().catch(()=>{console.error('Synthetic recovery configuration probe failed; identity and token omitted.');process.exitCode=1;});
