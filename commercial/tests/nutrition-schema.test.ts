import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture,id} from './foundation-fixture';
import {migrationBundle} from '../scripts/migration-bundle';
import {parseCompositionV1} from '../lib/nutrition-contract';
import {baseline17,composition,deny,nutritionAccess,seedNutrition} from './nutrition-db-fixture';

test('nutrition upgrade preserves populated 17-migration baseline, checksums, timestamps and existing grants',async()=>{
 const f=await foundationFixture(baseline17);try{
  await f.grant(2,100);await f.asUser(2);await f.db.query(`select aura_assessment_create('${id(10)}','${id(100)}',app_private.business_today(),80,null,null)`);await f.db.exec('reset role');
  const registry=(await f.db.query('select * from app_private.aura_migrations order by name')).rows;assert.equal(registry.length,17);
  const records=(await f.db.query('select * from assessments')).rows,capabilities=(await f.db.query('select * from staff_capabilities')).rows;
  const bundle=(await migrationBundle()).replace('create extension if not exists pgcrypto;','');await f.db.exec(bundle);await f.db.exec(bundle);
  for(const entry of registry)assert.deepEqual((await f.db.query('select * from app_private.aura_migrations where name=$1',[(entry as {name:string}).name])).rows[0],entry);
  assert.deepEqual((await f.db.query('select * from assessments')).rows,records);assert.deepEqual((await f.db.query('select * from staff_capabilities')).rows,capabilities);
  assert.deepEqual((await f.db.query('select * from nutrition_capabilities')).rows,[]);
  await f.asUser(2);assert.equal((await f.db.query('select * from assessments')).rows.length,1);assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,0);
 }finally{await f.db.close();}
});
test('nutrition requires explicit capability plus assignment plus profile, with no owner/admin/student bypass',async()=>{
 const f=await foundationFixture();try{
  await seedNutrition(f);
  await f.asUser(1);const token=(await f.db.query<{t:string}>(`select aura_student_invite_create('${id(10)}','${id(100)}','student@example.invalid') t`)).rows[0].t;
  await f.asUser(4);await f.db.query('select aura_student_invite_accept($1)',[token]);
  for(const user of [1,2,3,4,5,7]){await f.asUser(user);for(const table of ['nutrition_meals','nutrition_meal_versions','nutrition_meal_items'])assert.equal((await f.db.query('select * from '+table)).rows.length,0);}
  await f.asUser(1);await f.db.query(`select aura_nutrition_capability_save('${id(10)}','${id(2)}',true,false)`);await f.asUser(2);assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,0);
  await f.asUser(1);await f.db.query(`select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',true)`);await f.asUser(2);assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,0);
  await f.asUser(3);await deny(f.db.query(`select aura_nutrition_capability_save('${id(10)}','${id(2)}',true,true)`));
  await nutritionAccess(f,false);assert.equal((await f.db.query('select * from nutrition_meal_items')).rows.length,1);
  assert.equal((await f.db.query<{x:boolean}>(`select app_private.nutrition_allowed('${id(10)}','${id(100)}',true) x`)).rows[0].x,false);
  await deny(f.db.query(`update nutrition_meals set current_revision=2`));await deny(f.db.query('delete from nutrition_meal_items'));await deny(f.db.query(`insert into nutrition_capabilities values('${id(10)}','${id(2)}',true)`));
  await f.db.exec('reset role;set role anon');await deny(f.db.query('select * from nutrition_meals'));
 }finally{await f.db.close();}
});
test('nutrition inherits opt-in recent AAL2 and live-session requirements without bypass',async()=>{
 const f=await foundationFixture();try{
  await seedNutrition(f);await nutritionAccess(f);
  await f.db.exec(`reset role;create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);create table auth.mfa_factors(user_id uuid,status text,factor_type text);
   insert into auth.sessions values('${id(999)}','${id(2)}',null);insert into auth.mfa_factors values('${id(2)}','verified','totp');
   insert into app_private.organization_security(organization_id,require_sensitive_aal2,revision,updated_by) values('${id(10)}',true,1,'${id(1)}');`);
  await f.asUser(2);assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,0);
  const claims={aal:'aal2',session_id:id(999),amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]};await f.db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
  assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,1);
  await f.db.exec(`reset role;delete from auth.sessions where id='${id(999)}'`);await f.asUser(2);assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,0);
 }finally{await f.db.close();}
});
test('nutrition revocation takes effect with unchanged identity claims for assignment, capability and membership',async()=>{
 const f=await foundationFixture();try{
  await seedNutrition(f);await nutritionAccess(f);
  const canSee=async()=>assert.equal((await f.db.query('select * from nutrition_meal_items')).rows.length,1);
  const hidden=async()=>assert.equal((await f.db.query('select * from nutrition_meal_items')).rows.length,0);
  await canSee();await f.asUser(1);await f.db.query(`select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',false)`);await f.asUser(2);await hidden();
  await nutritionAccess(f);await canSee();await f.asUser(1);await f.db.query(`select aura_nutrition_capability_save('${id(10)}','${id(2)}',false,false)`);await f.asUser(2);await hidden();
  await nutritionAccess(f);await f.db.exec(`reset role;delete from organization_members where organization_id='${id(10)}' and user_id='${id(2)}'`);await f.asUser(2);await hidden();
 }finally{await f.db.close();}
});
test('nutrition snapshots enforce P1 composition, immutable history and composite tenant foreign keys',async()=>{
 const f=await foundationFixture();try{
  await seedNutrition(f);
  const variants:unknown[]=[composition,{...composition,nutrients:{...composition.nutrients,calories:0}}, {...composition,nutrients:{...composition.nutrients,calories:null}}, {...composition,contractVersion:2}, {...composition,basis:{amount:100,unit:'ml'}}, {...composition,nutrients:{...composition.nutrients,protein:-1}}, {...composition,nutrients:{...composition.nutrients,protein:1.0001}}, {...composition,nutrients:{...composition.nutrients,protein:undefined}}, {...composition,actor:id(5)}];
  for(const value of variants){let valid=true;try{parseCompositionV1(value);}catch{valid=false;}assert.equal((await f.db.query<{valid:boolean}>('select app_private.nutrition_composition_valid($1::jsonb) valid',[JSON.stringify(value)])).rows[0].valid,valid);}
  await deny(f.db.query(`update nutrition_meal_items set grams=200`),'55000');await deny(f.db.query('delete from nutrition_meal_versions'),'55000');
  await deny(f.db.query(`insert into nutrition_meal_items values('${id(700)}',1,'${id(20)}','${id(200)}',2,'Synthetic foreign food',100,$1::jsonb,'manual')`,[JSON.stringify(composition)]),'23503');
  await deny(f.db.query(`insert into nutrition_meal_items values('${id(700)}',1,'${id(10)}','${id(100)}',2,'Synthetic invalid mass',1.0001,$1::jsonb,'manual')`,[JSON.stringify(composition)]),'23514');
 }finally{await f.db.close();}
});
