import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture} from './foundation-fixture';
import {foundationsCloudSmokeSql} from '../scripts/foundations-cloud-smoke';
test('isolated cloud SQL smoke validates current permissions and rolls back every fixture',async()=>{
 const f=await foundationFixture();try{
  await f.db.exec('alter table auth.users add column raw_app_meta_data jsonb');
  const count=async()=>(await f.db.query<{n:number}>('select count(*)::int n from auth.users')).rows[0].n;
  const before=await count();const sql=foundationsCloudSmokeSql();
  assert.ok(sql.includes('rollback;'));assert.ok(!sql.includes('commit;'));
  await f.db.exec(sql);assert.equal(await count(),before);
 }finally{await f.db.close();}
});
