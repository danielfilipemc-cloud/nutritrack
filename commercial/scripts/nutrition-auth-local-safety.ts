import assert from 'node:assert/strict';
export const nutritionAuthTarget='http://127.0.0.1:61321';
export const nutritionAuthContainer='supabase_db_aura-nutrition-local';
export function assertNutritionAuthRuntime(status:Record<string,unknown>,environment:Record<string,string|undefined>){
 assert.equal(environment.AURA_NUTRITION_AUTH_CONFIRM,'aura-nutrition-local','Explicit nutrition-only local confirmation required');
 assert.equal(status.API_URL,nutritionAuthTarget,'Exact nutrition loopback API required');
 assert.equal(status.MAILPIT_URL||status.INBUCKET_URL,'http://127.0.0.1:61324','Exact nutrition loopback mailbox required');
 assert.ok(status.DB_URL==='postgresql://postgres:postgres@127.0.0.1:61322/postgres','Exact dedicated local database required');
 assert.notEqual(environment.AURA_E2E_LIVE,'1','Live browser mode forbidden');
 assert.notEqual(environment.AURA_E2E_AUTH,'1','Use the dedicated nutrition runner');
 for(const name of ['AURA_AUDIT_CLOUD_CONFIRM','AURA_STAGING_APPROVAL_FILE','DOCKER_HOST','DATABASE_URL'])assert.ok(!environment[name],'Conflicting environment forbidden: '+name);
 if(environment.NEXT_PUBLIC_SUPABASE_URL)assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL,nutritionAuthTarget,'Conflicting public target forbidden');
 for(const key of [status.PUBLISHABLE_KEY||status.ANON_KEY,status.SECRET_KEY||status.SERVICE_ROLE_KEY])assert.ok(typeof key==='string'&&key.length>10,'Local runtime keys required');
}
