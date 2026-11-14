import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {privateNutritionActivationPlan,privateActivationTarget} from '../scripts/private-nutrition-activation-plan';
const hash=(v:string)=>createHash('sha256').update(v.replace(/\r\n/g,'\n')).digest('hex');
test('private activation preparation is bound to the new exact destination and refuses pre-existing accounts/tables without changing canonical hashes',async()=>{
 const plan=await privateNutritionActivationPlan();assert.equal(plan.manifest.sources.canonicalSha256,'8e2abbe4e1693e726e62c363b6a6697bc42994ccbcb5ebf9c0c6709b2ab53fc5');assert.equal(plan.manifest.target.projectId,privateActivationTarget.projectId);assert.equal(plan.manifest.canonicalCount,19);assert.equal(plan.manifest.preparedCount,3);assert.equal(plan.manifest.createsAccounts,false);assert.ok(plan.sql.includes('Refusing private activation: expected NEW EMPTY project'));assert.ok(plan.sql.includes('exists(select 1 from auth.users)'));assert.ok(plan.sql.includes("table_schema in ('public','app_private')"));assert.ok(!plan.freeze.includes('drop '));assert.ok(plan.freeze.includes('revoke execute'));assert.equal(hash(plan.sql),plan.manifest.bundleSha256);
});
test('published real local browser evidence matches the executed runner, test, SQL and UI, without credentials',async()=>{
 const e=JSON.parse(await readFile(new URL('../docs/review/personal-nutrition-browser-evidence.json',import.meta.url),'utf8'));assert.equal(e.scope,'synthetic-local-personal-browser');assert.equal(e.result,'PASS');assert.equal(e.apiUrl,'http://127.0.0.1:62321');assert.equal(e.checks.length,5);
 for(const [path,digest] of [['scripts/personal-nutrition-browser-local.ts',e.runnerSha256],['e2e/auth-personal-local.spec.cjs',e.browserSha256],['supabase/prepared/20261114003207_nutrition_personal_export.sql',e.sourceSha256],...Object.entries(e.uiSha256)])assert.equal(hash(await readFile(new URL('../'+path,import.meta.url),'utf8')),digest);
 assert.ok(!/access_token|refresh_token|totp_secret|sb_secret_|@hotmail/.test(JSON.stringify(e)));
});
