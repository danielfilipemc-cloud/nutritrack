import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture,id} from './foundation-fixture';
test('access-only upgrade protects seeded measurements before and after explicit authorization',async()=>{
 const f=await foundationFixture();try{
 await f.db.exec(`insert into assessments(organization_id,client_id,recorded_by,weight_kg) values('${id(10)}','${id(100)}','${id(1)}',80),('${id(20)}','${id(200)}','${id(5)}',90)`);
 await f.asUser(1);assert.equal((await f.db.query('select * from assessments')).rows.length,0);
 await f.grant(2,100,['profile','assessments']);await f.asUser(2);
 const own=(await f.db.query<{weight_kg:number}>('select weight_kg from assessments')).rows;
 assert.equal(own.length,1);assert.equal(Number(own[0].weight_kg),80);
 await f.asUser(7);assert.equal((await f.db.query('select * from assessments')).rows.length,0);
 await f.asUser(1);await f.db.query(`select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',false)`);
 await f.asUser(2);assert.equal((await f.db.query('select * from assessments')).rows.length,0);
 }finally{await f.db.close();}
});
test('student acceptance never provisions staff role or exposes sensitive table',async()=>{
 const f=await foundationFixture();try{
 await f.asUser(1);const token=(await f.db.query<{t:string}>(`select aura_student_invite_create('${id(10)}','${id(100)}','student@example.invalid') t`)).rows[0].t;
 await f.asUser(4);await f.db.query(`select aura_student_invite_accept('${token}')`);
 assert.equal((await f.db.query('select * from organization_members')).rows.length,0);
 assert.equal((await f.db.query('select * from assessments')).rows.length,0);
 await assert.rejects(f.db.query(`select aura_capability_save('${id(10)}','${id(4)}','assessments',true,true)`));
 await assert.rejects(f.db.query(`select aura_assignment_save('${id(10)}','${id(101)}','${id(4)}',true)`));
 }finally{await f.db.close();}
});
