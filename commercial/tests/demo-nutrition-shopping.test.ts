import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNutritionState,saveNutritionMeal,mealDraft,blankMeal,publishNutrition} from '../app/demo/experiencia/nutrition';
import {saveRecipe,recipeDraft} from '../app/demo/experiencia/nutrition-library';
import {createDemoStudents} from '../app/demo/experiencia/model';
import {nutritionShopping,type ShoppingChoice} from '../app/demo/experiencia/nutrition-shopping';
const students=createDemoStudents();
test('recipe ingredients enter shopping only after publication and later recipe versions do not rewrite them',()=>{
 const draft={...blankMeal,name:'Receita mista',grams:'50',additional:[{foodId:'fruta',grams:'25'}]};
 let state=saveRecipe(createNutritionState(),1,draft,students);
 state=saveNutritionMeal(state,1,{...recipeDraft(state,1,1,1),time:'18:00'},students);
 assert.equal(nutritionShopping(state.publications[0],1,'1',{}).items.some(item=>item.foodId==='fruta'),false);
 state=publishNutrition(state,1,state.revisions[1],students);const publication=state.publications.at(-1)!;
 const result=nutritionShopping(publication,1,'3',{});assert.equal(result.items.find(item=>item.foodId==='cereal')?.grams,450);assert.equal(result.items.find(item=>item.foodId==='fruta')?.grams,75);
 state=saveRecipe(state,1,{...draft,grams:'400'},students,1,1);
 assert.deepEqual(nutritionShopping(state.publications.at(-1)!,1,'3',{}),result);
});
test('shopping replaces the complete main choice and uses only published snapshots without recording consumption',()=>{
 const state=createNutritionState(),before=structuredClone(state),publication=state.publications[0];
 const main=nutritionShopping(publication,1,'2',{});assert.equal(main.includedMeals,2);assert.deepEqual(main.items.map(item=>[item.foodId,item.grams]),[['cereal',200],['preparacao',400]]);
 const alternate=nutritionShopping(publication,1,'2',{1:'alternative'});assert.equal(alternate.items.some(item=>item.foodId==='cereal'),false);assert.equal(alternate.items.find(item=>item.foodId==='fruta')?.grams,300);assert.equal(alternate.items.find(item=>item.foodId==='preparacao')?.grams,400);
 const edited=saveNutritionMeal(state,1,{...mealDraft(state.meals[0]),grams:'900'},students,1);assert.equal(nutritionShopping(edited.publications[0],1,'2',{}).items.find(item=>item.foodId==='cereal')?.grams,200);
 assert.deepEqual(state,before);assert.deepEqual(edited.entries,state.entries);
 const omitted=nutritionShopping(publication,1,'7',{1:'omit',2:'omit'});assert.equal(omitted.includedMeals,0);assert.deepEqual(omitted.items,[]);
});
test('shopping sums identical snapshot sources in integer milligrams and preserves origin by meal',()=>{
 const publication=structuredClone(createNutritionState().publications[0]);
 publication.meals[1]={...structuredClone(publication.meals[0]),id:2,name:'Outro momento',time:'16:00'};
 for(const meal of publication.meals){meal.mainSnapshot.portion.quantity.amount=0.001;meal.additional=[{foodId:'cereal',grams:0.001}];meal.additionalSnapshots=[structuredClone(meal.mainSnapshot)];}
 const result=nutritionShopping(publication,1,'7',{});assert.equal(result.items.length,1);assert.equal(result.items[0].grams,0.028);assert.equal(result.items[0].sources.length,4);assert.deepEqual(result.items[0].sources.map(source=>source.mealId),[1,1,2,2]);
 // Selecting an alternative removes every ingredient in that main choice.
 const alternative=nutritionShopping(publication,1,'1',{1:'alternative',2:'omit'});assert.deepEqual(alternative.items.map(item=>[item.foodId,item.grams]),[['fruta',150]]);
});
test('identical names never merge distinct food identities or unknown/different compositions',()=>{
 const publication=structuredClone(createNutritionState().publications[0]);const first=publication.meals[0];
 publication.meals[1]={...structuredClone(first),id:2,option:{foodId:'distinct',grams:100}};
 assert.equal(nutritionShopping(publication,1,'1',{}).items.length,2);
 publication.meals[1].option.foodId=first.option.foodId;publication.meals[1].mainSnapshot.portion.composition.nutrients.calories=null;
 assert.equal(nutritionShopping(publication,1,'1',{}).items.length,2);
 publication.meals[1].mainSnapshot.portion.composition=structuredClone(first.mainSnapshot.portion.composition);
 assert.equal(nutritionShopping(publication,1,'1',{}).items.length,1);
});
test('invalid scope choices precision and missing snapshots fail without changing the publication',()=>{
 const publication=createNutritionState().publications[0],before=structuredClone(publication);
 assert.throws(()=>nutritionShopping(publication,2,'1',{}),/pertence/);
 for(const days of ['0','8','1.5','01','1e0','-1','', ' 1'])assert.throws(()=>nutritionShopping(publication,1,days,{}),/dias/);
 assert.throws(()=>nutritionShopping(publication,1,'1',{999:'omit'}),/pertence/);
 assert.throws(()=>nutritionShopping(publication,1,'1',{1:'invalid' as ShoppingChoice}),/inválida/);
 assert.throws(()=>nutritionShopping(publication,1,'1',{2:'alternative'}),/alternativa/);
 const broken=structuredClone(publication);broken.meals[0].additional=[{foodId:'cereal',grams:100}];assert.throws(()=>nutritionShopping(broken,1,'1',{}),/incompletos/);
 broken.meals[0].additional=undefined;broken.meals[0].mainSnapshot.portion.quantity.amount=0.0001;assert.throws(()=>nutritionShopping(broken,1,'1',{}));
 assert.deepEqual(publication,before);
});
