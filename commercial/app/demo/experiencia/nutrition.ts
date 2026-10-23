import {nutritionTotals,type PortionV1} from '../../../lib/nutrition-contract';
import {demoFoods} from '../../../lib/nutrition-demo';
import {validDate} from '../../../lib/validation';
import {demoDate,type DemoStudent} from './model';

// Synthetic session state only. Diary entries carry immutable food snapshots.
export {demoFoods as nutritionFoods,nutritionTotals};
export type MealOption={foodId:string;grams:number};
export type NutritionMeal={id:number;studentId:number;name:string;time:string;option:MealOption;alternative:MealOption|null};
export type MealDraft={name:string;time:string;foodId:string;grams:string;alternativeFood:string;alternativeGrams:string};
export type NutritionEntry={id:number;studentId:number;date:string;mealId:number;mealName:string;mealTime:string;foodName:string;portion:PortionV1;note:string;source:'simulated-student';choice:'main'|'alternative'};
export type NutritionState={meals:NutritionMeal[];entries:NutritionEntry[];nextMeal:number;nextEntry:number};
export const blankMeal:MealDraft={name:'',time:'',foodId:'cereal',grams:'100',alternativeFood:'',alternativeGrams:''};
function requireStudent(id:number,students:readonly DemoStudent[]){if(!students.some(s=>s.id===id))throw Error('Aluno de exemplo inexistente.');}
export class NutritionDateError extends Error {}
export function nutritionDate(date:string){if(!validDate(date)||date<'2000-01-01'||date>demoDate)throw new NutritionDateError('Escolhe um dia entre 2000-01-01 e a referência da demonstração.');return date;}
export function optionPortion(option:MealOption){
 const food=demoFoods.find(f=>f.id===option.foodId);if(!food)throw Error('Escolhe um alimento de exemplo.');
 const portion:PortionV1={composition:structuredClone(food.composition),quantity:{amount:option.grams,unit:'g'}};nutritionTotals([portion]);return {name:food.name,portion};
}
function option(foodId:string,grams:string):MealOption{
 if(!/^\d+(?:[.,]\d{1,3})?$/.test(grams.trim()))throw Error('Indica uma quantidade entre 0,001 e 5000 g, até três casas decimais.');
 const value={foodId,grams:Number(grams.trim().replace(',','.'))};try{optionPortion(value);}catch{throw Error('Escolhe um alimento e uma quantidade entre 0,001 e 5000 g.');}return value;
}
export function saveNutritionMeal(state:NutritionState,studentId:number,draft:MealDraft,students:readonly DemoStudent[],editing:number|null=null):NutritionState{
 requireStudent(studentId,students);const current=editing===null?null:state.meals.find(m=>m.id===editing&&m.studentId===studentId);
 if(editing!==null&&!current)throw Error('A refeição não pertence a este aluno.');
 if(!current&&state.meals.filter(m=>m.studentId===studentId).length>=12)throw Error('O plano de exemplo permite até 12 refeições.');
 const name=draft.name.trim();if(name.length<2||name.length>80)throw Error('Indica um nome de refeição com 2 a 80 caracteres.');
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.time))throw Error('Indica uma hora válida.');
 const main=option(draft.foodId,draft.grams);
 if(!draft.alternativeFood&&draft.alternativeGrams.trim())throw Error('Escolhe também o alimento da alternativa ou limpa a quantidade.');
 const alternative=draft.alternativeFood?option(draft.alternativeFood,draft.alternativeGrams):null;
 const meal:NutritionMeal={id:current?.id??state.nextMeal,studentId,name,time:draft.time,option:main,alternative};
 return {...state,nextMeal:state.nextMeal+(current?0:1),meals:current?state.meals.map(m=>m.id===current.id?meal:m):[...state.meals,meal]};
}
export function mealDraft(meal:NutritionMeal):MealDraft{return {name:meal.name,time:meal.time,foodId:meal.option.foodId,grams:String(meal.option.grams),alternativeFood:meal.alternative?.foodId||'',alternativeGrams:meal.alternative?String(meal.alternative.grams):''};}
export function studentMeals(state:NutritionState,id:number){return state.meals.filter(m=>m.studentId===id).slice().sort((a,b)=>a.time.localeCompare(b.time)||a.id-b.id);}
export function recordNutritionEntry(state:NutritionState,studentId:number,mealId:number,date:string,choice:'main'|'alternative',note:string,students:readonly DemoStudent[]):NutritionState{
 requireStudent(studentId,students);nutritionDate(date);if(!['main','alternative'].includes(choice))throw Error('Escolha de exemplo inválida.');
 const meal=state.meals.find(m=>m.id===mealId&&m.studentId===studentId);if(!meal)throw Error('A refeição não pertence a este aluno.');
 const selected=choice==='main'?meal.option:meal.alternative;if(!selected)throw Error('Esta refeição não tem alternativa.');
 if(note.trim().length>500)throw Error('A nota de exemplo permite até 500 caracteres.');
 if(state.entries.some(e=>e.studentId===studentId&&e.mealId===mealId&&e.date===date))throw Error('Já existe um registo desta refeição neste dia. O original foi preservado.');
 if(state.entries.filter(e=>e.studentId===studentId).length>=200)throw Error('Limite de 200 registos de exemplo por aluno.');
 const food=optionPortion(selected);const entry:NutritionEntry={id:state.nextEntry,studentId,date,mealId,mealName:meal.name,mealTime:meal.time,foodName:food.name,portion:food.portion,note:note.trim(),source:'simulated-student',choice};
 return {...state,nextEntry:state.nextEntry+1,entries:[...state.entries,entry]};
}
export function createNutritionState():NutritionState{
 return {nextMeal:4,nextEntry:2,meals:[
  {id:1,studentId:1,name:'Pequeno-almoço',time:'08:30',option:{foodId:'cereal',grams:100},alternative:{foodId:'fruta',grams:150}},
  {id:2,studentId:1,name:'Almoço',time:'13:00',option:{foodId:'preparacao',grams:200},alternative:null},
  {id:3,studentId:2,name:'Lanche',time:'16:00',option:{foodId:'fruta',grams:120},alternative:null},
 ],entries:[{id:1,studentId:1,date:'2026-10-19',mealId:1,mealName:'Pequeno-almoço',mealTime:'08:30',foodName:demoFoods[0].name,portion:optionPortion({foodId:'cereal',grams:100}).portion,note:'Registo fictício de exemplo.',source:'simulated-student',choice:'main'}]};
}
