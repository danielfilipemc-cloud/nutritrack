const fs=require('node:fs');
const assert=require('node:assert/strict');
const {randomUUID,randomBytes,createHmac}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const root=require('node:path').resolve(__dirname,'../.aura-integration/local-runtime/baseline/')+require('node:path').sep;
const status=JSON.parse(fs.readFileSync(root+'status.private.json','utf8'));
assert.equal(status.API_URL,'http://127.0.0.1:57321');assert.equal(status.MAILPIT_URL||status.INBUCKET_URL,'http://127.0.0.1:57324');
const key=status.PUBLISHABLE_KEY||status.ANON_KEY,secret=status.SECRET_KEY||status.SERVICE_ROLE_KEY;
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const make=()=>createClient(status.API_URL,key,options),admin=createClient(status.API_URL,secret,options);
const value=(r,name)=>{if(r.error)throw Object.assign(new Error(name),{code:r.error.code||r.error.status});return r.data;};
const report={scope:'synthetic-local-auth-security',run:randomUUID(),checks:[],accounts:[],observations:{},result:'RUNNING'};
const repeat=process.argv.slice(2);
assert.ok(repeat.length===0||(repeat.length===1&&repeat[0]==='--repeat'),'Only --repeat is supported');
// Rehearsals keep the original evidence and create distinct synthetic accounts.
const output=root+(repeat.length?`auth-security-evidence-${report.run}.json`:'auth-security-evidence.json');
if(fs.existsSync(output))throw new Error('Security run evidence exists; use --repeat to retain it and record a new isolated rehearsal');
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));save();
async function check(name,fn){try{await fn();report.checks.push({name,result:'PASS'});console.log('PASS: '+name);}catch(error){report.checks.push({name,result:'FAIL',error_code:error.code||error.name});throw Object.assign(new Error(name),{code:error.code||error.name});}finally{save();}}
function totp(secret,millis){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const ch of secret.replace(/=+$/,''))bits+=alphabet.indexOf(ch).toString(2).padStart(5,'0');
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(millis/30000)));
 const digest=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=digest[digest.length-1]&15;
 return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
