import {foodDraft,foodItems,type FoodDraft} from './nutrition-editor';
import type {Dish,PlanBody} from './nutrition-document-command';
export type DishDraft={source:'manual'|'recipe';foods:FoodDraft[];recipeId:string;revision:string};
export type MealDraft={id:string;label:string;time:string;primary:DishDraft;alternatives:{id:string;label:string;dish:DishDraft}[]};
export function dishDraft(dish?:Dish):DishDraft{return {source:dish?.source||'manual',foods:dish?.source==='manual'?dish.items.map(foodDraft):[foodDraft()],recipeId:dish?.source==='recipe'?dish.recipeId:'',revision:dish?.source==='recipe'?String(dish.revision):''};}
export function mealDraft(meal?:PlanBody['meals'][number]):MealDraft{return meal?{id:meal.id,label:meal.label,time:meal.time||'',primary:dishDraft(meal.primary),alternatives:meal.alternatives.map(a=>({...a,dish:dishDraft(a.dish)}))}:{id:crypto.randomUUID(),label:'',time:'',primary:dishDraft(),alternatives:[]};}
export function planBody(title:string,notes:string,meals:MealDraft[]):PlanBody{
 const dish=(d:DishDraft):Dish=>d.source==='manual'?{source:'manual',items:foodItems(d.foods)}:{source:'recipe',recipeId:d.recipeId,revision:Number(d.revision)};
 return {title,notes:notes||null,meals:meals.map(m=>({id:m.id,label:m.label,time:m.time||null,primary:dish(m.primary),alternatives:m.alternatives.map(a=>({id:a.id,label:a.label,dish:dish(a.dish)}))}))};
}
