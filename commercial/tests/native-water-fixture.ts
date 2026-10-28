import {readFile} from 'node:fs/promises';
import {foundationFixture,id} from './foundation-fixture';
import {nutritionAccess} from './nutrition-db-fixture';
import {businessToday} from '../lib/care';
import type {WaterCommandV1} from '../lib/nutrition-water-command';
import type {NutritionRpcClient} from '../lib/nutrition-persistence';
export const waterSql=new URL('../supabase/prepared/20261028140720_nutrition_water_native.sql',import.meta.url);
export const waterCommand=(request=3000):WaterCommandV1=>({contractVersion:1,requestId:id(request),waterId:null,expectedRevision:0,operation:'save',entry:{consumedOn:businessToday(),time:'09:00',quantity:{amount:250,unit:'ml'}},reason:null});
export async function waterFixture(){const f=await foundationFixture();await f.db.exec('begin;'+await readFile(waterSql,'utf8')+'commit;');await nutritionAccess(f);return f;}
export type WaterFixture=Awaited<ReturnType<typeof waterFixture>>;
export function waterRpc(f:WaterFixture):NutritionRpcClient{
 const statements:Record<string,{sql:string;args:(a:Record<string,unknown>)=>unknown[]}>={
  aura_nutrition_water_save:{sql:'select aura_nutrition_water_save($1,$2,$3::jsonb) x',args:a=>[a.p_org,a.p_client,JSON.stringify(a.p_command)]},
  aura_nutrition_water_request_status:{sql:'select aura_nutrition_water_request_status($1,$2,$3) x',args:a=>[a.p_org,a.p_client,a.p_request]},
  aura_nutrition_water_diary:{sql:'select aura_nutrition_water_diary($1,$2,$3,$4) x',args:a=>[a.p_org,a.p_client,a.p_date,a.p_after]},
  aura_nutrition_water_history:{sql:'select aura_nutrition_water_history($1,$2,$3,$4) x',args:a=>[a.p_org,a.p_client,a.p_water,a.p_before]},
 };
 return {rpc(name,args){return {async abortSignal(signal){if(signal.aborted)throw Error('aborted');const spec=statements[name];if(!spec)throw Error('Unexpected synthetic RPC');try{return {data:(await f.db.query<{x:unknown}>(spec.sql,spec.args(args))).rows[0].x,error:null};}catch(error){return {data:null,error:{code:(error as {code:string}).code}};}}};}};
}
