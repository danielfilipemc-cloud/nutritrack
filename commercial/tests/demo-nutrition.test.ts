import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankMeal,publishNutrition,createNutritionState,mealDraft,nutritionTotals,optionPortion,recordNutritionEntry,saveNutritionMeal,studentMeals} from '../app/demo/experiencia/nutrition';
import {createDemoStudents,demoDate} from '../app/demo/experiencia/model';
const students=createDemoStudents();const draft={...blankMeal,name:'Lanche fictício',time:'17:00',grams:'125,5',alternativeFood:'fruta',alternativeGrams:'150'};
test('nutrition state keeps student boundaries and immutable diary snapshots through plan edits',()=>{
 const base=createNutritionState(),before=structuredClone(base);let state=saveNutritionMeal(base,1,draft,students);const meal=state.meals.at(-1)!;state=publishNutrition(state,1,state.revisions[1],students);
 state=recordNutritionEntry(state,1,meal.id,demoDate,'alternative',' Nota de exemplo ',students);const entry=structuredClone(state.entries.at(-1));
 state=saveNutritionMeal(state,1,{...draft,name:'Lanche alterado',alternativeFood:'cereal',alternativeGrams:'300'},students,meal.id);
 assert.deepEqual(state.entries.at(-1),entry);assert.equal(entry?.foodName,'Fruta de exemplo');assert.equal(entry?.note,'Nota de exemplo');assert.equal(entry?.source,'simulated-student');assert.equal(state.meals.at(-1)?.name,'Lanche alterado');assert.deepEqual(studentMeals(state,2),studentMeals(base,2));assert.deepEqual(base,before);
});
test('nutrition commands reject cross-student ownership, unknown students and duplicate records',()=>{
 const base=createNutritionState(),snapshot=structuredClone(base);
 assert.throws(()=>saveNutritionMeal(base,2,draft,students,1));assert.throws(()=>saveNutritionMeal(base,999,draft,students));assert.throws(()=>recordNutritionEntry(base,2,1,demoDate,'main','',students));assert.throws(()=>recordNutritionEntry(base,999,1,demoDate,'main','',students));assert.throws(()=>recordNutritionEntry(base,1,2,demoDate,'alternative','',students));
 const state=recordNutritionEntry(base,1,1,demoDate,'main','',students);assert.throws(()=>recordNutritionEntry(state,1,1,demoDate,'alternative','Outro',students),/original/);assert.deepEqual(base,snapshot);
});
test('nutrition dates quantities and form bounds fail without changing state',()=>{
 const base=createNutritionState(),snapshot=structuredClone(base);
 for(const date of ['','2026-02-30','2026-10-21','1999-12-31'])assert.throws(()=>recordNutritionEntry(base,1,1,date,'main','',students));
 for(const patch of [{grams:'0'},{grams:'5000.001'},{grams:'1.0001'},{grams:'1e2'},{grams:'Infinity'},{foodId:'private-food'},{name:'x'},{name:'x'.repeat(81)},{time:'25:00'},{time:'9:30'},{alternativeFood:'',alternativeGrams:'10'}])assert.throws(()=>saveNutritionMeal(base,1,{...draft,...patch},students));
 assert.throws(()=>recordNutritionEntry(base,1,1,demoDate,'main','x'.repeat(501),students));assert.throws(()=>recordNutritionEntry(base,1,1,demoDate,'invalid' as 'main','',students));assert.deepEqual(base,snapshot);
});
test('unknown nutrients stay unknown, totals exclude alternatives and empty days are not zero',()=>{
 const state=createNutritionState();const portions=studentMeals(state,1).map(m=>optionPortion(m.option).portion);const total=nutritionTotals(portions);
 assert.equal(total.nutrients.calories,null);assert.equal(total.knownSubtotal.calories,101);assert.equal(total.nutrients.protein,13);assert.equal(total.count,2);assert.equal(nutritionTotals([]).nutrients.calories,null);
 const entry=recordNutritionEntry(state,1,2,demoDate,'main','',students).entries.at(-1)!;assert.equal(entry.portion.composition.nutrients.calories,null);assert.equal(entry.portion.quantity.amount,200);
});
test('new sessions are independent and newly created students begin without invented shared plans',()=>{
 const first=createNutritionState(),second=createNutritionState();first.entries[0].portion.composition.nutrients.calories=999;first.meals[0].option.grams=999;assert.equal(second.entries[0].portion.composition.nutrients.calories,101);assert.equal(second.meals[0].option.grams,100);
 const newcomer={...students[0],id:4,name:'Aluno Novo Exemplo'};assert.equal(studentMeals(second,4).length,0);const saved=saveNutritionMeal(second,4,draft,[...students,newcomer]);assert.equal(studentMeals(saved,4).length,1);assert.deepEqual(mealDraft(saved.meals.at(-1)!),{...draft,grams:'125.5'});
});
test('meal and diary capacity guards are scoped to a student and preserve existing history',()=>{
 let state=createNutritionState();for(let i=0;i<12;i++)state=saveNutritionMeal(state,3,draft,students);assert.throws(()=>saveNutritionMeal(state,3,draft,students),/12/);
 state=saveNutritionMeal(state,3,{...draft,name:'Editar no limite'},students,studentMeals(state,3)[0].id);assert.equal(studentMeals(state,3).length,12);
 const full={...state,entries:Array.from({length:200},(_,i)=>({...state.entries[0],id:i+1,studentId:2}))};assert.throws(()=>recordNutritionEntry(full,2,3,demoDate,'main','',students),/200/);assert.equal(recordNutritionEntry(full,1,1,demoDate,'main','',students).entries.length,201);
});
