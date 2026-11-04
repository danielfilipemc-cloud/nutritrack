import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoStudents,demoDate} from '../app/demo/experiencia/model';
import {blankMeal,createNutritionState,entryPortions,nutritionTotals,saveNutritionMeal,publishNutrition,activeNutrition,recordNutritionEntry,reviewNutritionEntry} from '../app/demo/experiencia/nutrition';
import {currentRecipes,nativeNutrition,recipeDraft,recordFreeEntry,recordWater,saveRecipe,searchNutritionFoods,voidWater,waterSummary} from '../app/demo/experiencia/nutrition-library';
const students=createDemoStudents();
const draft={...blankMeal,name:'Preparação fictícia',time:'18:30',foodId:'aveia',grams:'50',additional:[{foodId:'fruta',grams:'100'},{foodId:'iogurte',grams:'125'}]};
test('recipes are scoped, versioned and isolated from existing diary and plan snapshots',()=>{
 const base=createNutritionState(),original=structuredClone(base);let state=saveRecipe(base,1,draft,students);const recipe=currentRecipes(state,1)[0];
 assert.equal(currentRecipes(state,2).length,0);assert.throws(()=>recipeDraft(state,2,recipe.id,1),/não encontrada/);
 assert.throws(()=>saveRecipe(state,2,draft,students,recipe.id,1),/pertence/);assert.throws(()=>saveRecipe(state,1,draft,students,recipe.id,0),/mudou/);
 const applied={...recipeDraft(state,1,recipe.id,1),time:'18:30'};state=saveNutritionMeal(state,1,applied,students);const mealId=state.meals.at(-1)!.id;state=publishNutrition(state,1,state.revisions[1],students);const plan=structuredClone(activeNutrition(state,1));state=recordNutritionEntry(state,1,mealId,demoDate,'main','',students);const recorded=structuredClone(state.entries.at(-1));
 state=saveRecipe(state,1,{...draft,grams:'200'},students,recipe.id,1);assert.equal(currentRecipes(state,1)[0].version,2);assert.equal(nativeNutrition(state).recipes[0].items[0].grams,50);
 assert.deepEqual(activeNutrition(state,1),plan);assert.deepEqual(state.entries.at(-1),recorded);assert.deepEqual(base,original);
 assert.equal(recorded!.recipeSource!.version,1);assert.equal(recipeDraft(state,1,recipe.id,1).grams,'50');
 assert.throws(()=>saveNutritionMeal(state,2,applied,students),/origem/);
});
test('free declarations work without a plan and never consume a planned meal; replay survives review',()=>{
 const base=createNutritionState();let state=recordFreeEntry(base,3,draft,demoDate,'Nota fictícia','free-1',students);const entry=state.entries.at(-1)!;
 assert.equal(activeNutrition(state,3),undefined);assert.equal(entry.origin,'free-diary');assert.ok(entry.mealId<0);assert.equal(entryPortions(entry).length,3);assert.deepEqual(state.meals,base.meals);assert.deepEqual(state.publications,base.publications);
 state=reviewNutritionEntry(state,3,entry.id,students);assert.equal(recordFreeEntry(state,3,draft,demoDate,' Nota fictícia ','free-1',students),state);
 assert.throws(()=>recordFreeEntry(state,3,{...draft,grams:'60'},demoDate,'Nota fictícia','free-1',students),/diferente/);
 state=recordFreeEntry(state,1,draft,demoDate,'','free-1',students);assert.equal(state.entries.at(-1)!.studentId,1);
 state=recordNutritionEntry(state,1,1,demoDate,'main','',students);assert.equal(state.entries.at(-1)!.mealId,1);
});
test('free declarations reject invalid dates, quantities, ownership and unsupported recipe references atomically',()=>{
 const state=createNutritionState(),snapshot=structuredClone(state);
 for(const date of ['2026-10-21','2026-02-30','1999-12-31'])assert.throws(()=>recordFreeEntry(state,1,draft,date,'','a',students));
 for(const grams of ['','-1','0','5001','1e2'])assert.throws(()=>recordFreeEntry(state,1,{...draft,grams},demoDate,'','a',students));
 assert.throws(()=>recordFreeEntry(state,999,draft,demoDate,'','a',students));assert.throws(()=>recordFreeEntry(state,1,draft,demoDate,'x'.repeat(501),'a',students));assert.throws(()=>recordFreeEntry(state,1,draft,demoDate,'','a b',students));assert.throws(()=>recordFreeEntry(state,1,{...draft,recipeSource:{id:1,version:1}},demoDate,'','a',students));assert.deepEqual(state,snapshot);
});
test('water events retain ml, dates and cancelled history without prescribing a goal or crossing students',()=>{
 const base=createNutritionState(),snapshot=structuredClone(base);let state=recordWater(base,1,demoDate,'09:00','250','w1',students);state=recordWater(state,1,demoDate,'12:00','300','w2',students);state=recordWater(state,2,demoDate,'10:00','5000','w1',students);
 assert.equal(waterSummary(state,1,demoDate).ml,550);assert.equal(waterSummary(state,2,demoDate).ml,5000);assert.equal(waterSummary(state,3,demoDate).count,0);
 assert.equal(recordWater(state,1,demoDate,'09:00','250','w1',students),state);assert.throws(()=>recordWater(state,1,demoDate,'09:00','300','w1',students),/diferente/);assert.throws(()=>voidWater(state,2,1,students),/pertence/);
 state=voidWater(state,1,1,students);assert.equal(waterSummary(state,1,demoDate).ml,300);assert.equal(waterSummary(state,1,demoDate).events.length,2);assert.equal(voidWater(state,1,1,students),state);assert.equal(recordWater(state,1,demoDate,'09:00','250','w1',students),state);assert.deepEqual(base,snapshot);
 for(const amount of ['0','-1','5001','250.5','1e2',''])assert.throws(()=>recordWater(state,1,demoDate,'12:00',amount,'x',students));assert.throws(()=>recordWater(state,1,'2026-10-21','12:00','250','x',students));assert.throws(()=>recordWater(state,1,demoDate,'25:00','250','x',students));
});
test('search handles accents and all terms; unknown composition remains unknown through a free record',()=>{
 assert.equal(searchNutritionFoods(' PREPARACAO exemplo ').length,1);assert.equal(searchNutritionFoods('fruta CEREAL').length,0);assert.equal(searchNutritionFoods('').length,8);
 const state=recordFreeEntry(createNutritionState(),1,{...draft,foodId:'preparacao'},demoDate,'','unknown',students);const total=nutritionTotals(entryPortions(state.entries.at(-1)!).map(item=>item.portion));assert.equal(total.nutrients.calories,null);assert.ok(total.knownSubtotal.calories>0);
});
test('bounded recipes and records reject overflow while completed requests remain safely replayable',()=>{
 let state=saveRecipe(createNutritionState(),1,draft,students);for(let version=1;version<20;version++)state=saveRecipe(state,1,draft,students,1,version);assert.equal(currentRecipes(state,1)[0].version,20);assert.throws(()=>saveRecipe(state,1,draft,students,1,20),/20 versões/);
 for(let i=1;i<20;i++)state=saveRecipe(state,1,{...draft,name:`Receita ${i}`},students);assert.throws(()=>saveRecipe(state,1,draft,students),/20 receitas/);
 let full=createNutritionState();for(let i=0;i<199;i++)full=recordFreeEntry(full,1,draft,demoDate,'',`event-${i}`,students);assert.equal(full.entries.filter(entry=>entry.studentId===1).length,200);assert.throws(()=>recordFreeEntry(full,1,draft,demoDate,'','overflow',students),/200/);assert.equal(recordFreeEntry(full,1,draft,demoDate,'','event-0',students),full);
});
