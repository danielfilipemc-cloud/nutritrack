const fs=require('node:fs');
const {randomUUID,randomBytes}=require('node:crypto');
const assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const root=require('node:path').resolve(__dirname,'../.aura-integration/local-runtime/')+require('node:path').sep;
const restoring=process.argv.includes('--verify-restored'),rehearsal=process.argv.includes('--rehearsal');
assert.ok(!rehearsal||restoring,'Rehearsal permits verification only, never provisioning');
const instance=rehearsal?'rehearsal':restoring?'restore':'baseline';
const status=JSON.parse(fs.readFileSync(root+instance+'/status.private.json','utf8').replace(/^\uFEFF/,''));
assert.equal(status.API_URL,rehearsal?'http://127.0.0.1:59321':restoring?'http://127.0.0.1:58321':'http://127.0.0.1:57321');
const key=status.PUBLISHABLE_KEY||status.ANON_KEY,secret=status.SECRET_KEY||status.SERVICE_ROLE_KEY;
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const unwrap=(r,scope)=>{if(r.error)throw new Error(scope+': '+(r.error.code||r.error.status||'request failed'));return r.data;};
const file=root+'baseline/baseline-fixture.private.json';
async function verify(f){
 const checks=[];
 for(const account of f.accounts){
  const db=createClient(status.API_URL,key,options);
  const login=unwrap(await db.auth.signInWithPassword({email:account.email,password:account.password}),'baseline login');
  assert.equal(login.user.id,account.id);assert.ok(login.session.access_token);
  const identity=unwrap(await db.auth.getUser(),'baseline getUser');assert.equal(identity.user.id,account.id);
  const clients=unwrap(await db.from('clients').select('id,organization_id'),'restored tenant RLS');
  assert.equal(clients.length,1);assert.equal(clients[0].organization_id,account.org);
  const foreign=f.accounts.find(other=>other.id!==account.id);
  assert.equal(unwrap(await db.from('clients').select('id').eq('organization_id',foreign.org),'foreign tenant denial').length,0);
  const assessments=unwrap(await db.from('assessments').select('id,note'),'restored assessment RLS');
  assert.equal(assessments.length,account.role==='A'?1:0);
  if(account.role==='A'){assert.equal(assessments[0].id,f.assessment);assert.equal(assessments[0].note,'Synthetic private recovery note');}
  checks.push({account:account.role,auth_login:'PASS',identity:'PASS',tenant_isolation:'PASS',assessment_preservation:'PASS'});
 }
 const report={result:'PASS',scope:restoring?'real-local-supabase-restored-baseline':'real-local-supabase-baseline',api_url:status.API_URL,run:f.run,checks};
 fs.writeFileSync(root+instance+'/baseline-verification.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
void(async()=>{
 if(restoring){await verify(JSON.parse(fs.readFileSync(file,'utf8')));return;}
 if(fs.existsSync(file))throw new Error('Fixture already exists; refusing duplicate provisioning');
 const admin=createClient(status.API_URL,secret,options),f={run:randomUUID(),assessment:randomUUID(),accounts:[]};
 const save=()=>fs.writeFileSync(file,JSON.stringify(f,null,2),{mode:0o600});save();
 for(const role of ['A','B']){
  const account={role,email:`aura-recovery-${role.toLowerCase()}-${f.run}@example.invalid`,password:randomBytes(32).toString('base64url')+'Aa9!',org:randomUUID(),client:randomUUID()};
  const created=unwrap(await admin.auth.admin.createUser({email:account.email,password:account.password,email_confirm:true,app_metadata:{synthetic:true,aura_recovery_run:f.run}}),'synthetic Auth account');
  account.id=created.user.id;f.accounts.push(account);save();
  unwrap(await admin.from('organizations').insert({id:account.org,name:`Synthetic recovery ${role}`}), 'synthetic organization');
  unwrap(await admin.from('organization_members').insert({organization_id:account.org,user_id:account.id,role:'owner'}),'synthetic owner');
  unwrap(await admin.from('clients').insert({id:account.client,organization_id:account.org,full_name:`Synthetic recovery pupil ${role}`}), 'synthetic pupil');
 }
 const a=f.accounts[0],owner=createClient(status.API_URL,key,options);
 unwrap(await owner.auth.signInWithPassword({email:a.email,password:a.password}),'baseline author login');
 unwrap(await owner.from('assessments').insert({id:f.assessment,organization_id:a.org,client_id:a.client,recorded_by:a.id,assessed_on:'2026-01-01',weight_kg:80,note:'Synthetic private recovery note'}),'baseline assessment');
 await verify(f);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
