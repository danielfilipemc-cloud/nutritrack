import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {assertPersonalAuthRuntime,personalAuthTarget} from '../scripts/personal-nutrition-local-safety';import {migrationBundle} from '../scripts/migration-bundle';
test('personal Auth rehearsal refuses cloud, other local stacks, overrides and missing exact confirmation',()=>{
 const status={API_URL:personalAuthTarget,MAILPIT_URL:'http://127.0.0.1:62324',DB_URL:'postgresql://postgres:synthetic@127.0.0.1:62322/postgres',SECRET_KEY:'synthetic-secret',PUBLISHABLE_KEY:'synthetic-public'},env={AURA_PERSONAL_AUTH_CONFIRM:'aura-personal-nutrition-local'};
 assert.doesNotThrow(()=>assertPersonalAuthRuntime(status,env));assert.throws(()=>assertPersonalAuthRuntime(status,{}));
 for(const API_URL of ['https://vgbwmamntjmhzrpvhxzb.supabase.co','http://127.0.0.1:61321','http://localhost:62321'])assert.throws(()=>assertPersonalAuthRuntime({...status,API_URL},env));
 for(const name of ['DOCKER_HOST','DATABASE_URL','NEXT_PUBLIC_SUPABASE_URL','AURA_E2E_LIVE'])assert.throws(()=>assertPersonalAuthRuntime(status,{...env,[name]:'unexpected'}));
});
test('public personal Auth evidence is bound to the current runner and both prepared SQL candidates',async()=>{
 const evidence=JSON.parse(await readFile(new URL('../docs/review/personal-nutrition-local-auth-evidence.json',import.meta.url),'utf8')),hash=(v:string)=>createHash('sha256').update(v.replace(/\r\n/g,'\n')).digest('hex');
 assert.equal(evidence.result,'PASS');assert.equal(evidence.apiUrl,personalAuthTarget);assert.equal(evidence.scope,'public-synthetic-personal-nutrition-auth-evidence');assert.equal(evidence.canonicalMigrationCount,19);
 assert.equal(evidence.runnerSha256,hash(await readFile(new URL('../scripts/personal-nutrition-auth-local.ts',import.meta.url),'utf8')));assert.equal(evidence.sources.upgrade,hash(await migrationBundle()));assert.equal(evidence.sources.baseline,hash(await migrationBundle({through:'20261016233912_sensitive_reads_aal2.sql'})));
 assert.deepEqual(evidence.sources.candidates,await Promise.all(['20261113225824_nutrition_personal_access.sql','20261113225825_nutrition_personal_targets.sql'].map(async n=>hash(await readFile(new URL('../supabase/prepared/'+n,import.meta.url),'utf8')))));assert.equal(evidence.checks.length,11);assert.ok(evidence.checks.every((c:{result:string})=>c.result==='PASS'));
 const serialized=JSON.stringify(evidence);assert.ok(!/access_token|refresh_token|password|totp.secret|sb_secret_/.test(serialized));
});
