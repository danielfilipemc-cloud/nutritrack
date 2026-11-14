import assert from 'node:assert/strict';
export const personalAuthTarget='http://127.0.0.1:62321',personalAuthContainer='supabase_db_aura-personal-nutrition-local';
export function assertPersonalAuthRuntime(status:Record<string,string>,env:Record<string,string|undefined>){
 assert.equal(env.AURA_PERSONAL_AUTH_CONFIRM,'aura-personal-nutrition-local');assert.equal(status.API_URL,personalAuthTarget);assert.equal(status.MAILPIT_URL,'http://127.0.0.1:62324');
 const database=new URL(status.DB_URL);assert.equal(database.protocol,'postgresql:');assert.equal(database.hostname,'127.0.0.1');assert.equal(database.port,'62322');assert.equal(database.pathname,'/postgres');assert.equal(database.search,'');
 assert.ok(status.SECRET_KEY||status.SERVICE_ROLE_KEY);assert.ok(status.PUBLISHABLE_KEY||status.ANON_KEY);
 for(const name of ['AURA_E2E_LIVE','AURA_E2E_AUTH','AURA_STAGING_APPROVAL_FILE','DATABASE_URL','SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL','DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])assert.ok(!env[name],`Override forbidden: ${name}`);
}
