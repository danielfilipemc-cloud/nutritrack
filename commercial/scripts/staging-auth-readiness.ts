import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
async function main(){
 const project=JSON.parse(await readFile(new URL('../.aura-integration/cloud-staging/project.public.json',import.meta.url),'utf8'));
 assert.equal(project.project_ref,'vgbwmamntjmhzrpvhxzb');assert.equal(project.url,'https://vgbwmamntjmhzrpvhxzb.supabase.co');
 assert.ok(typeof project.publishable_key==='string'&&project.publishable_key.startsWith('sb_publishable_'));
 const r=await fetch(project.url+'/auth/v1/settings',{headers:{apikey:project.publishable_key},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const settings=await r.json();
 const boolean=(v:unknown)=>typeof v==='boolean'?v:null;
 const report={scope:'read-only-dedicated-staging-auth',checked_at:new Date().toISOString(),observed:{disable_signup:boolean(settings.disable_signup),mailer_autoconfirm:boolean(settings.mailer_autoconfirm),email_provider:boolean(settings.external?.email),anonymous_provider:boolean(settings.external?.anonymous_users)},
 not_exposed_by_public_settings:['site_url','redirect_allowlist','password_strength','leaked_password_protection','refresh_rotation','session_timeout','jwt_expiry'],
 required_manual_verification:{site_url:'https://aura-business-staging.onrender.com',redirects:['https://aura-business-staging.onrender.com/convite','https://aura-business-staging.onrender.com/convite?aluno=1'],jwt_expiry_seconds:900,minimum_password_length:12,email_confirmation:true,refresh_token_rotation:true,mfa_totp_enroll_and_verify:true}};
 const directory=new URL('../.aura-integration/auth-readiness/',import.meta.url);await mkdir(directory,{recursive:true});await writeFile(new URL('observations.json',directory),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));
}
void main().catch(()=>{console.error('Read-only staging Auth inspection failed. No administrative credentials loaded.');process.exitCode=1;});
