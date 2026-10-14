import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {assertStagingTarget,loadStagingApproval,refuseLegacyLiveRunner,type StagingApproval} from '../scripts/staging-safety';
const approval:StagingApproval={project_ref:'abcdefghijklmnopqrst',synthetic_only:true,restore:{verified:true,archive_sha256:'a'.repeat(64),evidence_file:'restore.json',evidence_sha256:'b'.repeat(64)}};
test('staging guard rejects production even when a manifest names it',()=>{
 for(const project_ref of ['vfplbkfxipfictuwkkoe','maipjryehnllaifxhunf'])assert.throws(()=>assertStagingTarget(`https://${project_ref}.supabase.co`,{...approval,project_ref}),/Protected/);
});
test('staging guard requires exact destination and verified synthetic restore',()=>{
 assert.doesNotThrow(()=>assertStagingTarget('https://abcdefghijklmnopqrst.supabase.co',approval));
 for(const url of ['http://abcdefghijklmnopqrst.supabase.co','https://abcdefghijklmnopqrst.supabase.co.evil.invalid','https://abcdefghijklmnopqrst.supabase.co/rest/v1','https://user@abcdefghijklmnopqrst.supabase.co'])assert.throws(()=>assertStagingTarget(url,approval));
 assert.throws(()=>assertStagingTarget('https://abcdefghijklmnopqrst.supabase.co',{...approval,synthetic_only:false} as unknown as StagingApproval));
 assert.throws(()=>assertStagingTarget('https://abcdefghijklmnopqrst.supabase.co',{...approval,restore:{...approval.restore,verified:false}} as unknown as StagingApproval));
});
test('legacy cloud mutators stop before provisioning or cleanup',()=>assert.throws(refuseLegacyLiveRunner,/Legacy live runner disabled/));
test('staging refuses missing approval and a modified restore evidence file',async()=>{
 const previous=process.env.AURA_STAGING_APPROVAL_FILE,dir=await mkdtemp(join(tmpdir(),'aura-staging-guard-'));
 const evidence=join(dir,'restore.json'),manifest=join(dir,'approval.json'),bytes='{"synthetic_restore":"test fixture only"}';
 try{
  delete process.env.AURA_STAGING_APPROVAL_FILE;
  await assert.rejects(loadStagingApproval('https://abcdefghijklmnopqrst.supabase.co'),/explicitly/);
  await writeFile(evidence,bytes);await writeFile(manifest,JSON.stringify({...approval,restore:{...approval.restore,evidence_file:evidence,evidence_sha256:createHash('sha256').update(bytes).digest('hex')}}));
  process.env.AURA_STAGING_APPROVAL_FILE=manifest;
  assert.equal((await loadStagingApproval('https://abcdefghijklmnopqrst.supabase.co')).project_ref,approval.project_ref);
  await writeFile(evidence,'modified synthetic proof');
  await assert.rejects(loadStagingApproval('https://abcdefghijklmnopqrst.supabase.co'),/integrity mismatch/);
 }finally{
  if(previous===undefined)delete process.env.AURA_STAGING_APPROVAL_FILE;else process.env.AURA_STAGING_APPROVAL_FILE=previous;
  await Promise.all([unlink(evidence),unlink(manifest)]);await rmdir(dir);
 }
});
