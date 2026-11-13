import {parseManualTargets,type ManualTargetsV1} from './nutrition-planning';
import {validDate} from './validation';
import {nutritionRequest} from './nutrition-request';
import {NutritionPersistenceError,type NutritionRpcClient} from './nutrition-persistence';
export type PersonalTargetCommand={contractVersion:1;requestId:string;expectedRevision:number;targetDate:string;targets:ManualTargetsV1;reason:string};
export type PersonalTargetState={targetDate:string;revision:number;targets:ManualTargetsV1|null};
type Receipt={targetDate:string;revision:number};
function object(value:unknown,fields:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||fields.some(f=>!Object.hasOwn(value,f)))throw new TypeError('Contrato de referências inválido.');return value as Record<string,unknown>;}
function uuid(v:unknown){if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v))throw new TypeError('Identificador inválido.');return v.toLowerCase();}
function date(v:unknown){if(typeof v!=='string'||!validDate(v)||v.startsWith('0000-'))throw new TypeError('Dia inválido.');return v;}
function revision(v:unknown,min=0){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min)throw new TypeError('Revisão inválida.');return v;}
export function parsePersonalTargetCommand(input:unknown):PersonalTargetCommand{
 const v=object(input,['contractVersion','requestId','expectedRevision','targetDate','targets','reason']);
 if(v.contractVersion!==1||typeof v.reason!=='string'||Array.from(v.reason.trim()).length<3||Array.from(v.reason.trim()).length>300||/[\u0000-\u001f\u007f]/.test(v.reason)||revision(v.expectedRevision)>=Number.MAX_SAFE_INTEGER)throw new TypeError('Revê a revisão e o motivo, com 3 a 300 caracteres.');
 return {contractVersion:1,requestId:uuid(v.requestId),expectedRevision:revision(v.expectedRevision),targetDate:date(v.targetDate),targets:parseManualTargets(v.targets),reason:v.reason.trim()};
}
export function createPersonalTargetPersistence(client:NutritionRpcClient,context:{organizationId:string;clientId:string}){
 const org=uuid(context.organizationId),pupil=uuid(context.clientId),controller=new AbortController();
 async function call(name:string,args:Record<string,unknown>,mutation=false){
  if(controller.signal.aborted)throw new NutritionPersistenceError('stale');
  let r:Awaited<ReturnType<ReturnType<NutritionRpcClient['rpc']>['abortSignal']>>;
  try{r=await nutritionRequest(controller.signal,signal=>client.rpc(name,{p_org:org,p_client:pupil,...args}).abortSignal(signal));}catch{throw new NutritionPersistenceError(controller.signal.aborted?'stale':mutation?'uncertain':'unavailable');}
  if(controller.signal.aborted)throw new NutritionPersistenceError('stale');
  if(!r||typeof r!=='object'||!Object.hasOwn(r,'error')||!Object.hasOwn(r,'data'))throw new NutritionPersistenceError(mutation?'uncertain':'invalid-response');
  if(r.error)throw new NutritionPersistenceError(['42501','PT403'].includes(r.error.code||'')?'denied':r.error.code==='PT409'?'conflict':mutation?'uncertain':'unavailable');
  return r.data;
 }
 function receipt(v:unknown,saved=false):Receipt&{replayed?:boolean}{const r=object(v,saved?['targetDate','revision','replayed']:['targetDate','revision']);if(saved&&typeof r.replayed!=='boolean')throw new TypeError();return {targetDate:date(r.targetDate),revision:revision(r.revision,1),...(saved?{replayed:r.replayed as boolean}:{})};}
 const projection=(v:unknown,day:string):PersonalTargetState=>{const r=object(v,['targetDate','revision','targets']);const rev=revision(r.revision);if(date(r.targetDate)!==day||(rev===0)!==(r.targets===null))throw new TypeError();return {targetDate:day,revision:rev,targets:r.targets===null?null:parseManualTargets(r.targets)};};
 async function parsed<T>(read:()=>Promise<T>){try{return await read();}catch(e){if(e instanceof NutritionPersistenceError)throw e;throw new NutritionPersistenceError('invalid-response');}}
 return {dispose(){controller.abort();},
  async read(day:string){date(day);return parsed(async()=>projection(await call('aura_student_nutrition_targets_read',{p_date:day}),day));},
  async save(input:unknown){const c=parsePersonalTargetCommand(input),data=await call('aura_student_nutrition_targets_save',{p_command:c},true);try{const r=receipt(data,true);if(r.targetDate!==c.targetDate||r.revision!==c.expectedRevision+1)throw new TypeError();return r;}catch{throw new NutritionPersistenceError('uncertain');}},
  async requestStatus(requestId:string){return parsed(async()=>{const data=await call('aura_student_nutrition_targets_request_status',{p_request:uuid(requestId)});return data===null?null:receipt(data);});},
  async history(day:string,before:number|null=null){date(day);if(before!==null)revision(before,1);return parsed(async()=>{
   const r=object(await call('aura_student_nutrition_targets_history',{p_date:day,p_before:before}),['versions','nextCursor']);if(!Array.isArray(r.versions)||r.versions.length>20)throw new TypeError();
   const versions=r.versions.map(v=>{const x=object(v,['targetDate','revision','targets','reason']);if(typeof x.reason!=='string'||x.reason.length<3||x.reason.length>300)throw new TypeError();return {...projection({targetDate:x.targetDate,revision:x.revision,targets:x.targets},day),reason:x.reason};});
   const cursor=r.nextCursor===null?null:revision(r.nextCursor,2);
   if(versions.some((v,i)=>v.revision<1||!v.targets||(i>0&&v.revision!==versions[i-1].revision-1))||before!==null&&versions.length>0&&versions[0].revision!==before-1||before!==null&&before>1&&!versions.length||cursor!==null&&(versions.length!==20||cursor!==versions.at(-1)?.revision)||cursor===null&&versions.length>0&&versions.at(-1)?.revision!==1)throw new TypeError();
   return {versions,nextCursor:cursor};
  });},
 };
}
