import {blankMeal,nutritionDate,nutritionFoods,optionPortion,parseMealOption,type MealDraft,type MealOption,type NutritionEntry,type NutritionState} from './nutrition';
import type {DemoStudent} from './model';
export type Recipe={id:number;studentId:number;version:number;name:string;items:MealOption[];snapshots:ReturnType<typeof optionPortion>[]};
export type WaterEvent={id:number;studentId:number;requestId:string;date:string;time:string;ml:number;voided:boolean};
export type NativeNutrition={recipes:Recipe[];water:WaterEvent[];nextRecipe:number;nextWater:number};
export const nativeNutrition=(state:NutritionState):NativeNutrition=>state.native||{recipes:[],water:[],nextRecipe:1,nextWater:1};
const requireStudent=(id:number,students:readonly DemoStudent[])=>{if(!students.some(student=>student.id===id))throw Error('Aluno de exemplo inexistente.');};
const nameOf=(value:string)=>{const name=value.trim();if(name.length<2||name.length>80)throw Error('Indica um nome com 2 a 80 caracteres.');return name;};
const timeOf=(time:string)=>{if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Indica uma hora válida.');return time;};
const requestOf=(value:string)=>{if(!/^[a-zA-Z0-9_-]{1,80}$/.test(value))throw Error('Identificador do registo inválido.');return value;};
export function mainItems(draft:MealDraft):MealOption[]{
 const additional=draft.additional||[];if(!Array.isArray(additional)||additional.length>7)throw Error('Cada refeição permite até 8 alimentos.');
 return [{foodId:draft.foodId,grams:draft.grams},...additional].map(item=>parseMealOption(item.foodId,item.grams));
}
export function searchNutritionFoods(query:string){const words=query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-PT').split(/\s+/).filter(Boolean);return nutritionFoods.filter(food=>words.every(word=>food.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-PT').includes(word)));}
export function currentRecipes(state:NutritionState,studentId:number){const all=nativeNutrition(state).recipes.filter(recipe=>recipe.studentId===studentId);return all.filter(recipe=>!all.some(other=>other.id===recipe.id&&other.version>recipe.version));}
export function saveRecipe(state:NutritionState,studentId:number,draft:MealDraft,students:readonly DemoStudent[],editing:number|null=null,expectedVersion:number|null=null):NutritionState{
 requireStudent(studentId,students);const data=nativeNutrition(state),name=nameOf(draft.name),items=mainItems(draft);
 const previous=currentRecipes(state,studentId).find(recipe=>recipe.id===editing);
 if(editing!==null&&(!previous||previous.version!==expectedVersion))throw Error('A receita mudou ou não pertence a este aluno. O rascunho foi preservado.');
 if(editing===null&&currentRecipes(state,studentId).length>=20)throw Error('Limite de 20 receitas por aluno.');
 if(previous&&previous.version>=20)throw Error('Limite de 20 versões por receita.');
 const recipe:Recipe={id:previous?.id??data.nextRecipe,studentId,version:(previous?.version||0)+1,name,items,snapshots:items.map(optionPortion)};
 return {...state,native:{...data,nextRecipe:data.nextRecipe+(previous?0:1),recipes:[...data.recipes,structuredClone(recipe)]}};
}
export function recipeDraft(state:NutritionState,studentId:number,id:number,version:number):MealDraft{
 const recipe=nativeNutrition(state).recipes.find(recipe=>recipe.studentId===studentId&&recipe.id===id&&recipe.version===version);if(!recipe)throw Error('Receita deste aluno não encontrada.');
 return {...blankMeal,name:recipe.name,time:'',foodId:recipe.items[0].foodId,grams:String(recipe.items[0].grams),additional:recipe.items.slice(1).map(item=>({foodId:item.foodId,grams:String(item.grams)})),recipeSource:{id:recipe.id,version:recipe.version}};
}
export function requireRecipeSource(state:NutritionState,studentId:number,draft:MealDraft){if(draft.recipeSource&&!nativeNutrition(state).recipes.some(recipe=>recipe.studentId===studentId&&recipe.id===draft.recipeSource!.id&&recipe.version===draft.recipeSource!.version))throw Error('A receita de origem não pertence a este aluno.');}
/** A declaration independent of a published plan. It never marks a planned meal as consumed. */
export function recordFreeEntry(state:NutritionState,studentId:number,draft:MealDraft,date:string,note:string,requestId:string,students:readonly DemoStudent[]):NutritionState{
 requireStudent(studentId,students);nutritionDate(date);requestOf(requestId);requireRecipeSource(state,studentId,draft);
 const name=nameOf(draft.name),time=timeOf(draft.time),items=mainItems(draft),snapshots=items.map(optionPortion);
 if(note.trim().length>500)throw Error('A nota permite até 500 caracteres.');
 const identity=`demo-free-${studentId}-${requestId}`,candidate={date,mealName:name,mealTime:time,foodName:snapshots[0].name,portion:snapshots[0].portion,note:note.trim(),additionalSnapshots:snapshots.slice(1),recipeSource:draft.recipeSource?{id:draft.recipeSource.id,version:draft.recipeSource.version}:undefined};
 const existing=state.entries.find(entry=>entry.sourceRecordId===identity);
 if(existing){const prior={date:existing.date,mealName:existing.mealName,mealTime:existing.mealTime,foodName:existing.foodName,portion:existing.portion,note:existing.note,additionalSnapshots:existing.additionalSnapshots||[],recipeSource:existing.recipeSource};if(existing.studentId===studentId&&existing.origin==='free-diary'&&JSON.stringify(prior)===JSON.stringify(candidate))return state;throw Error('Este pedido já tem conteúdo diferente. O original foi preservado.');}
 if(state.entries.filter(entry=>entry.studentId===studentId).length>=200)throw Error('Limite de 200 registos alimentares por aluno.');
 const entry:NutritionEntry={...structuredClone(candidate),id:state.nextEntry,studentId,mealId:-state.nextEntry,source:'simulated-student',choice:'main',version:0,sourceRecordId:identity,reviewedOn:'',reviewer:'',origin:'free-diary'};
 return {...state,nextEntry:state.nextEntry+1,entries:[...state.entries,entry]};
}
export function recordWater(state:NutritionState,studentId:number,date:string,time:string,amount:string,requestId:string,students:readonly DemoStudent[]):NutritionState{
 requireStudent(studentId,students);nutritionDate(date);timeOf(time);requestOf(requestId);
 if(!/^\d{1,4}$/.test(amount)||Number(amount)<1||Number(amount)>5000)throw Error('Indica uma quantidade inteira entre 1 e 5000 ml por registo.');
 const data=nativeNutrition(state),ml=Number(amount),prior=data.water.find(event=>event.studentId===studentId&&event.requestId===requestId);
 if(prior){if(prior.date===date&&prior.time===time&&prior.ml===ml)return state;throw Error('Este pedido de água já tem conteúdo diferente.');}
 if(data.water.filter(event=>event.studentId===studentId).length>=500)throw Error('Limite de 500 registos de água por aluno.');
 return {...state,native:{...data,nextWater:data.nextWater+1,water:[...data.water,{id:data.nextWater,studentId,date,time,ml,requestId,voided:false}]}};
}
export function voidWater(state:NutritionState,studentId:number,id:number,students:readonly DemoStudent[]):NutritionState{
 requireStudent(studentId,students);const data=nativeNutrition(state),prior=data.water.find(event=>event.studentId===studentId&&event.id===id);if(!prior)throw Error('Este registo de água não pertence ao aluno.');if(prior.voided)return state;
 return {...state,native:{...data,water:data.water.map(event=>event.id===id?{...event,voided:true}:event)}};
}
export function waterSummary(state:NutritionState,studentId:number,date:string){const events=nativeNutrition(state).water.filter(event=>event.studentId===studentId&&event.date===date);return {events,ml:events.filter(event=>!event.voided).reduce((total,event)=>total+event.ml,0),count:events.filter(event=>!event.voided).length};}
