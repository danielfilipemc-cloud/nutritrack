import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertFreshStagingTarget,assertFreshStagingEmpty,freshStagingProject as ref} from '../scripts/fresh-staging-safety';
test('fresh provisioning requires the exact newly approved project and refuses existing data',()=>{
 assert.equal(assertFreshStagingTarget(`https://${ref}.supabase.co`,ref).synthetic_only,true);
 for(const url of ['https://vfplbkfxipfictuwkkoe.supabase.co','https://maipjryehnllaifxhunf.supabase.co',`https://${ref}.supabase.co/`,`http://${ref}.supabase.co`])assert.throws(()=>assertFreshStagingTarget(url,ref));
 assert.throws(()=>assertFreshStagingTarget(`https://${ref}.supabase.co`,undefined));
 assert.doesNotThrow(()=>assertFreshStagingEmpty(0,0));
 for(const [organizations,users] of [[null,0],[1,0],[0,1]] as const)assert.throws(()=>assertFreshStagingEmpty(organizations,users));
});
