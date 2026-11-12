import test from 'node:test';
import assert from 'node:assert/strict';
import {foodDraft,foodItems,editableDocument} from '../lib/nutrition-editor';
import {mealDraft,planBody} from '../lib/nutrition-plan-editor';
import {parseDocumentCommand,type PlanBody,type FrozenDish} from '../lib/nutrition-document-command';
import type {DocumentVersion} from '../lib/nutrition-document-persistence';
import {recipeBody} from './native-document-fixture';
import {id} from './foundation-fixture';

test('food editor preserves zero/unknown, rejects invalid quantities and never sends UI identities',()=>{
 const item=recipeBody().items[0];item.composition.nutrients={calories:0,protein:null,carbs:2.125,fat:0};
 const draft=foodDraft(item);assert.equal(draft.calories,'0');assert.equal(draft.protein,'');
 assert.deepEqual(foodItems([draft]),[item]);assert.ok(!Object.hasOwn(foodItems([draft])[0],'key'));
 for(const grams of ['','0','-1','5001','NaN'])assert.throws(()=>foodItems([{...draft,grams}]));
 assert.throws(()=>foodItems([{...draft,protein:'101'}]));
});

test('editing a frozen plan preserves recipe revision, identifiers and alternative semantics without mutating stored content',()=>{
 const item=recipeBody().items[0];
 const body:PlanBody<FrozenDish>={title:'Plano fictício',notes:null,meals:[{id:id(9101),label:'Refeição',time:null,primary:{source:'recipe',recipeId:id(9102),revision:2,snapshot:recipeBody()},alternatives:[{id:id(9103),label:'Alternativa',dish:{source:'manual',items:[item]}}]}]};
 const version:DocumentVersion={documentId:id(9100),kind:'plan',revision:3,status:'draft',body,reason:'Revisão fictícia',recordedBy:id(2)},copy=structuredClone(version);
 const edited=editableDocument(version) as PlanBody,drafts=edited.meals.map(mealDraft),output=planBody(edited.title,'',drafts);
 assert.deepEqual(output.meals[0].primary,{source:'recipe',recipeId:id(9102),revision:2});
 assert.equal(output.meals[0].time,null);assert.equal(output.meals[0].alternatives[0].id,id(9103));
 assert.deepEqual(version,copy);assert.ok(!Object.hasOwn(output.meals[0].primary,'snapshot'));
 const command=parseDocumentCommand({contractVersion:1,requestId:id(9110),documentId:version.documentId,kind:'plan',expectedRevision:3,operation:'save',body:output,reason:'Alteração manual'});
 assert.deepEqual(command.body,output);
 drafts[0].primary.source='manual';drafts[0].primary.foods[0].label='Composição manual';
 const manual=planBody(edited.title,'',drafts).meals[0].primary;assert.equal(manual.source,'manual');
 if(manual.source==='manual')assert.equal(manual.items[0].composition.nutrients.calories,null);
 assert.deepEqual(version,copy);
});
