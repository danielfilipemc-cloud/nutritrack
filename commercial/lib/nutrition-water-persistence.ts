/** Prepared/inactive transport. No new client, Auth, browser storage or demo fallback.
 * The caller must dispose it on actor, organization or student change. */
import {NutritionPersistenceError,type NutritionRpcClient} from './nutrition-persistence';
import {parseWaterCommandV1,waterId,waterObject,waterRevision,type WaterEntryV1} from './nutrition-water-command';
import {validDate} from './validation';
export type PersistedWater={waterId:string;revision:number;entry:WaterEntryV1;status:'recorded'|'voided';reason:string|null;recordedBy:string};
export type WaterReceipt={waterId:string;revision:number;replayed?:boolean};
const invalid=():never=>{throw new NutritionPersistenceError('invalid-response');};
function receipt(value:unknown,saved=false):WaterReceipt{
 try{const r=waterObject(value,saved?['waterId','revision','replayed']:['waterId','revision']);if(saved&&typeof r.replayed!=='boolean')return invalid();return {waterId:waterId(r.waterId),revision:waterRevision(r.revision),...(saved?{replayed:r.replayed as boolean}:{})};}catch{return invalid();}
}
function projection(value:unknown,today:string):PersistedWater{
 try{
  const r=waterObject(value,['waterId','revision','entry','status','reason','recordedBy']),id=waterId(r.waterId),revision=waterRevision(r.revision);
  const command=parseWaterCommandV1({contractVersion:1,requestId:id,waterId:revision===1?null:id,expectedRevision:revision===1?0:revision-1,operation:'save',entry:r.entry,reason:r.reason},today);
  if(!['recorded','voided'].includes(r.status as string)||revision===1&&r.status!=='recorded'||command.reason!==r.reason)return invalid();
  return {waterId:id,revision,entry:command.entry!,status:r.status as PersistedWater['status'],reason:command.reason,recordedBy:waterId(r.recordedBy)};
 }catch{return invalid();}
}
export function createNutritionWaterPersistence(client:NutritionRpcClient,context:{organizationId:string;clientId:string},today:()=>string){
 const org=waterId(context.organizationId),pupil=waterId(context.clientId),controller=new AbortController();
 const active=()=>{if(controller.signal.aborted)throw new NutritionPersistenceError('stale');};
 async function call(name:string,args:Record<string,unknown>,mutation=false){
  active();let result;
  try{result=await client.rpc(name,{p_org:org,p_client:pupil,...args}).abortSignal(controller.signal);}catch{active();throw new NutritionPersistenceError(mutation?'uncertain':'unavailable');}
  active();
  if(!result||typeof result!=='object'||!Object.hasOwn(result,'data')||!Object.hasOwn(result,'error'))throw new NutritionPersistenceError(mutation?'uncertain':'invalid-response');
  if(result.error){const code=result.error.code;throw new NutritionPersistenceError(code==='42501'||code==='PT403'?'denied':code==='PT409'||code==='23514'?'conflict':code==='42883'||code==='PGRST202'?'unavailable':mutation?'uncertain':'unavailable');}
  return result.data;
 }
 return {
  dispose(){controller.abort();},
  async save(input:unknown){
   active();const command=parseWaterCommandV1(input,today());const data=await call('aura_nutrition_water_save',{p_command:command},true);
   try{return receipt(data,true);}catch{throw new NutritionPersistenceError('uncertain');}
  },
  async requestStatus(requestId:string){active();const data=await call('aura_nutrition_water_request_status',{p_request:waterId(requestId)});return data===null?null:receipt(data);},
  async diary(date:string,after:string|null=null){
   active();if(!validDate(date)||date.startsWith('0000-'))throw new TypeError('Invalid water day');const cursor=after===null?null:waterId(after);
   try{
    const r=waterObject(await call('aura_nutrition_water_diary',{p_date:date,p_after:cursor}),['entries','nextCursor','summary']);
    if(!Array.isArray(r.entries)||r.entries.length>20)return invalid();const entries=r.entries.map(v=>projection(v,today())),nextCursor=r.nextCursor===null?null:waterId(r.nextCursor);
    const s=waterObject(r.summary,['activeCount','voidedCount','declaredMl']),activeCount=waterRevision(s.activeCount,0),voidedCount=waterRevision(s.voidedCount,0),total=activeCount+voidedCount;
    const declaredMl=s.declaredMl===null?null:waterRevision(s.declaredMl);
    if(!Number.isSafeInteger(total)||!activeCount&&declaredMl!==null||activeCount>0&&(declaredMl===null||declaredMl<activeCount||BigInt(declaredMl)>BigInt(activeCount)*BigInt(5000)))return invalid();
    if(entries.some((e,i)=>e.entry.consumedOn!==date||cursor!==null&&e.waterId<=cursor||i>0&&e.waterId<=entries[i-1].waterId)||entries.length>total
    ||entries.filter(e=>e.status==='recorded').length>activeCount||entries.filter(e=>e.status==='voided').length>voidedCount
    ||nextCursor!==null&&(entries.length!==20||nextCursor!==entries.at(-1)?.waterId||total<=20)
    ||cursor===null&&nextCursor===null&&entries.length!==total)return invalid();
    if(cursor===null&&nextCursor===null&&activeCount>0&&entries.filter(e=>e.status==='recorded').reduce((sum,e)=>sum+e.entry.quantity.amount,0)!==declaredMl)return invalid();
    return {entries,nextCursor,summary:{activeCount,voidedCount,declaredMl}};
   }catch(error){if(error instanceof NutritionPersistenceError)throw error;return invalid();}
  },
  async history(id:string,before:number|null=null){
   active();const target=waterId(id);if(before!==null)waterRevision(before);
   try{
    const r=waterObject(await call('aura_nutrition_water_history',{p_water:target,p_before:before}),['versions','nextCursor']);if(!Array.isArray(r.versions)||r.versions.length>20)return invalid();
    const versions=r.versions.map(v=>projection(v,today())),nextCursor=r.nextCursor===null?null:waterRevision(r.nextCursor);
    if(versions.some((v,i)=>v.waterId!==target||before!==null&&v.revision>=before||i>0&&v.revision!==versions[i-1].revision-1)
    ||before!==null&&versions.length>0&&versions[0].revision!==before-1
    ||nextCursor!==null&&(versions.length!==20||nextCursor!==versions.at(-1)?.revision||nextCursor<=1)||versions.length===0&&(before===null||before>1)
    ||nextCursor===null&&versions.length>0&&versions.at(-1)?.revision!==1)return invalid();
    return {versions,nextCursor};
   }catch(error){if(error instanceof NutritionPersistenceError)throw error;return invalid();}
  },
 };
}
