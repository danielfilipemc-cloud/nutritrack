import {parsePortionV1} from '../../../lib/nutrition-contract';
import type {NutritionPublication} from './nutrition';

export type ShoppingChoice='main'|'alternative'|'omit';
export type ShoppingView={open:boolean;days:string;choices:Record<number,ShoppingChoice>};
export const emptyShoppingView=():ShoppingView=>({open:false,days:'1',choices:{}});
export type ShoppingItem={key:string;foodId:string;name:string;grams:number;sources:{mealId:number;mealName:string;choice:'main'|'alternative';gramsPerDay:number}[]};

/** Synthetic planning only. Published snapshots are never replaced by live catalogue values. */
export function nutritionShopping(publication:NutritionPublication,studentId:number,days:string,choices:Record<number,ShoppingChoice>){
 if(!Number.isSafeInteger(studentId)||studentId<1||publication.studentId!==studentId)throw Error('O plano não pertence a este aluno.');
 if(!Number.isSafeInteger(publication.version)||publication.version<1)throw Error('Versão do plano inválida.');
 if(!/^[1-7]$/.test(days))throw Error('Escolhe entre 1 e 7 dias iguais.');
 if(!Array.isArray(publication.meals)||publication.meals.length<1||publication.meals.length>12)throw Error('Plano de compras inválido.');
 const ids=new Set(publication.meals.map(meal=>meal.id));
 if(ids.size!==publication.meals.length||[...ids].some(id=>!Number.isSafeInteger(id)||id<1))throw Error('Refeições inválidas.');
 if(!choices||typeof choices!=='object'||Array.isArray(choices)||Object.keys(choices).some(id=>!ids.has(Number(id))||String(Number(id))!==id))throw Error('Uma escolha não pertence a este plano.');
 const count=Number(days),groups=new Map<string,{item:ShoppingItem;milligrams:number}>();let included=0;
 for(const meal of publication.meals){
  const choice=choices[meal.id]??'main';if(!['main','alternative','omit'].includes(choice))throw Error('Escolha de compras inválida.');
  if(choice==='omit')continue;
  if(choice==='alternative'&&(!meal.alternative||!meal.alternativeSnapshot))throw Error('Esta refeição não tem alternativa.');
  const options=choice==='alternative'?[meal.alternative!]:[meal.option,...(meal.additional||[])];
  const snapshots=choice==='alternative'?[meal.alternativeSnapshot!]:[meal.mainSnapshot,...(meal.additionalSnapshots||[])];
  if(options.length!==snapshots.length||options.length>8)throw Error('Os alimentos publicados estão incompletos.');
  included++;
  snapshots.forEach((snapshot,index)=>{
   const foodId=options[index]?.foodId;
   if(typeof foodId!=='string'||!foodId||foodId.length>80||typeof snapshot.name!=='string'||!snapshot.name.trim()||snapshot.name.length>120)throw Error('Alimento de origem inválido.');
   const portion=parsePortionV1(snapshot.portion),name=snapshot.name;
   // Same label alone is not enough to merge distinct foods/compositions.
   const key=JSON.stringify([foodId,name,portion.composition]),amount=Math.round(portion.quantity.amount*1000)*count;
   const current=groups.get(key)||{item:{key,foodId,name,grams:0,sources:[]},milligrams:0};
   current.milligrams+=amount;if(!Number.isSafeInteger(current.milligrams))throw Error('Quantidade de compras fora do limite.');
   current.item.sources.push({mealId:meal.id,mealName:meal.name,choice,gramsPerDay:portion.quantity.amount});groups.set(key,current);
  });
 }
 return {studentId,version:publication.version,days:count,includedMeals:included,items:[...groups.values()].map(({item,milligrams})=>({...item,grams:milligrams/1000})).sort((a,b)=>a.name.localeCompare(b.name,'pt-PT')||a.key.localeCompare(b.key))};
}
