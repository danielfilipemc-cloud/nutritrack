import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activeNutrition,actionFromNutrition,blankMeal,createNutritionState,publishNutrition,recordNutritionEntry,reviewNutritionEntry,saveNutritionMeal,withdrawNutrition} from '../app/demo/experiencia/nutrition';
import {createDemoStudents,demoDate} from '../app/demo/experiencia/model';
import {createDemoActionPlan,toggleDemoAction} from '../app/demo/experiencia/actions';
import {createCheckinPlan,reviewRows} from '../app/demo/experiencia/checkins';
const students=createDemoStudents();
const draft={...blankMeal,name:'Refeição fictícia',time:'18:00',grams:'150'};
test('saved nutrition drafts cannot rewrite published plans or diary snapshots',()=>{
 const base=createNutritionState(),snapshot=structuredClone(base);const next=saveNutritionMeal(base,1,{...draft,name:'Pequeno-almoço editado'},students,1);
 assert.equal(activeNutrition(next,1)!.meals[0].name,'Pequeno-almoço');assert.deepEqual(base,snapshot);
 const published=publishNutrition(next,1,next.revisions[1],students);assert.equal(activeNutrition(published,1)!.version,2);assert.equal(activeNutrition(published,1)!.meals.find(m=>m.id===1)!.name,'Pequeno-almoço editado');
 assert.deepEqual(published.entries,base.entries);assert.equal(published.publications[0].meals[0].mainSnapshot.portion.quantity.amount,100);
});
test('nutrition replay is idempotent after review and withdrawal and divergent content is rejected',()=>{
 let state=recordNutritionEntry(createNutritionState(),1,1,demoDate,'main','Nota original',students,1);const snapshot=structuredClone(state.entries.at(-1));state=reviewNutritionEntry(state,1,2,students);state=withdrawNutrition(state,1,students);
 assert.equal(recordNutritionEntry(state,1,1,demoDate,'main',' Nota original ',students,1),state);assert.deepEqual(state.entries.at(-1),{...snapshot,reviewedOn:demoDate,reviewer:students[0].care.responsible});
 assert.throws(()=>recordNutritionEntry(state,1,1,demoDate,'alternative','Nota original',students,1),/original/);assert.throws(()=>recordNutritionEntry(state,1,2,demoDate,'main','',students,1),/retirada/);
});
test('same meal and day cannot silently duplicate across publication versions',()=>{
 let state=recordNutritionEntry(createNutritionState(),1,1,demoDate,'main','',students);state=saveNutritionMeal(state,1,draft,students,1);state=publishNutrition(state,1,state.revisions[1],students);
 assert.throws(()=>recordNutritionEntry(state,1,1,demoDate,'main','',students,2),/original/);assert.equal(state.entries.length,2);assert.equal(state.entries[1].version,1);
 assert.throws(()=>recordNutritionEntry(state,1,2,demoDate,'main','',students,1),/mudou/);
});
test('nutrition publication and review enforce student ownership and saved responsibility',()=>{
 const base=createNutritionState();assert.throws(()=>publishNutrition(base,999,0,students));assert.throws(()=>publishNutrition(base,1,0,students),/rascunho/);assert.throws(()=>publishNutrition(base,3,0,students),/refeição/);assert.throws(()=>publishNutrition(base,1,1,students),/disponibilizado/);
 let state=recordNutritionEntry(base,1,1,demoDate,'main','',students);assert.throws(()=>reviewNutritionEntry(state,2,2,students));assert.throws(()=>actionFromNutrition(createDemoActionPlan(),state,1,2,students),/primeiro/);
 assert.throws(()=>reviewNutritionEntry(state,1,2,students.map(s=>s.id===1?{...s,care:{...s.care,responsible:''}}:s)),/responsável/);
 state=reviewNutritionEntry(state,1,2,students);assert.throws(()=>reviewNutritionEntry(state,1,2,students));assert.throws(()=>actionFromNutrition(createDemoActionPlan(),state,2,2,students));
});
test('nutrition review derives queue reasons and linked actions deduplicate even when completed',()=>{
 let state=recordNutritionEntry(createNutritionState(),1,1,demoDate,'main','',students);let actions=createDemoActionPlan();assert.equal(reviewRows(students,createCheckinPlan(),actions,[],state.entries)[0].nutritionUnreviewed,1);
 state=reviewNutritionEntry(state,1,2,students);actions=actionFromNutrition(actions,state,1,2,students);const id=actions.nextId-1;assert.equal(actions.actions.at(-1)!.sourceNutritionId,2);actions=toggleDemoAction(actions,1,id);assert.equal(actionFromNutrition(actions,state,1,2,students),actions);assert.equal(reviewRows(students,createCheckinPlan(),actions,[],state.entries)[0].nutritionUnreviewed,0);
});
test('nutrition versions have bounded per-student capacity and independent snapshots',()=>{
 let state=withdrawNutrition(createNutritionState(),1,students);for(let i=1;i<20;i++){state=publishNutrition(state,1,state.revisions[1],students);state=withdrawNutrition(state,1,students);}
 assert.throws(()=>publishNutrition(state,1,state.revisions[1],students),/20/);assert.equal(activeNutrition(state,2)!.version,1);
 const fresh=createNutritionState();fresh.publications[0].meals[0].mainSnapshot.portion.quantity.amount=999;assert.equal(createNutritionState().publications[0].meals[0].mainSnapshot.portion.quantity.amount,100);
});
test('published nutrition dates, unknown values and snapshot quantities retain meaning',()=>{
 let state=saveNutritionMeal(createNutritionState(),3,draft,students);state=publishNutrition(state,3,state.revisions[3],students);const id=state.meals.at(-1)!.id;
 assert.throws(()=>recordNutritionEntry(state,3,id,'2026-10-19','main','',students),/anterior/);assert.throws(()=>recordNutritionEntry(state,3,id,'2026-10-21','main','',students));
 state=recordNutritionEntry(state,3,id,demoDate,'main','',students);assert.equal(state.entries.at(-1)!.portion.quantity.unit,'g');assert.equal(state.entries.at(-1)!.portion.quantity.amount,150);assert.equal(state.entries.at(-1)!.source,'simulated-student');
 const unknown=recordNutritionEntry(createNutritionState(),1,2,demoDate,'main','',students).entries.at(-1)!;assert.equal(unknown.portion.composition.nutrients.calories,null);assert.equal(recordNutritionEntry(createNutritionState(),1,1,demoDate,'main','',students).entries.at(-1)!.portion.composition.nutrients.fat,0);
});
