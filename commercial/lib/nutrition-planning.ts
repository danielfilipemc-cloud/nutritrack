/** Manual planning arithmetic; no energy prescription, storage or tenant access. */
import {nutritionTotals,nutrientKeys,parseCompositionV1,type CompositionV1,type PortionV1} from './nutrition-contract';
import {foodItems,type FoodDraft} from './nutrition-editor';
import type {NutritionItemV1} from './nutrition-command';

export type ManualTargetsV1={contractVersion:1;source:'manual';nutrients:CompositionV1['nutrients']};
const limits={calories:10000,protein:1000,carbs:2000,fat:1000};
export function parseManualTargets(input:unknown):ManualTargetsV1{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Metas inválidas.');
 const v=input as Record<string,unknown>;
 if(Object.keys(v).length!==3||v.contractVersion!==1||v.source!=='manual'||!v.nutrients||typeof v.nutrients!=='object'||Array.isArray(v.nutrients))throw new TypeError('Contrato de metas inválido.');
 const n=v.nutrients as Record<string,unknown>;
 if(Object.keys(n).length!==4||nutrientKeys.some(k=>!Object.hasOwn(n,k)))throw new TypeError('Composição das metas inválida.');
 const values=Object.fromEntries(nutrientKeys.map(k=>{
  const value=n[k];if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>limits[k]||value!==Number(value.toFixed(3))))throw new RangeError('Indica metas positivas ou deixa o campo vazio.');
  return [k,value];
 })) as CompositionV1['nutrients'];
 return {contractVersion:1,source:'manual',nutrients:values};
}

/** Never turn empty/partial pages or unknown nutrients into a complete daily balance. */
export function targetBalance(portions:readonly PortionV1[],targets:ManualTargetsV1,complete:boolean){
 const valid=parseManualTargets(targets),total=nutritionTotals(portions.map(({composition,quantity})=>({composition,quantity})));
 return Object.fromEntries(nutrientKeys.map(k=>[k,!complete||total.nutrients[k]===null||valid.nutrients[k]===null?null:Math.round((valid.nutrients[k]!-total.nutrients[k]!)*100)/100])) as CompositionV1['nutrients'];
}

export type ProductLabelV1={name:string;brand:string;preparation:'as-sold'|'raw'|'cooked';composition:CompositionV1};
/** The saved V1 snapshot records the brand/preparation in its existing label.
 * No mass/volume conversion, catalogue claim, new command fields or SQL changes. */
export function productSnapshot(product:ProductLabelV1,grams:number):NutritionItemV1{
 const suffix={'as-sold':'como vendido',raw:'cru',cooked:'cozinhado'}[product.preparation];
 if(!suffix||typeof product.name!=='string'||!product.name.trim()||typeof product.brand!=='string')throw new TypeError('Identifica o alimento e o estado de preparação.');
 const label=[product.name.trim(),product.brand.trim(),suffix].filter(Boolean).join(' · ');
 if(Array.from(label).length>120||/[\u0000-\u001f\u007f]/.test(label))throw new TypeError('Nome, marca e estado devem ter até 120 caracteres, sem quebras de linha.');
 const composition=parseCompositionV1(product.composition);
 const result={label,source:'manual' as const,composition,quantity:{amount:grams,unit:'g' as const}};
 // Reuse the same validator as persisted meals, preserving unknown versus zero.
 const draft={key:'validation',label,grams:String(grams),...Object.fromEntries(nutrientKeys.map(k=>[k,product.composition.nutrients[k]===null?'':String(product.composition.nutrients[k])]))} as FoodDraft;
 foodItems([draft]);
 return structuredClone(result);
}

/** Solve one quantity for one nutrient, without inventing missing composition. */
export function gramsForNutrient(composition:CompositionV1,key:typeof nutrientKeys[number],amount:number):number{
 nutritionTotals([{composition,quantity:{amount:100,unit:'g'}}]);
 if(!Number.isFinite(amount)||amount<=0)throw new RangeError('Indica uma quantidade positiva.');
 const per100=composition.nutrients[key];
 if(per100===null||per100<=0)throw new RangeError('Este valor não está disponível ou é zero no rótulo.');
 const grams=Math.round(amount/per100*100*1000)/1000;
 if(grams<=0||grams>5000)throw new RangeError('A porção calculada fica fora de 0,001 a 5000 g.');
 return grams;
}

export function reusableFoods(items:readonly NutritionItemV1[]):NutritionItemV1[]{
 const seen=new Set<string>();return items.filter(item=>{
  const signature=JSON.stringify([item.label,item.composition]);if(seen.has(signature))return false;seen.add(signature);return true;
 }).map(item=>structuredClone(item));
}
