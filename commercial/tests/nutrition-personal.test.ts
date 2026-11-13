import test from 'node:test';import assert from 'node:assert/strict';
import {foundationFixture,id} from './foundation-fixture';
import {personalFixture,personalCommand,personalRpc,personalSql} from './nutrition-personal-fixture';
import {nutritionAccess,deny} from './nutrition-db-fixture';
import {createStudentNutritionPersistence} from '../lib/nutrition-student-persistence';
import {businessToday} from '../lib/care';
import {readFile} from 'node:fs/promises';
const context={organizationId:id(10),clientId:id(100)};
const adapter=(f:Awaited<ReturnType<typeof personalFixture>>)=>createStudentNutritionPersistence(personalRpc(f),context,businessToday);

test('own-account journal reuses V1 snapshots, revisions, receipts and void history without professional access',async()=>{
 const f=await personalFixture();try{
  const repo=adapter(f),command=personalCommand(),first=await repo.save(command);assert.equal(first.revision,1);assert.deepEqual(await repo.context(),{canWrite:true});
  assert.deepEqual(await repo.save(command),{...first,replayed:true});assert.deepEqual(await repo.requestStatus(command.requestId),{mealId:first.mealId,revision:1});
  assert.equal((await repo.diary(businessToday())).meals[0].items[0].composition.nutrients.carbs,null);
  const edit={...personalCommand(6001),mealId:first.mealId,expectedRevision:1};edit.items[0].quantity.amount=50;await repo.save(edit);
  await assert.rejects(repo.save({...edit,requestId:id(6002)}),{kind:'conflict'});
  await repo.save({...personalCommand(6003),mealId:first.mealId,expectedRevision:2,operation:'void',items:[]});
  const versions=(await repo.history(first.mealId)).versions;assert.equal(versions.length,3);assert.equal(versions[0].status,'voided');assert.equal(versions[2].items[0].quantity.amount,100);
  await deny(f.db.query('select aura_nutrition_diary($1,$2,current_date,null)',[id(10),id(100)]));
  await deny(f.db.query('select app_private.nutrition_meal_save_scoped($1,$2,$3,true)',[id(10),id(100),JSON.stringify(personalCommand(6004))]));
  repo.dispose();await assert.rejects(repo.context(),{kind:'stale'});
 }finally{await f.db.close();}
});

test('assigned professionals cannot read or mutate personal entries via RLS, history or professional RPCs',async()=>{
 const f=await personalFixture();try{
  const repo=adapter(f),receipt=await repo.save(personalCommand());await nutritionAccess(f);
  assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,0);assert.equal((await f.db.query('select * from nutrition_meal_items')).rows.length,0);
  const journal=(await f.db.query<{x:{meals:unknown[]}}>('select aura_nutrition_diary($1,$2,current_date,null) x',[id(10),id(100)])).rows[0].x;assert.deepEqual(journal.meals,[]);
  await deny(f.db.query('select aura_nutrition_history($1,$2,$3,null)',[id(10),id(100),receipt.mealId]));
  await deny(f.db.query('select aura_nutrition_meal_save($1,$2,$3)',[id(10),id(100),JSON.stringify({...personalCommand(6002),mealId:receipt.mealId,expectedRevision:1})]));
  for(const n of [1,3,5,6,8]){await f.asStudent(n);await assert.rejects(repo.diary(businessToday()),{kind:'denied'});await assert.rejects(repo.context(),{kind:'denied'});}
 }finally{await f.db.close();}
});

test('all self RPCs reject wrong scope, revoked links, expired/deleted sessions and unconfirmed accounts with unchanged claims',async()=>{
 const f=await personalFixture();try{
  const repo=adapter(f),c=personalCommand(),r=await repo.save(c);
  const denied=async()=>{for(const read of [()=>repo.diary(businessToday()),()=>repo.history(r.mealId),()=>repo.requestStatus(c.requestId),()=>repo.context(),()=>repo.save(personalCommand(6005))])await assert.rejects(read(),{kind:'denied'});assert.equal((await f.db.query('select * from nutrition_meal_versions')).rows.length,0);};
  for(const bad of [{organizationId:id(20),clientId:id(200)},{organizationId:id(10),clientId:id(101)}])await assert.rejects(createStudentNutritionPersistence(personalRpc(f),bad,businessToday).diary(businessToday()),{kind:'denied'});
  await f.asStudent(4,{exp:1});await denied();await f.asStudent();
  await f.db.exec(`reset role;update client_users set revoked_at=now() where client_id='${id(100)}'`);await f.asStudent();await denied();
  await f.db.exec(`reset role;update client_users set revoked_at=null where client_id='${id(100)}';delete from auth.sessions where id='${id(9004)}'`);await f.asStudent();await denied();
  await f.db.exec(`reset role;insert into auth.sessions values('${id(9004)}','${id(4)}',null);update auth.users set email_confirmed_at=null where id='${id(4)}'`);await f.asStudent();await denied();
 }finally{await f.db.close();}
});

