import {foundationFixture,id} from './foundation-fixture';
import assert from 'node:assert/strict';
import type {CompositionV1} from '../lib/nutrition-contract';
export const baseline17='20261016233912_sensitive_reads_aal2.sql';
export const composition:CompositionV1={contractVersion:1,basis:{amount:100,unit:'g'},nutrients:{calories:101,protein:1,carbs:null,fat:0}};
export const deny=(promise:Promise<unknown>,code='42501')=>assert.rejects(promise,(error:unknown)=>(error as {code:string}).code===code);
export async function nutritionAccess(f:Awaited<ReturnType<typeof foundationFixture>>,write=true){
 await f.grant(2,100,['profile']);await f.asUser(1);await f.db.query(`select aura_nutrition_capability_save('${id(10)}','${id(2)}',true,$1)`,[write]);await f.asUser(2);
}
export async function seedNutrition(f:Awaited<ReturnType<typeof foundationFixture>>){
 await f.db.exec(`reset role;begin;
 insert into nutrition_meals(id,organization_id,client_id,current_revision,created_by) values('${id(700)}','${id(10)}','${id(100)}',1,'${id(2)}');
 insert into nutrition_meal_versions(meal_id,organization_id,client_id,revision,consumed_on,meal_kind,recorded_by) values('${id(700)}','${id(10)}','${id(100)}',1,current_date,'breakfast','${id(2)}');
 insert into nutrition_meal_items values('${id(700)}',1,'${id(10)}','${id(100)}',1,'Synthetic food',100,'${JSON.stringify(composition)}','manual');commit;`);
}
