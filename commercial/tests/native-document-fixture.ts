import {readFile} from 'node:fs/promises';
import {foundationFixture,id} from './foundation-fixture';
import {nutritionAccess,composition} from './nutrition-db-fixture';
import type {DocumentCommand,RecipeBody,PlanBody} from '../lib/nutrition-document-command';
import type {NutritionRpcClient} from '../lib/nutrition-persistence';
export const documentSql=new URL('../supabase/prepared/20261028160819_nutrition_documents_native.sql',import.meta.url);
export const recipeBody=():RecipeBody=>({title:'Receita fictícia',notes:null,items:[{label:'Ingrediente fictício',source:'manual',quantity:{amount:150,unit:'g'},composition:structuredClone(composition)}]});
export const planBody=():PlanBody=>({title:'Plano fictício',notes:'Exemplo sem dados reais',meals:[{id:id(8000),label:'Refeição de exemplo',time:null,primary:{source:'manual',items:recipeBody().items},alternatives:[]}]});
export const documentCommand=(request=8001,kind:'recipe'|'plan'='recipe'):DocumentCommand=>({contractVersion:1,requestId:id(request),documentId:null,kind,expectedRevision:0,operation:'save',body:kind==='recipe'?recipeBody():planBody(),reason:null});
export async function documentFixture(){const f=await foundationFixture();await f.db.exec('begin;'+await readFile(documentSql,'utf8')+'commit;');await nutritionAccess(f);return f;}
export type DocumentFixture=Awaited<ReturnType<typeof documentFixture>>;
export function documentRpc(f:DocumentFixture):NutritionRpcClient{
 const sql:Record<string,[string,(a:Record<string,unknown>)=>unknown[]]>={
  aura_nutrition_document_save:['select aura_nutrition_document_save($1,$2,$3::jsonb) x',a=>[a.p_org,a.p_client,JSON.stringify(a.p_command)]],
  aura_nutrition_document_request_status:['select aura_nutrition_document_request_status($1,$2,$3) x',a=>[a.p_org,a.p_client,a.p_request]],
  aura_nutrition_document_list:['select aura_nutrition_document_list($1,$2,$3,$4) x',a=>[a.p_org,a.p_client,a.p_kind,a.p_after]],
  aura_nutrition_document_history:['select aura_nutrition_document_history($1,$2,$3,$4) x',a=>[a.p_org,a.p_client,a.p_document,a.p_before]],
 };
 return {rpc(name,args){return {async abortSignal(signal){if(signal.aborted)throw Error('aborted');const spec=sql[name];if(!spec)throw Error('Unexpected synthetic RPC');try{return {data:(await f.db.query<{x:unknown}>(spec[0],spec[1](args))).rows[0].x,error:null};}catch(error){return {data:null,error:{code:(error as {code:string}).code}};}}};}};
}
