import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {foundationFixture} from './foundation-fixture';
import {baseline17} from './nutrition-db-fixture';
import {nutritionActivationArtifacts} from '../scripts/nutrition-activation-artifacts';

test('offline activation artifacts are reproducible, read only and distinguish baseline 17 from candidate 19',async()=>{
 const artifacts=await nutritionActivationArtifacts(),folder=new URL('../docs/review/nutrition-activation/',import.meta.url);
 assert.deepEqual(JSON.parse(await readFile(new URL('migration-manifest.json',folder),'utf8')),artifacts.manifest);
 assert.equal(await readFile(new URL('preflight.readonly.sql',folder),'utf8'),artifacts.preflight);
 assert.equal(await readFile(new URL('postflight.readonly.sql',folder),'utf8'),artifacts.postflight);
 assert.equal(artifacts.manifest.remoteExecutionAuthorized,false);assert.equal(artifacts.manifest.migrations.length,19);
 const fixtures=JSON.parse(await readFile(new URL('synthetic-fixtures.proposed.json',folder),'utf8'));
 assert.equal(fixtures.projectRef,artifacts.manifest.projectRef);assert.equal(fixtures.codeSha,artifacts.manifest.codeSha);assert.equal(fixtures.privateBindingRequired,true);assert.equal(fixtures.privateBindingSha256,null);assert.equal(fixtures.remoteExecutionAuthorized,false);assert.equal(fixtures.realDataAllowed,false);assert.equal(fixtures.physicalCleanupAuthorized,false);
 for(const actor of fixtures.actors){assert.equal(actor.userId,undefined);assert.equal(actor.password,undefined);assert.equal(actor.accessToken,undefined);}
 for(const source of [artifacts.preflight,artifacts.postflight]){assert.match(source,/begin transaction read only;/);assert.match(source,/rollback;/);assert.doesNotMatch(source,/^\s*(insert|update|delete|create|alter|drop|grant|revoke|truncate)\b/im);}
 const f=await foundationFixture(baseline17);try{
  const before=(await f.db.query('select * from app_private.aura_migrations order by name')).rows;
  const baseline=await f.db.exec(artifacts.preflight),wrong=await f.db.exec(artifacts.postflight);
  assert.equal((baseline[1].rows[0] as {registry_status:string}).registry_status,'PASS');assert.equal((wrong[1].rows[0] as {registry_status:string}).registry_status,'STOP');
  assert.deepEqual((await f.db.query('select * from app_private.aura_migrations order by name')).rows,before);
 }finally{await f.db.close();}
 const full=await foundationFixture();try{
  const inspected=await full.db.exec(artifacts.postflight);assert.equal((inspected[1].rows[0] as {registry_status:string}).registry_status,'PASS');
  await full.db.exec("update app_private.aura_migrations set checksum='tampered' where name='schema.sql'");const drift=await full.db.exec(artifacts.postflight);assert.equal((drift[1].rows[0] as {registry_status:string}).registry_status,'STOP');
 }finally{await full.db.close();}
});
test('installed nutrition grants expose only five invoker RPCs and reviewed private implementations',async()=>{
 const {db}=await foundationFixture();try{
  const functions=(await db.query<{schema:string;name:string;definer:boolean;config:string[];anon:boolean;authenticated:boolean}>(`select n.nspname schema,p.proname name,p.prosecdef definer,p.proconfig config,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'aura_nutrition_%') or (n.nspname='app_private' and p.proname like 'nutrition_%')`)).rows;
  assert.equal(functions.filter(fn=>fn.schema==='public').length,5);assert.equal(functions.filter(fn=>fn.schema==='app_private').length,12);
  const granted=new Set(['nutrition_allowed','nutrition_capability_save','nutrition_meal_save','nutrition_request_status','nutrition_diary','nutrition_history']);
  for(const fn of functions){assert.equal(fn.anon,false,fn.name);assert.ok(fn.config.includes('search_path=""'));if(fn.schema==='public'){assert.equal(fn.definer,false);assert.equal(fn.authenticated,true);}else{assert.equal(fn.authenticated,granted.has(fn.name),fn.name);assert.equal(fn.definer,granted.has(fn.name),fn.name);}}
  for(const table of ['nutrition_capabilities','nutrition_meals','nutrition_meal_versions','nutrition_meal_items','app_private.nutrition_events','app_private.nutrition_requests']){
   for(const privilege of ['SELECT','INSERT','UPDATE','DELETE']){const result=(await db.query<{anon:boolean;authenticated:boolean}>('select has_table_privilege(\'anon\',$1,$2) anon,has_table_privilege(\'authenticated\',$1,$2) authenticated',[table,privilege])).rows[0];assert.equal(result.anon,false);assert.equal(result.authenticated,privilege==='SELECT'&&!table.startsWith('app_private.'),table+':'+privilege);}
  }
 }finally{await db.close();}
});
