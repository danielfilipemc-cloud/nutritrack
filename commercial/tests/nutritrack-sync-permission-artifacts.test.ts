import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {foundationFixture} from './foundation-fixture';
import {syncPermissionsArtifacts} from '../scripts/nutritrack-sync-permissions-artifacts';
test('offline sync manifest is reproducible and inspections reject missing Auth contract, candidate objects and registry drift',async()=>{
 const a=await syncPermissionsArtifacts(),dir=new URL('../docs/review/nutritrack-sync-permissions/',import.meta.url);
 assert.equal(a.manifest.remoteExecutionAuthorized,false);assert.equal(a.manifest.baseline.length,19);
 assert.deepEqual(JSON.parse(await readFile(new URL('manifest.json',dir),'utf8')),a.manifest);
 assert.equal(await readFile(new URL('preflight.readonly.sql',dir),'utf8'),a.preflight);
 assert.equal(await readFile(new URL('postflight.readonly.sql',dir),'utf8'),a.postflight);
 const f=await foundationFixture();try{
  const before=(await f.db.query('select * from app_private.aura_migrations order by name')).rows;
  let pre=await f.db.exec(a.preflight);assert.equal(pre[1].rows[0].registry_status,'PASS');assert.equal(pre[2].rows[0].auth_contract_status,'STOP');
  await f.db.exec(`alter table auth.users add column is_anonymous boolean;alter table auth.users add column deleted_at timestamptz;alter table auth.users add column banned_until timestamptz;
   create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);create table auth.mfa_factors(user_id uuid,status text,factor_type text);`);
  pre=await f.db.exec(a.preflight);for(const i of [1,2,3,4])assert.equal(Object.values(pre[i].rows[0])[0],'PASS');
  assert.deepEqual((await f.db.query('select * from app_private.aura_migrations order by name')).rows,before);
  await f.db.exec('begin;'+await readFile(new URL('../'+a.manifest.candidatePath,import.meta.url),'utf8')+'commit;');
  pre=await f.db.exec(a.preflight);assert.equal(pre[3].rows[0].candidate_absent_status,'STOP');
  let post=await f.db.exec(a.postflight);assert.equal(post[1].rows[0].registry_status,'STOP');
  // Fixture-only registry entry simulates a future reviewed installer, never cloud.
  await f.db.query('insert into app_private.aura_migrations(name,checksum) values($1,$2)',[a.manifest.proposedRegistryEntry.name,a.manifest.proposedRegistryEntry.checksum]);
  post=await f.db.exec(a.postflight);assert.equal(post[1].rows[0].registry_status,'PASS');
  assert.equal(post[2].rows.length,a.manifest.effects.privateTables);assert.equal(post[3].rows.length,a.manifest.effects.functions);
  assert.equal(post[4].rows.length,a.manifest.effects.triggers);assert.equal(post[5].rows.length,a.manifest.effects.selectPolicies);
  await f.db.exec("update app_private.aura_migrations set checksum='tampered' where name='schema.sql'");post=await f.db.exec(a.postflight);assert.equal(post[1].rows[0].registry_status,'STOP');
 }finally{await f.db.close();}
});
