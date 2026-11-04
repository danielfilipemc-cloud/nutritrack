import {parseNutritionCommandV1,type NutritionItemV1} from './nutrition-command';
import {waterObject as object,waterId as uuid,waterRevision as revision} from './nutrition-water-command';
export type DocumentKind='recipe'|'plan';
export type RecipeBody={title:string;notes:string|null;items:NutritionItemV1[]};
export type Dish={source:'manual';items:NutritionItemV1[]}|{source:'recipe';recipeId:string;revision:number};
export type FrozenDish=Extract<Dish,{source:'manual'}>|(Extract<Dish,{source:'recipe'}>&{snapshot:RecipeBody});
export type PlanBody<D=Dish>={title:string;notes:string|null;meals:{id:string;label:string;time:string|null;primary:D;alternatives:{id:string;label:string;dish:D}[]}[]};
export type DocumentCommand={contractVersion:1;requestId:string;documentId:string|null;kind:DocumentKind;expectedRevision:number;operation:'save'|'publish'|'withdraw';body:RecipeBody|PlanBody|null;reason:string|null};
export function documentText(value:unknown,max:number,min=1):string{
 if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value)||[...value].some(c=>{const n=c.codePointAt(0)!;return n>=0xd800&&n<=0xdfff;}))throw new TypeError('Invalid document text');
 const text=value.replace(/^ +| +$/g,'');if([...text].length<min||[...text].length>max)throw new RangeError('Invalid document text length');return text;
}
function items(value:unknown):NutritionItemV1[]{
 if(!Array.isArray(value)||value.length<1||value.length>8)throw new RangeError('Invalid ingredient count');
 // Reuse the bounded nutritional contract; document labels use the SQL-compatible space trim.
 const source=value.map(i=>{const v=object(i,['label','quantity','composition','source']);return {...v,label:documentText(v.label,120)};});
 const parsed=parseNutritionCommandV1({contractVersion:1,requestId:'00000000-0000-0000-0000-000000000001',mealId:null,expectedRevision:0,consumedOn:'2000-01-01',mealKind:'other',operation:'save',items:source.map(i=>({...i,label:'ingredient'}))},'2000-01-01').items;
 return parsed.map((item,i)=>({...item,label:source[i].label}));
}
export function parseRecipeBody(value:unknown):RecipeBody{
 const v=object(value,['title','notes','items']);return {title:documentText(v.title,120),notes:v.notes===null?null:documentText(v.notes,2000),items:items(v.items)};
}
export function parseDocumentBody(kind:DocumentKind,value:unknown,resolved=false):RecipeBody|PlanBody<Dish|FrozenDish>{
 if(kind==='recipe')return parseRecipeBody(value);if(kind!=='plan')throw new TypeError('Invalid document kind');
 const v=object(value,['title','notes','meals']);if(!Array.isArray(v.meals)||v.meals.length<1||v.meals.length>12)throw new RangeError('Invalid plan meal count');
 const ids=new Set<string>(),unique=(value:unknown)=>{const id=uuid(value);if(ids.has(id))throw new TypeError('Duplicate plan identity');ids.add(id);return id;};
 const dish=(value:unknown):Dish|FrozenDish=>{
  if(value&&typeof value==='object'&&(value as {source:unknown}).source==='manual'){const d=object(value,['source','items']);return {source:'manual',items:items(d.items)};}
  const d=object(value,resolved?['source','recipeId','revision','snapshot']:['source','recipeId','revision']);if(d.source!=='recipe')throw new TypeError('Invalid dish source');
  return {source:'recipe',recipeId:uuid(d.recipeId),revision:revision(d.revision),...(resolved?{snapshot:parseRecipeBody(d.snapshot)}:{})};
 };
 return {title:documentText(v.title,120),notes:v.notes===null?null:documentText(v.notes,2000),meals:v.meals.map(value=>{
  const m=object(value,['id','label','time','primary','alternatives']);if(m.time!==null&&(typeof m.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time))||!Array.isArray(m.alternatives)||m.alternatives.length>3)throw new TypeError('Invalid plan meal');
  return {id:unique(m.id),label:documentText(m.label,120),time:m.time as string|null,primary:dish(m.primary),alternatives:m.alternatives.map(value=>{const a=object(value,['id','label','dish']);return {id:unique(a.id),label:documentText(a.label,120),dish:dish(a.dish)};})};
 })};
}
export function parseDocumentCommand(input:unknown):DocumentCommand{
 const v=object(input,['contractVersion','requestId','documentId','kind','expectedRevision','operation','body','reason']);
 const documentId=v.documentId===null?null:uuid(v.documentId),expectedRevision=revision(v.expectedRevision,0);
 if(v.contractVersion!==1||!['recipe','plan'].includes(v.kind as string)||!['save','publish','withdraw'].includes(v.operation as string)||!documentId&&(expectedRevision!==0||v.operation!=='save'||v.reason!==null)||documentId&&expectedRevision<1)throw new TypeError('Invalid document command');
 if(v.operation!=='save'&&v.body!==null)throw new TypeError('Publication cannot replace draft');
 return {contractVersion:1,requestId:uuid(v.requestId),documentId,kind:v.kind as DocumentKind,expectedRevision,operation:v.operation as DocumentCommand['operation'],body:v.operation==='save'?parseDocumentBody(v.kind as DocumentKind,v.body) as RecipeBody|PlanBody:null,reason:documentId?documentText(v.reason,300,3):null};
}
