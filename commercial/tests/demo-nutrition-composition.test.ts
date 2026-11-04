import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankMeal,createNutritionState,saveNutritionMeal,publishNutrition,recordNutritionEntry,reviewNutritionEntry,activeNutrition,mealDraft,mealPortions,publishedMealPortions,entryPortions,nutritionTotals} from '../app/demo/experiencia/nutrition';
import {createDemoStudents,demoDate} from '../app/demo/experiencia/model';
const students=createDemoStudents();
const draft={...blankMeal,name:'Refeição composta',time:'18:30',grams:'100',additional:[{foodId:'fruta',grams:'150'},{foodId:'iogurte',grams:'125'}],alternativeFood:'preparacao',alternativeGrams:'200'};
test('complete meal composition survives publish, diary, review and subsequent edits without cross-student changes',()=>{
 const base=createNutritionState(),original=structuredClone(base);
 let state=saveNutritionMeal(base,1,draft,students);const meal=state.meals.at(-1)!;
 assert.deepEqual(mealDraft(meal),draft);
 const total=nutritionTotals(mealPortions(meal).map(item=>item.portion));
 assert.deepEqual(total.nutrients,{calories:272.25,protein:6.75,carbs:50.5,fat:4.05});
 state=publishNutrition(state,1,state.revisions[1],students);const frozen=structuredClone(activeNutrition(state,1)!);
 state=recordNutritionEntry(state,1,meal.id,demoDate,'main','Nota aluno',students);const entry=state.entries.at(-1)!;
 assert.equal(entryPortions(entry).length,3);assert.deepEqual(nutritionTotals(entryPortions(entry).map(item=>item.portion)),total);
 state=reviewNutritionEntry(state,1,entry.id,students);
 state=saveNutritionMeal(state,1,{...draft,additional:[{foodId:'arroz',grams:'400'}]},students,meal.id);
 assert.deepEqual(activeNutrition(state,1),frozen);state=publishNutrition(state,1,state.revisions[1],students);
 assert.deepEqual(entryPortions(state.entries.at(-1)!),entryPortions(entry));
 assert.equal(publishedMealPortions(activeNutrition(state,1)!.meals.at(-1)!).length,2);
 assert.deepEqual(activeNutrition(state,2),activeNutrition(base,2));assert.deepEqual(base,original);
 assert.throws(()=>saveNutritionMeal(state,2,draft,students,meal.id),/pertence/);
});
test('alternative replaces all main ingredients and unknown values stay unknown',()=>{
 let state=saveNutritionMeal(createNutritionState(),1,draft,students);const id=state.meals.at(-1)!.id;
 state=publishNutrition(state,1,state.revisions[1],students);state=recordNutritionEntry(state,1,id,demoDate,'alternative','',students);
 const entry=state.entries.at(-1)!;assert.equal(entryPortions(entry).length,1);
 const total=nutritionTotals(entryPortions(entry).map(item=>item.portion));assert.equal(total.nutrients.calories,null);assert.equal(total.nutrients.protein,12);
 assert.equal(recordNutritionEntry(state,1,id,demoDate,'alternative','',students),state);
});
test('invalid added ingredients reject the whole save without altering the previous plan',()=>{
 const state=createNutritionState(),snapshot=structuredClone(state);
 for(const grams of ['', '0','-1','5001','Infinity','0.0001'])assert.throws(()=>saveNutritionMeal(state,1,{...draft,additional:[{foodId:'fruta',grams}]},students));
 assert.throws(()=>saveNutritionMeal(state,1,{...draft,additional:[{foodId:'unknown',grams:'100'}]},students));
 assert.throws(()=>saveNutritionMeal(state,1,{...draft,additional:Array.from({length:8},()=>({foodId:'fruta',grams:'100'}))},students),/8 alimentos/);
 assert.deepEqual(state,snapshot);
 const max=saveNutritionMeal(state,1,{...draft,additional:Array.from({length:7},()=>({foodId:'fruta',grams:'0,125'}))},students);
 assert.equal(mealPortions(max.meals.at(-1)!).length,8);
});
test('cleared multi-item drafts return to single food; diary snapshots never alias editable items',()=>{
 let state=saveNutritionMeal(createNutritionState(),1,draft,students);const id=state.meals.at(-1)!.id;
 state=publishNutrition(state,1,state.revisions[1],students);state=recordNutritionEntry(state,1,id,demoDate,'main','',students);
 const entry=structuredClone(state.entries.at(-1)!);state.meals.at(-1)!.additional![0].grams=999;
 assert.deepEqual(state.entries.at(-1),entry);assert.equal(activeNutrition(state,1)!.meals.at(-1)!.additionalSnapshots![0].portion.quantity.amount,150);
 state=saveNutritionMeal(state,1,{...draft,additional:[]},students,id);
 assert.equal(mealPortions(state.meals.at(-1)!).length,1);assert.equal(mealDraft(state.meals.at(-1)!).additional,undefined);
});

test('all 200 supported diary entries of eight foods sum once within safe integer bounds',()=>{
 const portion={composition:{contractVersion:1 as const,basis:{amount:100 as const,unit:'g' as const},nutrients:{calories:1000,protein:100,carbs:100,fat:100}},quantity:{amount:5000,unit:'g' as const}};
 const portions=Array.from({length:1600},()=>structuredClone(portion));
 assert.deepEqual(nutritionTotals(portions).nutrients,{calories:80000000,protein:8000000,carbs:8000000,fat:8000000});
 assert.throws(()=>nutritionTotals([...portions,portion]),/Too many/);
});
