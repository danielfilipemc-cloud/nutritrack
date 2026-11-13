/** Own-account transport over the SAME journal validators and request lifecycle.
 * RPC names are fixed here; the database separately authorizes self access.
 * Never substitute professional RPCs or accept a caller-selected namespace. */
import {createNutritionPersistence,NutritionPersistenceError,type NutritionRpcClient} from './nutrition-persistence';
import {nutritionRequest} from './nutrition-request';

const names:Record<string,string>={
 aura_nutrition_meal_save:'aura_student_nutrition_meal_save',
 aura_nutrition_diary:'aura_student_nutrition_diary',
 aura_nutrition_history:'aura_student_nutrition_history',
 aura_nutrition_request_status:'aura_student_nutrition_request_status',
};
export function createStudentNutritionPersistence(client:NutritionRpcClient,context:{organizationId:string;clientId:string},today:()=>string){
 const adapter=createNutritionPersistence({rpc(name,args){if(!Object.hasOwn(names,name))throw new TypeError('Unsupported own-account operation');return client.rpc(names[name],args);}},context,today);
 const controller=new AbortController();
 return {...adapter,dispose(){controller.abort();adapter.dispose();},async context():Promise<{canWrite:boolean}>{
  if(controller.signal.aborted)throw new NutritionPersistenceError('stale');
  let result:Awaited<ReturnType<ReturnType<NutritionRpcClient['rpc']>['abortSignal']>>;
  try{result=await nutritionRequest(controller.signal,signal=>client.rpc('aura_student_nutrition_context',{p_org:context.organizationId.toLowerCase(),p_client:context.clientId.toLowerCase()}).abortSignal(signal));}
  catch{throw new NutritionPersistenceError(controller.signal.aborted?'stale':'unavailable');}
  if(controller.signal.aborted)throw new NutritionPersistenceError('stale');
  if(!result||typeof result!=='object'||!Object.hasOwn(result,'error')||!Object.hasOwn(result,'data'))throw new NutritionPersistenceError('invalid-response');
  if(result.error)throw new NutritionPersistenceError(['42501','PT403'].includes(result.error.code||'')?'denied':'unavailable');
  const value=result.data;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Object.hasOwn(value,'canWrite')||typeof (value as {canWrite:unknown}).canWrite!=='boolean')throw new NutritionPersistenceError('invalid-response');
  return {canWrite:(value as {canWrite:boolean}).canWrite};
 }};
}
