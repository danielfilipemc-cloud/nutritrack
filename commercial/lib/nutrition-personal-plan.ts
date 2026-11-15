import {parseDocumentBody,documentText,type FrozenDish,type PlanBody} from './nutrition-document-command';
import {waterId as uuid,waterObject as object,waterRevision as revision} from './nutrition-water-command';
import {nutritionRequest} from './nutrition-request';
import {NutritionPersistenceError,type NutritionRpcClient} from './nutrition-persistence';
export type PersonalPlanScope={organizationId:string;clientId:string;userId:string};
export type PersonalPlanState={scope:PersonalPlanScope;revision:number;status:'none'|'available'|'withdrawn';recordedAt:string|null;sourceLabel:string|null;body:PlanBody<FrozenDish>|null};
export function parsePersonalPlanExport(input:unknown,scope:PersonalPlanScope){
 const v=object(input,['format','complete','scope','count','versions','sha256']);
 if(v.format!=='aura.private-plan.v1'||v.complete!==true||!Array.isArray(v.versions)||v.versions.length>1000||v.count!==v.versions.length||typeof v.sha256!=='string'||!/^[a-f0-9]{64}$/.test(v.sha256)||new TextEncoder().encode(JSON.stringify(v.versions)).byteLength>8388608)throw new TypeError('Incomplete plan export');
 parsePersonalPlanState({scope:v.scope,revision:0,status:'none',recordedAt:null,sourceLabel:null,body:null},scope);
 const versions=v.versions.map((raw,i)=>{const row=object(raw,['revision','status','recordedAt','sourceLabel','body','reason']),{reason,...state}=row,parsed=parsePersonalPlanState({...state,scope:v.scope},scope);if(parsed.revision!==i+1||parsed.status==='none'||typeof reason!=='string'||reason.trim().length<3)throw new TypeError('Incomplete plan history');return {revision:parsed.revision,status:parsed.status,recordedAt:parsed.recordedAt,sourceLabel:parsed.sourceLabel,body:parsed.body,reason:documentText(reason,300)};});
 return {format:'aura.private-plan.v1' as const,complete:true as const,scope,count:versions.length,versions,sha256:v.sha256};
}
export function parsePersonalPlanState(input:unknown,expected:PersonalPlanScope):PersonalPlanState{
 const v=object(input,['scope','revision','status','recordedAt','sourceLabel','body']),s=object(v.scope,['organizationId','clientId','userId']);
 const scope={organizationId:uuid(s.organizationId),clientId:uuid(s.clientId),userId:uuid(s.userId)};
 if(scope.organizationId!==uuid(expected.organizationId)||scope.clientId!==uuid(expected.clientId)||scope.userId!==uuid(expected.userId))throw new TypeError('Foreign plan');
 const rev=revision(v.revision,0);
 if(v.status==='none'){
  if(rev!==0||v.recordedAt!==null||v.sourceLabel!==null||v.body!==null)throw new TypeError('Invalid empty plan');
  return {scope,revision:0,status:'none',recordedAt:null,sourceLabel:null,body:null};
 }
 if(!['available','withdrawn'].includes(v.status as string)||rev<1||typeof v.recordedAt!=='string'||!Number.isFinite(Date.parse(v.recordedAt))||v.recordedAt.length>40)throw new TypeError('Invalid plan version');
 const sourceLabel=documentText(v.sourceLabel,240);
 if((v.status==='withdrawn')!==(v.body===null))throw new TypeError('Invalid plan body');
 if(new TextEncoder().encode(JSON.stringify(v.body)).byteLength>65536)throw new TypeError('Plan too large');
 const body=v.body===null?null:parseDocumentBody('plan',v.body,true) as PlanBody<FrozenDish>;
 // The private consultation increment accepts manual frozen compositions only.
 // Recipe publication and serving conversions keep their separate contracts.
 if(body?.meals.some(m=>m.primary.source!=='manual'||m.alternatives.some(a=>a.dish.source!=='manual')))throw new TypeError('Unsupported private recipe');
 return {scope,revision:rev,status:v.status as 'available'|'withdrawn',recordedAt:v.recordedAt,sourceLabel,body};
}
export function createPersonalPlanReader(client:NutritionRpcClient,context:PersonalPlanScope){
 const scope={organizationId:uuid(context.organizationId),clientId:uuid(context.clientId),userId:uuid(context.userId)},controller=new AbortController();
 const active=()=>{if(controller.signal.aborted)throw new NutritionPersistenceError('stale');};
 async function call(name:string){
  active();let r;
  try{r=await nutritionRequest(controller.signal,signal=>client.rpc(name,{p_org:scope.organizationId,p_client:scope.clientId}).abortSignal(signal));}
  catch{active();throw new NutritionPersistenceError('unavailable');}active();
  if(!r||typeof r!=='object'||!Object.hasOwn(r,'data')||!Object.hasOwn(r,'error'))throw new NutritionPersistenceError('invalid-response');
  if(r.error)throw new NutritionPersistenceError(['42501','PT403'].includes(r.error.code||'')?'denied':'unavailable');
  return r.data;
 }
 return {dispose(){controller.abort();},async read(){const data=await call('aura_student_nutrition_plan_read');try{return parsePersonalPlanState(data,scope);}catch{throw new NutritionPersistenceError('invalid-response');}},async exportVersions(){const data=await call('aura_student_nutrition_plan_export');try{return parsePersonalPlanExport(data,scope);}catch{throw new NutritionPersistenceError('invalid-response');}}};
}