test('relinking a client to a different account never transfers the previous private diary',async()=>{
 const f=await personalFixture();try{
  const r=await adapter(f).save(personalCommand());
  await f.db.exec(`reset role;delete from client_users where client_id='${id(101)}';update client_users set user_id='${id(8)}' where client_id='${id(100)}'`);await f.asStudent(8);
  const repo=adapter(f);assert.equal((await repo.diary(businessToday())).meals.length,0);await assert.rejects(repo.history(r.mealId),{kind:'denied'});
  await repo.save(personalCommand(6001));assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,1);
  await f.asStudent(4);await assert.rejects(repo.diary(businessToday()),{kind:'denied'});
 }finally{await f.db.close();}
});

test('new self access inherits live MFA policy and preserves archived history without allowing new writes',async()=>{
 const f=await personalFixture();try{
  const repo=adapter(f),r=await repo.save(personalCommand());
  await f.db.exec(`reset role;insert into app_private.organization_security values('${id(10)}',true,1,'${id(1)}',now());insert into auth.mfa_factors values('${id(4)}','verified','totp')`);await f.asStudent();await assert.rejects(repo.context(),{kind:'denied'});
  const aal2={aal:'aal2',amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]};await f.asStudent(4,aal2);assert.equal((await repo.diary(businessToday())).meals.length,1);
  await f.db.exec(`reset role;update clients set archived_at=now() where id='${id(100)}'`);await f.asStudent(4,aal2);assert.deepEqual(await repo.context(),{canWrite:false});assert.equal((await repo.history(r.mealId)).versions.length,1);await assert.rejects(repo.save(personalCommand(6001)),{kind:'denied'});
  await f.db.exec('reset role;delete from auth.mfa_factors');await f.asStudent(4,aal2);await assert.rejects(repo.diary(businessToday()),{kind:'denied'});
 }finally{await f.db.close();}
});

test('upgrade preserves professional replay hashes, existing history and all 19 canonical migration records',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);const command=personalCommand();const r=(await f.db.query<{x:any}>('select aura_nutrition_meal_save($1,$2,$3::jsonb) x',[id(10),id(100),JSON.stringify(command)])).rows[0].x;
  await f.db.exec('reset role');const before=(await f.db.query('select * from app_private.aura_migrations order by name')).rows;
  await f.db.exec('begin;'+await readFile(personalSql,'utf8')+'commit;');assert.deepEqual((await f.db.query('select * from app_private.aura_migrations order by name')).rows,before);assert.equal(before.length,19);
  await f.asUser(2);const after=(await f.db.query<{x:any}>('select aura_nutrition_meal_save($1,$2,$3::jsonb) x',[id(10),id(100),JSON.stringify(command)])).rows[0].x;assert.deepEqual(after,{...r,replayed:true});
  assert.equal((await f.db.query('select * from nutrition_meal_versions')).rows.length,1);
  const procedures=(await f.db.query<{proname:string;prosecdef:boolean;proconfig:string[];anon:boolean}>("select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'execute') anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'aura_student_nutrition_%' order by p.proname")).rows;
  assert.equal(procedures.length,5);assert.ok(procedures.every(p=>!p.prosecdef&&!p.anon&&p.proconfig.includes('search_path=""')));
 }finally{await f.db.close();}
});

test('self commands reject forged ownership, ml and invalid composition; anonymous wrappers and direct DML stay denied',async()=>{
 const f=await personalFixture();try{
  const repo=adapter(f),good=personalCommand();
  for(const bad of [{...good,actorId:id(8)},{...good,personalUserId:id(8)},{...good,items:[{...good.items[0],quantity:{amount:100,unit:'ml'}}]},{...good,items:[{...good.items[0],composition:{...good.items[0].composition,basis:{amount:1,unit:'g'}}}]}])await assert.rejects(repo.save(bad));
  for(const statement of ['delete from nutrition_meals','update nutrition_meals set personal_user_id=null'])await deny(f.db.query(statement));
  await f.db.exec('reset role;set role anon');await deny(f.db.query('select aura_student_nutrition_context($1,$2)',[id(10),id(100)]));await deny(f.db.query('select * from nutrition_meals'));
 }finally{await f.db.close();}
});

test('own access handshake rejects malformed or delayed context and never infers write permission',async()=>{
 for(const data of [null,{}, {canWrite:1},{canWrite:true,role:'owner'}]){
  const repo=createStudentNutritionPersistence({rpc(){return {abortSignal:async()=>({data,error:null})};}},context,businessToday);
  await assert.rejects(repo.context(),{kind:'invalid-response'});repo.dispose();
 }
 let release!:(value:{data:unknown;error:null})=>void;
 const repo=createStudentNutritionPersistence({rpc(){return {abortSignal:()=>new Promise(resolve=>{release=resolve;})};}},context,businessToday);
 const pending=repo.context();repo.dispose();release({data:{canWrite:true},error:null});await assert.rejects(pending,{kind:'stale'});
});
