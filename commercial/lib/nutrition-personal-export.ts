import {NutritionPersistenceError,type NutritionRpcClient} from './nutrition-persistence';
import {nutritionRequest} from './nutrition-request';
const collections=['meals','mealVersions','items','mealRequests','mealEvents','targets','targetVersions','targetRequests'] as const;
type Collection=typeof collections[number];
type Scope={organizationId:string;clientId:string;userId:string};
export type PersonalNutritionExport={format:'aura.private-nutrition.v1';complete:true;generatedAt:string;scope:Scope;sha256:string;counts:Record<Collection,number>;data:Record<Collection,Record<string,unknown>[]>};
const invalid=():never=>{throw new NutritionPersistenceError('invalid-response');};
function object(value:unknown,keys:readonly string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))return invalid();return value as Record<string,unknown>;}
const positive=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
export function parsePersonalNutritionExport(value:unknown,scope:Scope):PersonalNutritionExport{
 const r=object(value,['format','complete','generatedAt','scope','sha256','counts','data']),s=object(r.scope,['organizationId','clientId','userId']);
 if(r.format!=='aura.private-nutrition.v1'||r.complete!==true||typeof r.generatedAt!=='string'||!Number.isFinite(Date.parse(r.generatedAt))||typeof r.sha256!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256)||Object.entries(scope).some(([k,v])=>s[k]!==v))return invalid();
 const counts=object(r.counts,collections),data=object(r.data,collections);let total=0;
 for(const key of collections){const rows=data[key],n=counts[key];if(!Array.isArray(rows)||typeof n!=='number'||!Number.isSafeInteger(n)||n<0||rows.length!==n)return invalid();total+=n;for(const row of rows){if(!row||typeof row!=='object'||Array.isArray(row)||row.organization_id!==scope.organizationId||Object.hasOwn(row,'client_id')&&row.client_id!==scope.clientId||['personal_user_id','created_by','recorded_by','actor_id'].some(k=>Object.hasOwn(row,k)&&row[k]!==scope.userId))return invalid();}}
 if(total>20000||JSON.stringify(r).length>8388608)return invalid();
 const rows=data as PersonalNutritionExport['data'];
 for(const [heads,versions,headId,versionId] of [[rows.meals,rows.mealVersions,'id','meal_id'],[rows.targets,rows.targetVersions,'id','target_id']] as const){
  if(new Set(heads.map(h=>h[headId])).size!==heads.length)return invalid();
  const ids=new Set(heads.map(h=>h[headId]));if(versions.some(v=>!ids.has(v[versionId])))return invalid();
  for(const head of heads){if(!positive(head.current_revision))return invalid();const history=versions.filter(v=>v[versionId]===head[headId]).sort((a,b)=>Number(a.revision)-Number(b.revision));if(history.length!==head.current_revision||history.some((v,i)=>v.revision!==i+1))return invalid();}
 }
 const mealVersion=new Set(rows.mealVersions.map(v=>`${v.meal_id}:${v.revision}`)),targetVersion=new Set(rows.targetVersions.map(v=>`${v.target_id}:${v.revision}`));
 if(rows.items.some(i=>!mealVersion.has(`${i.meal_id}:${i.revision}`))||rows.mealRequests.some(r=>!mealVersion.has(`${r.meal_id}:${r.revision}`))||rows.targetRequests.some(r=>!targetVersion.has(`${r.target_id}:${r.revision}`)))return invalid();
 const receipts=new Set(rows.mealRequests.map(r=>r.request_id));if(rows.mealEvents.some(e=>!receipts.has(e.request_id)))return invalid();
 for(const v of rows.mealVersions){const items=rows.items.filter(i=>i.meal_id===v.meal_id&&i.revision===v.revision).sort((a,b)=>Number(a.position)-Number(b.position));if(items.length<1||items.length>50||items.some((i,n)=>i.position!==n+1))return invalid();}
 return r as PersonalNutritionExport;
}
export function createPersonalNutritionExport(client:NutritionRpcClient,scope:Scope){
 const controller=new AbortController();return {dispose(){controller.abort();},async read(){
  if(controller.signal.aborted)throw new NutritionPersistenceError('stale');
  let result;try{result=await nutritionRequest(controller.signal,signal=>client.rpc('aura_student_nutrition_export',{p_org:scope.organizationId,p_client:scope.clientId}).abortSignal(signal));}catch{throw new NutritionPersistenceError(controller.signal.aborted?'stale':'unavailable');}
  if(controller.signal.aborted)throw new NutritionPersistenceError('stale');
  if(!result||result.error){if(result?.error?.code==='54000')throw new Error('A exportação completa excede o limite interativo. Pede uma exportação assistida; nenhum ficheiro parcial foi criado.');throw new NutritionPersistenceError(result?.error?.code==='42501'?'denied':'unavailable');}
  return parsePersonalNutritionExport(result.data,scope);
 }};
}
