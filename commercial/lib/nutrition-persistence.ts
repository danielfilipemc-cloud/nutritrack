/** Inactive adapter for EXISTING AURA RPCs; no schema, Auth or RLS changes.
 * Uses the caller's shared Supabase client. Server RPCs remain the authority.
 * Must be disposed on identity/organization/student change. No demo fallback. */
import {parseNutritionCommandV1,type NutritionCommandV1} from './nutrition-command';
import {validDate} from './validation';
type RpcResult = {data:unknown;error:{code?:string}|null};
export type NutritionRpcClient = {rpc(name:string,args:Record<string,unknown>):{abortSignal(signal:AbortSignal):PromiseLike<RpcResult>}};
export type NutritionReceipt = {mealId:string;revision:number;replayed?:boolean};
export type PersistedNutritionMeal = {mealId:string;revision:number;consumedOn:string;mealKind:NutritionCommandV1['mealKind'];status:'recorded'|'voided';items:NutritionCommandV1['items']};
export class NutritionPersistenceError extends Error {
 constructor(public readonly kind:'stale'|'denied'|'conflict'|'unavailable'|'uncertain'|'invalid-response') {super({stale:'O contexto mudou. Ignora a resposta anterior.',denied:'Sem acesso a estes registos.',conflict:'O registo foi alterado. Revê o histórico antes de voltar a guardar.',unavailable:'A persistência nutricional ainda não está disponível.',uncertain:'Não foi possível confirmar a operação. Consulta o recibo antes de repetir.', 'invalid-response':'A resposta não corresponde ao contrato nutricional.'}[kind]);}
}
const invalid=():never=>{throw new NutritionPersistenceError('invalid-response');};
function uuid(v:unknown):string{if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v))throw new TypeError('Identificador inválido.');return v.toLowerCase();}
function object(v:unknown,fields:string[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k)))return invalid();return v as Record<string,unknown>;}
function revision(v:unknown):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<1)return invalid();return v;}
function receipt(v:unknown,saved=false):NutritionReceipt{
 const r=object(v,saved?['mealId','revision','replayed']:['mealId','revision']);
 if(saved&&typeof r.replayed!=='boolean')return invalid();
 try{return {mealId:uuid(r.mealId),revision:revision(r.revision),...(saved?{replayed:r.replayed as boolean}:{})};}catch{return invalid();}
}
function projection(v:unknown,today:string):PersistedNutritionMeal{
 const r=object(v,['mealId','revision','consumedOn','mealKind','status','items']);
 if(!['recorded','voided'].includes(r.status as string))return invalid();
 try{
  const mealId=uuid(r.mealId),rev=revision(r.revision);
  const parsed=parseNutritionCommandV1({contractVersion:1,requestId:mealId,mealId,expectedRevision:rev,consumedOn:r.consumedOn,mealKind:r.mealKind,operation:'save',items:r.items},today);
  return {mealId,revision:rev,consumedOn:parsed.consumedOn,mealKind:parsed.mealKind,status:r.status as PersistedNutritionMeal['status'],items:parsed.items};
 }catch{return invalid();}
}
export function createNutritionPersistence(client:NutritionRpcClient,context:{organizationId:string;clientId:string},today:()=>string){
 const org=uuid(context.organizationId),pupil=uuid(context.clientId),controller=new AbortController();
 const active=()=>{if(controller.signal.aborted)throw new NutritionPersistenceError('stale');};
 async function call(name:string,args:Record<string,unknown>,mutation=false){
  active();let result:RpcResult;
  try{result=await client.rpc(name,{p_org:org,p_client:pupil,...args}).abortSignal(controller.signal);}catch{active();throw new NutritionPersistenceError(mutation?'uncertain':'unavailable');}
  active();
  if(result.error){const code=result.error.code;throw new NutritionPersistenceError(code==='42501'||code==='PT403'?'denied':code==='PT409'?'conflict':code==='42883'||code==='PGRST202'?'unavailable':mutation?'uncertain':'unavailable');}
  return result.data;
 }
 return {
  dispose(){controller.abort();},
  async save(input:unknown){const command=parseNutritionCommandV1(input,today());return receipt(await call('aura_nutrition_meal_save',{p_command:command},true),true);},
  async requestStatus(requestId:string){const data=await call('aura_nutrition_request_status',{p_request:uuid(requestId)});return data===null?null:receipt(data);},
  async diary(date:string,after:string|null=null){
   if(!validDate(date))throw new TypeError('Dia inválido.');const r=object(await call('aura_nutrition_diary',{p_date:date,p_after:after===null?null:uuid(after)}),['meals','nextCursor']);
   if(!Array.isArray(r.meals)||r.meals.length>20)return invalid();
   const meals=r.meals.map(v=>projection(v,today()));const nextCursor=r.nextCursor===null?null:uuid(r.nextCursor);
   if(meals.some((m,i)=>m.consumedOn!==date||(after!==null&&m.mealId<=after.toLowerCase())||(i>0&&m.mealId<=meals[i-1].mealId)) || (nextCursor!==null&&(meals.length!==20||nextCursor!==meals.at(-1)?.mealId)))return invalid();
   return {meals,nextCursor};
  },
  async history(mealId:string,before:number|null=null){
   const id=uuid(mealId);if(before!==null)revision(before);
   const r=object(await call('aura_nutrition_history',{p_meal:id,p_before:before}),['versions','nextCursor']);
   if(!Array.isArray(r.versions)||r.versions.length>20)return invalid();const versions=r.versions.map(v=>projection(v,today()));const nextCursor=r.nextCursor===null?null:revision(r.nextCursor);
   if(versions.some((m,i)=>m.mealId!==id||(before!==null&&m.revision>=before)||(i>0&&m.revision>=versions[i-1].revision)) || (nextCursor!==null&&(versions.length!==20||nextCursor!==versions.at(-1)?.revision)))return invalid();
   return {versions,nextCursor};
  },
 };
}
