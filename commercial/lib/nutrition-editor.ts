import {parseNutritionCommandV1,type NutritionItemV1} from './nutrition-command';
import type {DocumentVersion} from './nutrition-document-persistence';
import type {Dish,FrozenDish,PlanBody,RecipeBody} from './nutrition-document-command';
export type FoodDraft={key:string;label:string;grams:string;calories:string;protein:string;carbs:string;fat:string};
const keys=['calories','protein','carbs','fat'] as const;
export function foodDraft(item?:NutritionItemV1):FoodDraft{
 return {key:crypto.randomUUID(),label:item?.label||'',grams:item?String(item.quantity.amount):'100',...Object.fromEntries(keys.map(k=>[k,item?.composition.nutrients[k]===null||!item?'':String(item.composition.nutrients[k])]))} as FoodDraft;
}
export function foodItems(drafts:FoodDraft[]):NutritionItemV1[]{
 const items=drafts.map(d=>({label:d.label,source:'manual',quantity:{amount:Number(d.grams),unit:'g'},composition:{contractVersion:1,basis:{amount:100,unit:'g'},nutrients:Object.fromEntries(keys.map(k=>[k,d[k]===''?null:Number(d[k])]))}}));
 return parseNutritionCommandV1({contractVersion:1,requestId:'00000000-0000-0000-0000-000000000001',mealId:null,expectedRevision:0,consumedOn:'2000-01-01',mealKind:'other',operation:'save',items},'2000-01-01').items;
}
/** Remove resolved snapshots ONLY to restore editable references, never their revision. */
export function editableDocument(version:DocumentVersion):RecipeBody|PlanBody{
 if(version.kind==='recipe')return structuredClone(version.body as RecipeBody);
 const body=version.body as PlanBody<FrozenDish>;
 const dish=(d:FrozenDish):Dish=>d.source==='manual'?structuredClone(d):{source:'recipe',recipeId:d.recipeId,revision:d.revision};
 return {title:body.title,notes:body.notes,meals:body.meals.map(m=>({...m,primary:dish(m.primary),alternatives:m.alternatives.map(a=>({...a,dish:dish(a.dish)}))}))};
}
