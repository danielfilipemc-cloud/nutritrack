import test from 'node:test';
import assert from 'node:assert/strict';
import {gramsForNutrient,parseManualTargets,productSnapshot,reusableFoods,targetBalance} from '../lib/nutrition-planning';
import {nutritionTotals,type CompositionV1} from '../lib/nutrition-contract';
import {parseNutritionCommandV1} from '../lib/nutrition-command';

const composition:CompositionV1={contractVersion:1,basis:{amount:100,unit:'g'},nutrients:{calories:125,protein:10,carbs:null,fat:0}};
const product={name:'Alimento sintético',brand:'Marca fictícia',preparation:'as-sold' as const,composition};
const targets=()=>parseManualTargets({contractVersion:1,source:'manual',nutrients:{calories:1800,protein:90,carbs:200,fat:60}});

test('product labels become valid immutable manual V1 snapshots with brand and preparation',()=>{
 const item=productSnapshot(product,250);assert.equal(item.label,'Alimento sintético · Marca fictícia · como vendido');
 assert.deepEqual(nutritionTotals([{composition:item.composition,quantity:item.quantity}]).nutrients,{calories:312.5,protein:25,carbs:null,fat:0});
 const command=parseNutritionCommandV1({contractVersion:1,requestId:'00000000-0000-0000-0000-000000000123',mealId:null,expectedRevision:0,consumedOn:'2026-10-01',mealKind:'lunch',operation:'save',items:[item]},'2026-10-01');
 assert.deepEqual(command.items,[item]);
 item.composition.nutrients.protein=99;assert.equal(composition.nutrients.protein,10);
 assert.match(productSnapshot({...product,brand:'',preparation:'cooked'},100).label,/cozinhado$/);
});

test('product labels reject unsupported units, versions, overflow, blank names and unsafe text',()=>{
 for(const grams of [0,-1,5001,Infinity,NaN,1.0001])assert.throws(()=>productSnapshot(product,grams));
 for(const name of [' ','a\nname','x'.repeat(121)])assert.throws(()=>productSnapshot({...product,name},100));
 for(const invalid of [{...composition,contractVersion:2},{...composition,basis:{amount:100,unit:'ml'}},{...composition,nutrients:{...composition.nutrients,fat:101}}])assert.throws(()=>productSnapshot({...product,composition:invalid as CompositionV1},100));
});

test('quantity solver distinguishes unknown and known zero and never silently substitutes quantities',()=>{
 assert.equal(gramsForNutrient(composition,'protein',25),250);
 assert.equal(gramsForNutrient(composition,'calories',200),160);
 for(const key of ['carbs','fat'] as const)assert.throws(()=>gramsForNutrient(composition,key,10));
 for(const value of [0,-1,Infinity,NaN,10000,.00000001])assert.throws(()=>gramsForNutrient(composition,'protein',value));
});

test('daily balance refuses incomplete pages, empty diaries and unknown nutrients; overshoots stay signed',()=>{
 const portion=productSnapshot(product,250);
 assert.deepEqual(targetBalance([portion],targets(),true),{calories:1487.5,protein:65,carbs:null,fat:60});
 const unknown={calories:null,protein:null,carbs:null,fat:null};
 assert.deepEqual(targetBalance([portion],targets(),false),unknown);assert.deepEqual(targetBalance([],targets(),true),unknown);
 const highProtein=productSnapshot(product,1000),low=targets();low.nutrients.protein=90;
 assert.equal(targetBalance([highProtein],low,true).protein,-10);
 low.nutrients.calories=null;assert.equal(targetBalance([portion],low,true).calories,null);
});

test('manual references reject extra fields, invalid numbers and prescription metadata',()=>{
 for(const invalid of [{...targets(),source:'automatic'},{...targets(),weight:80},{...targets(),contractVersion:2},{...targets(),nutrients:{...targets().nutrients,fibre:20}}])assert.throws(()=>parseManualTargets(invalid));
 for(const value of [0,-1,Infinity,'100',1.0001,10001])assert.throws(()=>parseManualTargets({...targets(),nutrients:{...targets().nutrients,calories:value}}));
});

test('reusable items deduplicate identical snapshots but retain composition changes and do not alias history',()=>{
 const first=productSnapshot(product,100),second=productSnapshot(product,200),updated=productSnapshot({...product,composition:{...composition,nutrients:{...composition.nutrients,protein:11}}},100);
 const result=reusableFoods([first,second,updated]);assert.equal(result.length,2);
 result[0].composition.nutrients.protein=50;assert.equal(first.composition.nutrients.protein,10);
});
