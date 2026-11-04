/** Prepared transport only. No app imports, new client/login/storage or demo fallback. */
import {NutritionPersistenceError,type NutritionRpcClient} from './nutrition-persistence';
import {parseDocumentBody,parseDocumentCommand,documentText,type DocumentKind,type RecipeBody,type PlanBody,type FrozenDish} from './nutrition-document-command';
import {waterObject as object,waterId as uuid,waterRevision as revision} from './nutrition-water-command';
export type DocumentVersion={documentId:string;kind:DocumentKind;revision:number;status:'draft'|'published'|'withdrawn';body:RecipeBody|PlanBody<FrozenDish>;reason:string|null;recordedBy:string};
const invalid=():never=>{throw new NutritionPersistenceError('invalid-response');};
function receipt(value:unknown,saved=false){try{const v=object(value,saved?['documentId','revision','replayed']:['documentId','revision']);if(saved&&typeof v.replayed!=='boolean')return invalid();return {documentId:uuid(v.documentId),revision:revision(v.revision),...(saved?{replayed:v.replayed as boolean}:{})};}catch{return invalid();}}
function version(value:unknown):DocumentVersion{
 try{const v=object(value,['documentId','kind','revision','status','body','reason','recordedBy']),rev=revision(v.revision);
  if(!['recipe','plan'].includes(v.kind as string)||!['draft','published','withdrawn'].includes(v.status as string)||rev===1&&(v.status!=='draft'||v.reason!==null)||rev>1&&(documentText(v.reason,300,3)!==v.reason))return invalid();
  return {documentId:uuid(v.documentId),kind:v.kind as DocumentKind,revision:rev,status:v.status as DocumentVersion['status'],body:parseDocumentBody(v.kind as DocumentKind,v.body,true) as DocumentVersion['body'],reason:v.reason as string|null,recordedBy:uuid(v.recordedBy)};
 }catch{return invalid();}
}
export function createNutritionDocumentPersistence(client:NutritionRpcClient,context:{organizationId:string;clientId:string}){
 const org=uuid(context.organizationId),pupil=uuid(context.clientId),controller=new AbortController();
 const active=()=>{if(controller.signal.aborted)throw new NutritionPersistenceError('stale');};
 async function call(name:string,args:Record<string,unknown>,mutation=false){
  active();let result;try{result=await client.rpc(name,{p_org:org,p_client:pupil,...args}).abortSignal(controller.signal);}catch{active();throw new NutritionPersistenceError(mutation?'uncertain':'unavailable');}active();
  if(!result||typeof result!=='object'||!Object.hasOwn(result,'data')||!Object.hasOwn(result,'error'))throw new NutritionPersistenceError(mutation?'uncertain':'invalid-response');
  if(result.error){const c=result.error.code;throw new NutritionPersistenceError(c==='42501'||c==='PT403'?'denied':c==='PT409'||c==='23514'?'conflict':c==='42883'||c==='PGRST202'?'unavailable':mutation?'uncertain':'unavailable');}return result.data;
 }
 return {
  dispose(){controller.abort();},
  async save(input:unknown){active();const command=parseDocumentCommand(input),data=await call('aura_nutrition_document_save',{p_command:command},true);try{return receipt(data,true);}catch{throw new NutritionPersistenceError('uncertain');}},
  async requestStatus(requestId:string){active();const data=await call('aura_nutrition_document_request_status',{p_request:uuid(requestId)});return data===null?null:receipt(data);},
  async list(kind:DocumentKind,after:string|null=null){
   active();if(!['recipe','plan'].includes(kind))throw new TypeError('Invalid kind');const cursor=after===null?null:uuid(after);
   try{const v=object(await call('aura_nutrition_document_list',{p_kind:kind,p_after:cursor}),['documents','nextCursor']);if(!Array.isArray(v.documents)||v.documents.length>20)return invalid();
    const documents=v.documents.map(value=>{const d=object(value,['current','published']),current=version(d.current),published=d.published===null?null:version(d.published);
     if(current.kind!==kind||published&&(published.kind!==kind||published.documentId!==current.documentId||published.status!=='published'||published.revision>current.revision)
     ||current.status==='published'&&(!published||JSON.stringify(published)!==JSON.stringify(current))||current.status==='withdrawn'&&published!==null||current.status==='draft'&&published&&published.revision>=current.revision)return invalid();return {current,published};
    }),nextCursor=v.nextCursor===null?null:uuid(v.nextCursor);
    if(documents.some((d,i)=>cursor!==null&&d.current.documentId<=cursor||i>0&&d.current.documentId<=documents[i-1].current.documentId)||nextCursor!==null&&(documents.length!==20||nextCursor!==documents.at(-1)?.current.documentId))return invalid();return {documents,nextCursor};
   }catch(error){if(error instanceof NutritionPersistenceError)throw error;return invalid();}
  },
  async history(documentId:string,before:number|null=null){
   active();const id=uuid(documentId);if(before!==null)revision(before);
   try{const v=object(await call('aura_nutrition_document_history',{p_document:id,p_before:before}),['versions','nextCursor']);if(!Array.isArray(v.versions)||v.versions.length>20)return invalid();
    const versions=v.versions.map(version),nextCursor=v.nextCursor===null?null:revision(v.nextCursor);
    if(versions.some((r,i)=>r.documentId!==id||r.kind!==versions[0].kind||i>0&&r.revision!==versions[i-1].revision-1)||before!==null&&versions.length>0&&versions[0].revision!==before-1
    ||nextCursor!==null&&(versions.length!==20||nextCursor!==versions.at(-1)?.revision||nextCursor<=1)||versions.length===0&&(before===null||before>1)||nextCursor===null&&versions.length>0&&versions.at(-1)?.revision!==1)return invalid();return {versions,nextCursor};
   }catch(error){if(error instanceof NutritionPersistenceError)throw error;return invalid();}
  },
 };
}
