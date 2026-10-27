import type {NativeNutrition} from './nutrition-library';
import {nutritionTotals,type PortionV1} from '../../../lib/nutrition-contract';
import {demoFoods} from '../../../lib/nutrition-demo';
import {validDate} from '../../../lib/validation';
import {demoDate,type DemoStudent} from './model';
import {saveDemoAction,type DemoActionPlan} from './actions';

// Synthetic session state only. Diary entries carry immutable food snapshots.
export {nutritionTotals};
export const nutritionFoods:typeof demoFoods=[...demoFoods,
 ...[
  ['iogurte','Iogurte de exemplo',65,4,6,3],
  ['arroz','Arroz de exemplo',130,3,28,1],
  ['legumes','Legumes de exemplo',35,2,5,0.5],
  ['tofu','Tofu de exemplo',120,12,3,7],
  ['aveia','Aveia de exemplo',370,13,60,7],
 ].map(([id,name,calories,protein,carbs,fat])=>({id:String(id),name:String(name),composition:{contractVersion:1 as const,basis:{amount:100 as const,unit:'g' as const},nutrients:{calories:Number(calories),protein:Number(protein),carbs:Number(carbs),fat:Number(fat)}}})),
];
export type MealOption={foodId:string;grams:number};
export type NutritionMeal={id:number;studentId:number;name:string;time:string;option:MealOption;alternative:MealOption|null;additional?:MealOption[];recipeSource?:{id:number;version:number}};
export type MealDraft={name:string;time:string;foodId:string;grams:string;alternativeFood:string;alternativeGrams:string;additional?:{foodId:string;grams:string}[];recipeSource?:{id:number;version:number}};
export type NutritionEntry={id:number;studentId:number;date:string;mealId:number;mealName:string;mealTime:string;foodName:string;portion:PortionV1;note:string;source:'simulated-student';choice:'main'|'alternative';version:number;sourceRecordId:string;reviewedOn:string;reviewer:string;additionalSnapshots?:ReturnType<typeof optionPortion>[];origin?:'free-diary';recipeSource?:{id:number;version:number}};
export type PublishedNutritionMeal=NutritionMeal&{mainSnapshot:ReturnType<typeof optionPortion>;alternativeSnapshot:ReturnType<typeof optionPortion>|null;additionalSnapshots?:ReturnType<typeof optionPortion>[]};
export type NutritionPublication={studentId:number;version:number;revision:number;publishedOn:string;meals:PublishedNutritionMeal[]};
export type NutritionState={meals:NutritionMeal[];entries:NutritionEntry[];nextMeal:number;nextEntry:number;revisions:Record<number,number>;publications:NutritionPublication[];active:Record<number,number|null>;native?:NativeNutrition};
export const blankMeal:MealDraft={name:'',time:'',foodId:'cereal',grams:'100',alternativeFood:'',alternativeGrams:''};
function requireStudent(id:number,students:readonly DemoStudent[]){if(!students.some(s=>s.id===id))throw Error('Aluno de exemplo inexistente.');}
export class NutritionDateError extends Error {}
export function nutritionDate(date:string){if(!validDate(date)||date<'2000-01-01'||date>demoDate)throw new NutritionDateError('Escolhe um dia entre 2000-01-01 e a referência da demonstração.');return date;}
export function optionPortion(option:MealOption){
 const food=nutritionFoods.find(f=>f.id===option.foodId);if(!food)throw Error('Escolhe um alimento de exemplo.');
 const portion:PortionV1={composition:structuredClone(food.composition),quantity:{amount:option.grams,unit:'g'}};nutritionTotals([portion]);return {name:food.name,portion};
}
export function parseMealOption(foodId:string,grams:string):MealOption{
 if(!/^\d+(?:[.,]\d{1,3})?$/.test(grams.trim()))throw Error('Indica uma quantidade entre 0,001 e 5000 g, até três casas decimais.');
 const value={foodId,grams:Number(grams.trim().replace(',','.'))};try{optionPortion(value);}catch{throw Error('Escolhe um alimento e uma quantidade entre 0,001 e 5000 g.');}return value;
}
export function saveNutritionMeal(state:NutritionState,studentId:number,draft:MealDraft,students:readonly DemoStudent[],editing:number|null=null):NutritionState{
 requireStudent(studentId,students);const current=editing===null?null:state.meals.find(m=>m.id===editing&&m.studentId===studentId);
 if(editing!==null&&!current)throw Error('A refeição não pertence a este aluno.');
 if(!current&&state.meals.filter(m=>m.studentId===studentId).length>=12)throw Error('O plano de exemplo permite até 12 refeições.');
 const name=draft.name.trim();if(name.length<2||name.length>80)throw Error('Indica um nome de refeição com 2 a 80 caracteres.');
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.time))throw Error('Indica uma hora válida.');
 const main=parseMealOption(draft.foodId,draft.grams);
 if(!draft.alternativeFood&&draft.alternativeGrams.trim())throw Error('Escolhe também o alimento da alternativa ou limpa a quantidade.');
 const alternative=draft.alternativeFood?parseMealOption(draft.alternativeFood,draft.alternativeGrams):null;
 const additional=draft.additional||[];if(!Array.isArray(additional)||additional.length>7)throw Error('Cada refeição permite até 8 alimentos na opção principal.');
 const items=additional.map(item=>parseMealOption(item.foodId,item.grams));
 if(draft.recipeSource&&!state.native?.recipes.some(recipe=>recipe.studentId===studentId&&recipe.id===draft.recipeSource!.id&&recipe.version===draft.recipeSource!.version))throw Error('A receita de origem não pertence a este aluno.');
 const meal:NutritionMeal={id:current?.id??state.nextMeal,studentId,name,time:draft.time,option:main,alternative,...(draft.recipeSource?{recipeSource:{...draft.recipeSource}}:{}),...(items.length?{additional:items}:{})};
 return {...state,revisions:{...state.revisions,[studentId]:(state.revisions[studentId]||0)+1},nextMeal:state.nextMeal+(current?0:1),meals:current?state.meals.map(m=>m.id===current.id?meal:m):[...state.meals,meal]};
}
export function mealDraft(meal:NutritionMeal):MealDraft{return {name:meal.name,time:meal.time,foodId:meal.option.foodId,grams:String(meal.option.grams),alternativeFood:meal.alternative?.foodId||'',alternativeGrams:meal.alternative?String(meal.alternative.grams):'',...(meal.recipeSource?{recipeSource:{...meal.recipeSource}}:{}),...(meal.additional?.length?{additional:meal.additional.map(item=>({foodId:item.foodId,grams:String(item.grams)}))}:{})};}
export function studentMeals(state:NutritionState,id:number){return state.meals.filter(m=>m.studentId===id).slice().sort((a,b)=>a.time.localeCompare(b.time)||a.id-b.id);}
export function activeNutrition(state:NutritionState,studentId:number){
 return state.publications.find(p=>p.studentId===studentId&&p.version===state.active[studentId]);
}
function publicationMeals(state:NutritionState,studentId:number):PublishedNutritionMeal[]{
 return studentMeals(state,studentId).map(meal=>structuredClone({...meal,mainSnapshot:optionPortion(meal.option),...(meal.additional?.length?{additionalSnapshots:meal.additional.map(optionPortion)}:{}),alternativeSnapshot:meal.alternative?optionPortion(meal.alternative):null}));
}
export function publishNutrition(state:NutritionState,studentId:number,expectedRevision:number,students:readonly DemoStudent[]):NutritionState{
 requireStudent(studentId,students);
 if(expectedRevision!==(state.revisions[studentId]||0))throw Error('O rascunho mudou. Confirma a revisão antes de disponibilizar.');
 const meals=publicationMeals(state,studentId);if(!meals.length)throw Error('Guarda pelo menos uma refeição antes de disponibilizar.');
 const previous=state.publications.filter(p=>p.studentId===studentId);
 if(previous.length>=20)throw Error('Limite de 20 versões alimentares por aluno.');
 if(activeNutrition(state,studentId)?.revision===expectedRevision)throw Error('Este rascunho já está disponibilizado.');
 const version=(previous.at(-1)?.version||0)+1;
 return {...state,active:{...state.active,[studentId]:version},publications:[...state.publications,{studentId,version,revision:expectedRevision,publishedOn:demoDate,meals}]};
}
export function withdrawNutrition(state:NutritionState,studentId:number,students:readonly DemoStudent[]):NutritionState{
 requireStudent(studentId,students);if(!activeNutrition(state,studentId))throw Error('Não há plano alimentar disponibilizado.');
 return {...state,active:{...state.active,[studentId]:null}};
}
export function recordNutritionEntry(state:NutritionState,studentId:number,mealId:number,date:string,choice:'main'|'alternative',note:string,students:readonly DemoStudent[],expectedVersion=state.active[studentId]):NutritionState{
 requireStudent(studentId,students);nutritionDate(date);if(!['main','alternative'].includes(choice))throw Error('Escolha de exemplo inválida.');
 if(note.trim().length>500)throw Error('A nota de exemplo permite até 500 caracteres.');
 const publication=state.publications.find(p=>p.studentId===studentId&&p.version===expectedVersion);
 const meal=publication?.meals.find(m=>m.id===mealId);if(!meal)throw Error('A refeição não pertence à versão disponibilizada deste aluno.');
 const selected=choice==='main'?meal.mainSnapshot:meal.alternativeSnapshot;if(!selected)throw Error('Esta refeição não tem alternativa.');
 const sourceRecordId=`demo-food-${studentId}-${mealId}-${date}`;
 const existing=state.entries.find(e=>e.sourceRecordId===sourceRecordId);
 if(existing){
  if(existing.studentId===studentId&&existing.version===expectedVersion&&existing.choice===choice&&existing.note===note.trim())return state;
  throw Error('Já existe um registo desta refeição neste dia. O original foi preservado.');
 }
 if(activeNutrition(state,studentId)?.version!==expectedVersion)throw Error('A versão mudou ou foi retirada. O rascunho foi preservado.');
 if(date<publication!.publishedOn)throw new NutritionDateError('Este dia é anterior à disponibilização desta versão.');
 if(state.entries.some(e=>e.studentId===studentId&&e.mealId===mealId&&e.date===date))throw Error('Já existe um registo desta refeição neste dia. O original foi preservado.');
 if(state.entries.filter(e=>e.studentId===studentId).length>=200)throw Error('Limite de 200 registos de exemplo por aluno.');
 const entry:NutritionEntry={id:state.nextEntry,studentId,date,mealId,mealName:meal.name,mealTime:meal.time,foodName:selected.name,portion:structuredClone(selected.portion),note:note.trim(),source:'simulated-student',choice,version:publication!.version,sourceRecordId,reviewedOn:'',reviewer:'',...(meal.recipeSource?{recipeSource:{...meal.recipeSource}}:{}),...(choice==='main'&&meal.additionalSnapshots?.length?{additionalSnapshots:structuredClone(meal.additionalSnapshots)}:{})};
 return {...state,nextEntry:state.nextEntry+1,entries:[...state.entries,entry]};
}
export function reviewNutritionEntry(state:NutritionState,studentId:number,id:number,students:readonly DemoStudent[]):NutritionState{
 requireStudent(studentId,students);const entry=state.entries.find(e=>e.id===id&&e.studentId===studentId);
 if(!entry||entry.reviewedOn)throw Error('Escolhe um registo alimentar deste aluno por rever.');
 const reviewer=students.find(s=>s.id===studentId)!.care.responsible;if(!reviewer)throw Error('Guarda um responsável no acompanhamento antes de rever.');
 return {...state,entries:state.entries.map(e=>e.id===id?{...e,reviewedOn:demoDate,reviewer}:e)};
}
export function actionFromNutrition(actions:DemoActionPlan,state:NutritionState,studentId:number,id:number,students:DemoStudent[]):DemoActionPlan{
 const entry=state.entries.find(e=>e.id===id&&e.studentId===studentId);if(!entry?.reviewedOn)throw Error('Revê primeiro o registo alimentar deste aluno.');
 if(actions.actions.some(a=>a.studentId===studentId&&a.sourceNutritionId===id))return actions;
 const next=saveDemoAction(actions,studentId,{title:`Preparar seguimento do registo alimentar #${id}`,due:''},students);
 return {...next,actions:next.actions.map(a=>a.id===actions.nextId?{...a,sourceNutritionId:id}:a)};
}
export function createNutritionState():NutritionState{
 const state:NutritionState={nextMeal:4,nextEntry:2,revisions:{1:1,2:1},publications:[],active:{1:1,2:1},meals:[
  {id:1,studentId:1,name:'Pequeno-almoço',time:'08:30',option:{foodId:'cereal',grams:100},alternative:{foodId:'fruta',grams:150}},
  {id:2,studentId:1,name:'Almoço',time:'13:00',option:{foodId:'preparacao',grams:200},alternative:null},
  {id:3,studentId:2,name:'Lanche',time:'16:00',option:{foodId:'fruta',grams:120},alternative:null},
 ],entries:[]};
 state.publications=[1,2].map(studentId=>({studentId,version:1,revision:1,publishedOn:'2026-10-18',meals:publicationMeals(state,studentId)}));
 state.entries=[{id:1,studentId:1,date:'2026-10-19',mealId:1,mealName:'Pequeno-almoço',mealTime:'08:30',foodName:demoFoods[0].name,portion:optionPortion({foodId:'cereal',grams:100}).portion,note:'Registo fictício de exemplo.',source:'simulated-student',choice:'main',version:1,sourceRecordId:'demo-food-1-1-2026-10-19',reviewedOn:demoDate,reviewer:'Equipa Exemplo'}];
 return state;
}

/** Complete main option; alternatives replace the entire main option. */
export function mealPortions(meal:NutritionMeal){return [meal.option,...(meal.additional||[])].map(optionPortion);}
export function publishedMealPortions(meal:PublishedNutritionMeal){return [meal.mainSnapshot,...(meal.additionalSnapshots||[])];}
export function entryPortions(entry:NutritionEntry){return [{name:entry.foodName,portion:entry.portion},...(entry.additionalSnapshots||[])];}