void(async()=>{
 await require('./staging-safety.ts').loadStagingApproval(status.API_URL);
 let mfaAccount,recoveryAccount,client,active;
 await check('provision two confirmed synthetic security accounts, without emails',async()=>{
  for(const role of ['mfa','recovery']){
   const account={role,email:`aura-security-${role}-${report.run}@example.invalid`,password:randomBytes(32).toString('base64url')+'Aa9!'};
   const created=value(await admin.auth.admin.createUser({email:account.email,password:account.password,email_confirm:true,app_metadata:{synthetic:true,aura_security_run:report.run}}),'provision');
   account.id=created.user.id;report.accounts.push({role,id:account.id});if(role==='mfa')mfaAccount=account;else recoveryAccount=account;
  }
  client=make();active=value(await client.auth.signInWithPassword(mfaAccount),'login').session;
  const claims=JSON.parse(Buffer.from(active.access_token.split('.')[1],'base64url').toString());assert.equal(claims.exp-claims.iat,900);report.observations.access_token_ttl_seconds=900;
 });
 await check('fresh JWT containing forged user_metadata does not confer organization authority',async()=>{
  value(await client.auth.updateUser({data:{role:'owner',organization_id:'00000000-0000-0000-0000-000000000010'}}),'metadata update');
  active=value(await client.auth.refreshSession(),'metadata refresh').session;
  const claims=JSON.parse(Buffer.from(active.access_token.split('.')[1],'base64url').toString());assert.equal(claims.user_metadata.role,'owner');
  const denied=await client.rpc('aura_capability_save',{p_org:'00000000-0000-0000-0000-000000000010',p_user:mfaAccount.id,p_module:'assessments',p_enabled:true,p_write:true});assert.equal(denied.error?.code,'42501');
 });
 await check('app_private cannot be selected through exposed PostgREST schemas',async()=>{
  const response=await fetch(status.API_URL+'/rest/v1/foundation_events?select=id',{headers:{apikey:key,Authorization:'Bearer '+active.access_token,'Accept-Profile':'app_private'}});
  assert.equal(response.status,406);assert.equal((await response.json()).code,'PGRST106');
 });
 await check('TOTP enrollment, challenge and verification issue AAL2',async()=>{
  const enrolled=value(await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Synthetic local validation'}),'MFA enroll');
  const challenge=value(await client.auth.mfa.challenge({factorId:enrolled.id}),'MFA challenge');
  const health=await fetch(status.API_URL+'/auth/v1/health');const serverTime=new Date(health.headers.get('date')).getTime();assert.ok(Number.isFinite(serverTime));
  const verified=value(await client.auth.mfa.verify({factorId:enrolled.id,challengeId:challenge.id,code:totp(enrolled.totp.secret,serverTime)}),'MFA verify');
  assert.equal(JSON.parse(Buffer.from(verified.access_token.split('.')[1],'base64url').toString()).aal,'aal2');
  const assurance=value(await client.auth.mfa.getAuthenticatorAssuranceLevel(),'assurance');assert.equal(assurance.currentLevel,'aal2');
  active=value(await client.auth.getSession(),'session').session;
 });
 await check('refresh tokens rotate and global sign-out prevents subsequent refresh',async()=>{
  const before=active.refresh_token;active=value(await client.auth.refreshSession(),'rotate refresh').session;assert.notEqual(active.refresh_token,before);
  const refresh=active.refresh_token,token=active.access_token;value(await client.auth.signOut({scope:'global'}),'global signout');
  const rejected=await make().auth.refreshSession({refresh_token:refresh});assert.ok(rejected.error);assert.match(rejected.error.code,/refresh_token|session/);
  const oldToken=await fetch(status.API_URL+'/rest/v1/organizations?select=id&limit=1',{headers:{apikey:key,Authorization:'Bearer '+token}});
  report.observations.postgrest_status_for_previously_issued_jwt_after_logout=oldToken.status;
  report.observations.logout_note='Refresh revoked. An already-issued access JWT may remain cryptographically valid until expiry; resource permission revocation is tested separately against live membership/link tables.';
 });
 await check('password recovery stays in Mailpit, clamps unapproved redirects and accepts only the new password',async()=>{
  value(await make().auth.resetPasswordForEmail(recoveryAccount.email,{redirectTo:'https://not-approved.example.invalid/reset'}),'recovery email');
  let message;
  for(let attempt=0;attempt<10;attempt++){
   const listed=await (await fetch('http://127.0.0.1:57324/api/v1/messages')).json();
   const entry=listed.messages?.find(m=>m.To?.some(to=>to.Address===recoveryAccount.email));
   if(entry){message=await (await fetch('http://127.0.0.1:57324/api/v1/message/'+entry.ID)).json();break;}
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.ok(message);const html=(message.HTML||message.Text||'').replaceAll('&amp;','&');
  const link=html.match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/)?.[0];assert.ok(link);
  const verifyURL=new URL(link);assert.equal(verifyURL.origin,status.API_URL);assert.equal(new URL(verifyURL.searchParams.get('redirect_to')).origin,'http://127.0.0.1:3187');
  const verified=await fetch(verifyURL,{redirect:'manual'});assert.equal(verified.status,303);
  const destination=new URL(verified.headers.get('location'));assert.equal(destination.origin,'http://127.0.0.1:3187');
  const fragment=new URLSearchParams(destination.hash.slice(1));assert.ok(fragment.get('access_token'));assert.ok(fragment.get('refresh_token'));
  const recovered=make();value(await recovered.auth.setSession({access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token')}),'recovered session');
  const replacement=randomBytes(32).toString('base64url')+'Aa9!';value(await recovered.auth.updateUser({password:replacement}),'password update');
  assert.equal(value(await make().auth.signInWithPassword({email:recoveryAccount.email,password:replacement}),'new password').user.id,recoveryAccount.id);
  assert.equal((await make().auth.signInWithPassword(recoveryAccount)).error?.code,'invalid_credentials');
 });
 report.result='PASS';save();console.log('PASS: real local Auth security checks completed; secrets and mail tokens were not logged');
})().catch(error=>{report.result='FAIL';save();console.error(JSON.stringify({failed_check:error.message,error_code:error.code||error.name}));process.exitCode=1;});
