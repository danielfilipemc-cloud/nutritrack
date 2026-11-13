import {readFile} from 'node:fs/promises';
import {foundationFixture,id} from './foundation-fixture';
import {businessToday} from '../lib/care';
import {composition} from './nutrition-db-fixture';
import type {NutritionCommandV1} from '../lib/nutrition-command';
import type {NutritionRpcClient} from '../lib/nutrition-persistence';
export const personalSql=new URL('../supabase/prepared/20261113225824_nutrition_personal_access.sql',import.meta.url);
export const personalCommand=(request=6000):NutritionCommandV1=>({contractVersion:1,requestId:id(request),mealId:null,expectedRevision:0,consumedOn:businessToday(),mealKind:'lunch',operation:'save',items:[{label:'Synthetic private food',source:'manual',composition:structuredClone(composition),quantity:{amount:100,unit:'g'}}]});
export async function personalFixture(){
 const f=await foundationFixture();
 await f.db.exec(`create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create table auth.mfa_factors(user_id uuid,status text,factor_type text);
 insert into auth.sessions select ('00000000-0000-0000-0000-'||lpad((9000+u)::text,12,'0'))::uuid,('00000000-0000-0000-0000-'||lpad(u::text,12,'0'))::uuid,null from generate_series(1,8) u;
 insert into client_users(organization_id,client_id,user_id) values('${id(10)}','${id(100)}','${id(4)}'),('${id(10)}','${id(101)}','${id(8)}');`);
 await f.db.exec('begin;'+await readFile(personalSql,'utf8')+'commit;');
 const asStudent=async(n=4,patch:Record<string,unknown>={})=>{
  await f.asUser(n);await f.db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(n),session_id:id(9000+n),exp:Math.floor(Date.now()/1000)+900,aal:'aal1',...patch})]);
 };
 await asStudent();return {...f,asStudent};
}
export type PersonalFixture=Awaited<ReturnType<typeof personalFixture>>;
export function personalRpc(f:PersonalFixture):NutritionRpcClient{
 const statements:Record<string,{sql:string;args:(a:Record<string,unknown>)=>unknown[]} >={
  aura_student_nutrition_meal_save:{sql:'select aura_student_nutrition_meal_save($1,$2,$3::jsonb) x',args:a=>[a.p_org,a.p_client,JSON.stringify(a.p_command)]},
  aura_student_nutrition_diary:{sql:'select aura_student_nutrition_diary($1,$2,$3,$4) x',args:a=>[a.p_org,a.p_client,a.p_date,a.p_after]},
  aura_student_nutrition_history:{sql:'select aura_student_nutrition_history($1,$2,$3,$4) x',args:a=>[a.p_org,a.p_client,a.p_meal,a.p_before]},
  aura_student_nutrition_request_status:{sql:'select aura_student_nutrition_request_status($1,$2,$3) x',args:a=>[a.p_org,a.p_client,a.p_request]},
  aura_student_nutrition_context:{sql:'select aura_student_nutrition_context($1,$2) x',args:a=>[a.p_org,a.p_client]},
 };
 return {rpc(name,args){return {async abortSignal(signal){if(signal.aborted)throw Error('aborted');const s=statements[name];if(!s)throw Error('Professional/unexpected RPC forbidden');try{return {data:(await f.db.query<{x:unknown}>(s.sql,s.args(args))).rows[0].x,error:null};}catch(e){return {data:null,error:{code:(e as {code:string}).code}};}}};}};
}
