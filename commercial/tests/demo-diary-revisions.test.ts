import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoStudents,demoDate} from '../app/demo/experiencia/model';
import {blankMeal,createNutritionState,reviewNutritionEntry,entryPortions,nutritionTotals} from '../app/demo/experiencia/nutrition';
import {changeFreeEntry,recordFreeEntry} from '../app/demo/experiencia/nutrition-library';
const students=createDemoStudents();
const draft={...blankMeal,name:'Lanche inventado',time:'16:00',foodId:'cereal',grams:'100'};
const initial=()=>recordFreeEntry(createNutritionState(),1,draft,demoDate,'Nota original','original',students);

test('correction keeps identity and previous reviewed snapshot while resetting review of changed content',()=>{
 const prior=reviewNutritionEntry(initial(),1,2,students),snapshot=structuredClone(prior);
 const correction={draft:{...draft,grams:'200',additional:[{foodId:'fruta',grams:'50'}]},date:'2026-10-19',note:'Nota corrigida'};
 const next=changeFreeEntry(prior,1,2,1,'Quantidade corrigida',students,correction),entry=next.entries[1];
 assert.equal(entry.id,2);assert.equal(entry.sourceRecordId,prior.entries[1].sourceRecordId);assert.equal(entry.mealId,-2);assert.equal(entry.revision,2);
 assert.equal(entry.reviewedOn,'');assert.equal(entry.reviewer,'');assert.equal(entry.date,'2026-10-19');
 assert.equal(nutritionTotals(entryPortions(entry).map(item=>item.portion)).nutrients.calories,232);
 assert.deepEqual(next.entryChanges?.[0].before,prior.entries[1]);assert.equal(next.entryChanges?.[0].before.reviewedOn,demoDate);
 assert.equal(recordFreeEntry(next,1,draft,demoDate,'Nota original','original',students),next);
 assert.throws(()=>recordFreeEntry(next,1,{...draft,grams:'200'},demoDate,'Nota original','original',students),/conteúdo diferente/);
 assert.equal(next.nextEntry,prior.nextEntry);assert.deepEqual(next.publications,prior.publications);assert.deepEqual(prior,snapshot);
 correction.draft.additional[0].grams='900';assert.equal(entry.additionalSnapshots?.[0].portion.quantity.amount,50);
});
test('cancellation retains data and history; stale, cross-student and plan-backed changes fail atomically',()=>{
 const state=initial(),original=structuredClone(state);
 assert.throws(()=>changeFreeEntry(state,2,2,1,'Motivo fictício',students),/ativo/);
 assert.throws(()=>changeFreeEntry(state,1,1,1,'Motivo fictício',students),/ativo/);
 for(const revision of [0,2,NaN,1.5])assert.throws(()=>changeFreeEntry(state,1,2,revision,'Motivo fictício',students),/mudou/);
 for(const reason of ['', 'ab','x'.repeat(301)])assert.throws(()=>changeFreeEntry(state,1,2,1,reason,students),/motivo/);
 assert.deepEqual(state,original);
 const cancelled=changeFreeEntry(state,1,2,1,'Duplicado declarado',students);
 assert.equal(cancelled.entries.length,2);assert.equal(cancelled.entries[1].voided,true);assert.equal(cancelled.entries[1].revision,2);
 assert.deepEqual(cancelled.entryChanges?.[0].before,state.entries[1]);
 assert.throws(()=>reviewNutritionEntry(cancelled,1,2,students),/por rever/);
 assert.throws(()=>changeFreeEntry(cancelled,1,2,2,'Outra alteração',students),/ativo/);
 assert.equal(recordFreeEntry(cancelled,1,draft,demoDate,'Nota original','original',students),cancelled);
});
test('invalid correction preserves state; unknown composition and bounded revision history remain explicit',()=>{
 const base=initial(),snapshot=structuredClone(base);
 for(const patch of [{date:'2026-02-30'},{date:'2026-10-21'},{note:'x'.repeat(501)},{draft:{...draft,grams:'0'}},{draft:{...draft,recipeSource:{id:99,version:1}}}]){
  assert.throws(()=>changeFreeEntry(base,1,2,1,'Corrigir exemplo',students,{draft,date:demoDate,note:'',...patch}));
 }
 assert.deepEqual(base,snapshot);
 let state=changeFreeEntry(base,1,2,1,'Composição desconhecida',students,{draft:{...draft,foodId:'preparacao'},date:demoDate,note:''});
 assert.equal(nutritionTotals(entryPortions(state.entries[1]).map(item=>item.portion)).nutrients.calories,null);
 for(let revision=2;revision<20;revision++)state=changeFreeEntry(state,1,2,revision,'Ajustar exemplo',students,{draft,date:demoDate,note:String(revision)});
 assert.equal(state.entryChanges?.length,19);assert.equal(state.entries[1].revision,20);
 assert.throws(()=>changeFreeEntry(state,1,2,20,'Limite atingido',students,{draft,date:demoDate,note:''}),/20 revisões/);
 const terminal=changeFreeEntry(state,1,2,20,'Anulação no limite',students);assert.equal(terminal.entries[1].voided,true);assert.equal(terminal.entries[1].revision,21);assert.equal(terminal.entryChanges?.length,20);
});
