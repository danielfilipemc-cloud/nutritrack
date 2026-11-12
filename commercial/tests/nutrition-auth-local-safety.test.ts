import test from 'node:test';import assert from 'node:assert/strict';
import {assertNutritionAuthRuntime,nutritionAuthTarget} from '../scripts/nutrition-auth-local-safety';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {migrationBundle} from '../scripts/migration-bundle';
const status={API_URL:nutritionAuthTarget,MAILPIT_URL:'http://127.0.0.1:61324',DB_URL:'postgresql://postgres:postgres@127.0.0.1:61322/postgres',PUBLISHABLE_KEY:'synthetic-public-key',SECRET_KEY:'synthetic-private-key'};
const env={AURA_NUTRITION_AUTH_CONFIRM:'aura-nutrition-local'};
test('nutrition Auth runner only accepts the dedicated synthetic loopback sandbox',()=>{
 assert.doesNotThrow(()=>assertNutritionAuthRuntime(status,env));
 for(const url of ['https://vgbwmamntjmhzrpvhxzb.supabase.co','https://vfplbkfxipfictuwkkoe.supabase.co','http://127.0.0.1:57321','http://localhost:61321','http://127.0.0.1:61321/','http://127.0.0.1:61321?host=remote'])assert.throws(()=>assertNutritionAuthRuntime({...status,API_URL:url},env));
 for(const prop of ['DB_URL','MAILPIT_URL','SECRET_KEY'])assert.throws(()=>assertNutritionAuthRuntime({...status,[prop]:'invalid'},env));
 for(const other of [{},{AURA_NUTRITION_AUTH_CONFIRM:'aura-foundations-local'},{...env,AURA_E2E_LIVE:'1'},{...env,AURA_STAGING_APPROVAL_FILE:'previous-approval.json'},{...env,DOCKER_HOST:'tcp://remote'},{...env,DATABASE_URL:status.DB_URL},{...env,NEXT_PUBLIC_SUPABASE_URL:'https://vgbwmamntjmhzrpvhxzb.supabase.co'}])assert.throws(()=>assertNutritionAuthRuntime(status,other));
});

test('published synthetic Auth evidence remains bound to the exact runner and reviewed schema sources',async()=>{
 const evidence=JSON.parse(await readFile(new URL('../docs/review/nutrition-local-auth-evidence.json',import.meta.url),'utf8'));
 const hash=(text:string)=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
 assert.equal(evidence.scope,'public-synthetic-local-nutrition-auth-evidence');assert.equal(evidence.result,'PASS');assert.equal(evidence.apiUrl,nutritionAuthTarget);
 assert.equal(evidence.runnerSha256,hash(await readFile(new URL('../scripts/nutrition-auth-local.ts',import.meta.url),'utf8')),'Repeat the real local run after changing its runner');
 assert.equal(evidence.sources.baseline,hash(await migrationBundle({through:'20261016233912_sensitive_reads_aal2.sql'})));
 assert.equal(evidence.sources.upgrade,hash(await migrationBundle()));
 const names=['20261028140720_nutrition_water_native.sql','20261028160819_nutrition_documents_native.sql'];
 assert.deepEqual(evidence.sources.candidates,await Promise.all(names.map(async n=>hash(await readFile(new URL('../supabase/prepared/'+n,import.meta.url),'utf8')))));
 assert.equal(evidence.checks.length,12);assert.ok(evidence.checks.every((c:{result:string})=>c.result==='PASS'));
});
