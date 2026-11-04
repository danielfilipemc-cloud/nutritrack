import assert from 'node:assert/strict';
import {assertStagingTarget,type StagingApproval} from './staging-safety';

export const localAuthTarget='http://127.0.0.1:57321';
export function assertLocalAuthRuntime(status:Record<string,unknown>,approval:StagingApproval,confirmation:string|undefined,environment:Record<string,string|undefined>){
 assert.equal(confirmation,'aura-foundations-local','Explicit local Auth confirmation required');
 assert.equal(approval.kind,'local','Cloud approval is never valid for this runner');
 assert.equal(approval.project_ref,'aura-foundations-local','Only the existing baseline is permitted');
 assert.equal(status.API_URL,localAuthTarget,'Exact loopback API required');
 assert.equal(status.MAILPIT_URL||status.INBUCKET_URL,'http://127.0.0.1:57324','Exact loopback mailbox required');
 assertStagingTarget(localAuthTarget,approval);
 assert.notEqual(environment.AURA_E2E_LIVE,'1','Live browser mode is prohibited');
 assert.ok(!environment.AURA_AUDIT_CLOUD_CONFIRM,'Cloud confirmation is prohibited');
 assert.ok(!environment.AURA_STAGING_URL||environment.AURA_STAGING_URL===localAuthTarget,'Conflicting target is prohibited');
 for(const key of [status.PUBLISHABLE_KEY||status.ANON_KEY,status.SECRET_KEY||status.SERVICE_ROLE_KEY])assert.ok(typeof key==='string'&&key.length>10,'Existing local runtime keys required');
}
