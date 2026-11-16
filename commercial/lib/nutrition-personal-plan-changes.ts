import {parsePersonalPlanState,type PersonalPlanScope} from './nutrition-personal-plan';
import {waterId as uuid,waterObject as object,waterRevision as revision} from './nutrition-water-command';
import {documentText,type FrozenDish,type PlanBody} from './nutrition-document-command';
import {NutritionPersistenceError,type NutritionRpcClient} from './nutrition-persistence';
import {nutritionRequest} from './nutrition-request';
export type PlanChange={contractVersion:1;requestId:string;expectedRevision:number;operation:'revise'|'feedback';body:PlanBody<FrozenDish>|null;comment:string};
export type PlanChangeReceipt={requestId:string;kind:PlanChange['operation'];planRevision:number;entryRevision:number;replayed:boolean};
export type PlanEntry={entryRevision:number;planRevision:number;kind:PlanChange['operation'];comment:string;recordedAt:string};
export function parsePlanChange(raw:unknown):PlanChange{
 const v=object(raw,['contractVersion','requestId','expectedRevision','operation','body','comment']);
 if(v.contractVersion!==1||!['revise','feedback'].includes(v.operation as string)||(v.operation==='feedback')!==(v.body===null))throw new TypeError('Invalid plan change');
 let body:PlanChange['body']=null;
 if(v.body!==null){const scope={organizationId:'00000000-0000-0000-0000-000000000001',clientId:'00000000-0000-0000-0000-000000000002',userId:'00000000-0000-0000-0000-000000000003'};body=parsePersonalPlanState({scope,revision:1,status:'available',recordedAt:'2000-01-01T00:00:00Z',sourceLabel:'Validation',body:v.body},scope).body;}
 const comment=documentText(v.comment,v.operation==='revise'?300:1000);if(comment.length<3)throw new TypeError('Descreve a alteração ou o feedback (mínimo 3 caracteres).');
 return {contractVersion:1,requestId:uuid(v.requestId),expectedRevision:revision(v.expectedRevision,1),operation:v.operation as PlanChange['operation'],body,comment};
}
function receipt(raw:unknown,requestId:string):PlanChangeReceipt{
 const v=object(raw,['requestId','kind','planRevision','entryRevision','replayed']);if(uuid(v.requestId)!==uuid(requestId)||!['revise','feedback'].includes(v.kind as string)||typeof v.replayed!=='boolean')throw new TypeError('Invalid receipt');
 return {requestId:uuid(v.requestId),kind:v.kind as PlanChange['operation'],planRevision:revision(v.planRevision,1),entryRevision:revision(v.entryRevision,1),replayed:v.replayed};
}
export function parsePlanEntries(raw:unknown,scope:PersonalPlanScope){
 const v=object(raw,['format','complete','scope','count','entries','sha256']);
 if(v.format!=='aura.private-plan-feedback.v1'||v.complete!==true||!Array.isArray(v.entries)||v.entries.length>1000||v.count!==v.entries.length||typeof v.sha256!=='string'||!/^[a-f0-9]{64}$/.test(v.sha256)||new TextEncoder().encode(JSON.stringify(v.entries)).byteLength>8388608)throw new TypeError('Incomplete feedback export');
 parsePersonalPlanState({scope:v.scope,revision:0,status:'none',body:null,sourceLabel:null,recordedAt:null},scope);
 const entries:PlanEntry[]=v.entries.map((raw,i)=>{const e=object(raw,['entryRevision','planRevision','kind','comment','recordedAt']);if(revision(e.entryRevision,1)!==i+1||!['revise','feedback'].includes(e.kind as string)||typeof e.recordedAt!=='string'||e.recordedAt.length>40||!Number.isFinite(Date.parse(e.recordedAt)))throw new TypeError('Invalid feedback sequence');const comment=documentText(e.comment,e.kind==='revise'?300:1000);if(comment.length<3)throw new TypeError('Invalid feedback');return {entryRevision:i+1,planRevision:revision(e.planRevision,1),kind:e.kind as PlanChange['operation'],comment,recordedAt:e.recordedAt};});
 return {format:'aura.private-plan-feedback.v1' as const,complete:true as const,scope,count:entries.length,entries,sha256:v.sha256};
}
export function createPersonalPlanChanges(client:NutritionRpcClient,scope:PersonalPlanScope){
 const org=uuid(scope.organizationId),pupil=uuid(scope.clientId),controller=new AbortController();uuid(scope.userId);
 const active=()=>{if(controller.signal.aborted)throw new NutritionPersistenceError('stale');};
 async function call(name:string,args:Record<string,unknown>,mutation=false){active();let r;try{r=await nutritionRequest(controller.signal,signal=>client.rpc(name,{p_org:org,p_client:pupil,...args}).abortSignal(signal));}catch{active();throw new NutritionPersistenceError(mutation?'uncertain':'unavailable');}active();if(!r||typeof r!=='object'||!Object.hasOwn(r,'data')||!Object.hasOwn(r,'error'))throw new NutritionPersistenceError(mutation?'uncertain':'invalid-response');if(r.error)throw new NutritionPersistenceError(['42501','PT403'].includes(r.error.code||'')?'denied':r.error.code==='PT409'?'conflict':mutation?'uncertain':'unavailable');return r.data;}
 return {dispose(){controller.abort();},async save(input:unknown){const c=parsePlanChange(input),r=await call('aura_student_nutrition_plan_change',{p_command:c},true);try{const next=receipt(r,c.requestId);if(next.kind!==c.operation||next.planRevision!==c.expectedRevision+(c.operation==='revise'?1:0))throw new TypeError('Mismatched receipt');return next;}catch{throw new NutritionPersistenceError('uncertain');}},async status(requestId:string){const data=await call('aura_student_nutrition_plan_change_status',{p_request:uuid(requestId)});try{return data===null?null:receipt(data,requestId);}catch{throw new NutritionPersistenceError('invalid-response');}},async history(before:number|null=null){if(before!==null)revision(before,1);const raw=await call('aura_student_nutrition_plan_feedback_history',{p_before:before});try{return parsePlanEntryPage(raw,scope,before);}catch{throw new NutritionPersistenceError('invalid-response');}},async entries(){const raw=await call('aura_student_nutrition_plan_feedback_export',{});try{return parsePlanEntries(raw,scope);}catch{throw new NutritionPersistenceError('invalid-response');}}};
}
export function parsePlanEntryPage(raw:unknown,scope:PersonalPlanScope,before:number|null=null){
 const v=object(raw,['scope','entries','nextBefore']);parsePersonalPlanState({scope:v.scope,revision:0,status:'none',body:null,sourceLabel:null,recordedAt:null},scope);
 if(!Array.isArray(v.entries)||v.entries.length>20)throw new TypeError('Invalid feedback page');
 const entries:PlanEntry[]=v.entries.map((raw)=>{const e=object(raw,['entryRevision','planRevision','kind','comment','recordedAt']);if(!['revise','feedback'].includes(e.kind as string)||typeof e.recordedAt!=='string'||e.recordedAt.length>40||!Number.isFinite(Date.parse(e.recordedAt)))throw new TypeError('Invalid feedback entry');const comment=documentText(e.comment,e.kind==='revise'?300:1000);if(comment.length<3)throw new TypeError('Invalid feedback comment');return {entryRevision:revision(e.entryRevision,1),planRevision:revision(e.planRevision,1),kind:e.kind as PlanChange['operation'],comment,recordedAt:e.recordedAt};});
 const nextBefore=v.nextBefore===null?null:revision(v.nextBefore,1),last=entries.at(-1)?.entryRevision;
 if(entries.some((e,i)=>i>0&&e.entryRevision!==entries[i-1].entryRevision-1)||before!==null&&entries.length>0&&entries[0].entryRevision!==before-1||nextBefore!==null&&(entries.length!==20||nextBefore!==last||nextBefore<=1)||nextBefore===null&&entries.length>0&&last!==1||entries.length===0&&before!==null&&before>1)throw new TypeError('Incomplete feedback page');
 return {entries,nextBefore};
}
