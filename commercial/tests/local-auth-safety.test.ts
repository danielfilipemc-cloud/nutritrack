import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertLocalAuthRuntime} from '../scripts/local-auth-safety';
import type {StagingApproval} from '../scripts/staging-safety';
const status={API_URL:'http://127.0.0.1:57321',MAILPIT_URL:'http://127.0.0.1:57324',PUBLISHABLE_KEY:'synthetic-public-only',SECRET_KEY:'synthetic-secret-only'};
const approval:StagingApproval={kind:'local',project_ref:'aura-foundations-local',synthetic_only:true,restore:{verified:true,archive_sha256:'a'.repeat(64),evidence_file:'synthetic.json',evidence_sha256:'b'.repeat(64)}};
const run=(s=status,a=approval,c:string|undefined='aura-foundations-local',e:Record<string,string|undefined>={})=>assertLocalAuthRuntime(s,a,c,e);
test('local Auth accepts only an explicit existing synthetic baseline',()=>assert.doesNotThrow(()=>run()));
test('local Auth rejects absent confirmation and cloud approvals',()=>{
 assert.throws(()=>run(status,approval,''));assert.throws(()=>run(status,{...approval,kind:'cloud'}));
 assert.throws(()=>run(status,{...approval,project_ref:'aura-foundations-restore'}));
 assert.throws(()=>run(status,{...approval,synthetic_only:false} as unknown as StagingApproval));
});
test('local Auth rejects remote, alternate local and credential-bearing endpoints before connecting',()=>{
 for(const API_URL of ['https://vgbwmamntjmhzrpvhxzb.supabase.co','https://vfplbkfxipfictuwkkoe.supabase.co','http://localhost:57321','http://127.0.0.1:58321','http://127.0.0.1:57321/rest/v1','http://user@127.0.0.1:57321'])assert.throws(()=>run({...status,API_URL}));
 assert.throws(()=>run({...status,MAILPIT_URL:'https://mail.example.invalid'}));
});
test('local Auth refuses conflicting live flags and missing keys instead of falling back to environment credentials',()=>{
 for(const e of [{AURA_E2E_LIVE:'1'},{AURA_AUDIT_CLOUD_CONFIRM:'vgbwmamntjmhzrpvhxzb'},{AURA_STAGING_URL:'https://vgbwmamntjmhzrpvhxzb.supabase.co'}])assert.throws(()=>run(status,approval,'aura-foundations-local',e));
 assert.throws(()=>run({...status,SECRET_KEY:''}));assert.throws(()=>run({...status,PUBLISHABLE_KEY:''}));
});
