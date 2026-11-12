import test from 'node:test';import assert from 'node:assert/strict';
import {createNutritionPersistence,NutritionPersistenceError,type NutritionRpcClient} from '../lib/nutrition-persistence';
import {createNutritionWaterPersistence} from '../lib/nutrition-water-persistence';
import {createNutritionDocumentPersistence} from '../lib/nutrition-document-persistence';
import {waterCommand} from './native-water-fixture';import {documentCommand} from './native-document-fixture';
import {id} from './foundation-fixture';import {composition} from './nutrition-db-fixture';import {businessToday} from '../lib/care';
const context={organizationId:id(10),clientId:id(100)};
test('a stalled save in every nutritional resource becomes uncertain within the deadline without retrying',async()=>{
 let calls=0;const transport:NutritionRpcClient={rpc(){calls++;return {abortSignal(signal){return new Promise(resolve=>{const abort=()=>resolve({data:null,error:{code:''}});if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});}};}};
 const ignoring:NutritionRpcClient={rpc(){return {abortSignal(){return new Promise(()=>{});}};}};
 const meals=createNutritionPersistence(transport,context,businessToday),water=createNutritionWaterPersistence(transport,context,businessToday),documents=createNutritionDocumentPersistence(transport,context);
 const meal={contractVersion:1,requestId:id(8500),mealId:null,expectedRevision:0,consumedOn:businessToday(),mealKind:'other',operation:'save',items:[{label:'Synthetic food',source:'manual',quantity:{amount:100,unit:'g'},composition}]};
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const result=await Promise.race([Promise.all([meals.save(meal),water.save(waterCommand()),documents.save(documentCommand()),createNutritionPersistence(ignoring,context,businessToday).diary(businessToday())].map(async request=>{try{await request;return 'unexpected-save';}catch(e){return e instanceof NutritionPersistenceError?e.kind:'unexpected-error';}})),new Promise(resolve=>{timer=setTimeout(()=>resolve('deadline-missing'),9000);})]);
  assert.deepEqual(result,['uncertain','uncertain','uncertain','unavailable']);assert.equal(calls,3,'A timeout must not repeat a mutation');
 }finally{clearTimeout(timer);meals.dispose();water.dispose();documents.dispose();}
});
