import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portionNutrients,mealNutrients} from '../lib/nutrition';
const food={calories:120,protein:10,carbs:15,fat:2.5};
test('pure NutriTrack portion arithmetic scales composition and rounds only meal totals',()=>{
 assert.deepEqual(portionNutrients(food,150),{calories:180,protein:15,carbs:22.5,fat:3.75});
 assert.deepEqual(mealNutrients([]),{calories:0,protein:0,carbs:0,fat:0});
 assert.equal(mealNutrients(Array.from({length:3},()=>({per100g:{...food,protein:1},grams:33.33}))).protein,1);
 assert.equal(portionNutrients(food,0).calories,0);assert.equal(food.protein,10);
});
test('nutrition integration rejects negative, missing and non-finite values',()=>{
 for(const grams of [-1,NaN,Infinity])assert.throws(()=>portionNutrients(food,grams),RangeError);
 for(const value of [-1,NaN,Infinity,undefined])assert.throws(()=>portionNutrients({...food,fat:value as number},100),RangeError);
 assert.throws(()=>portionNutrients({...food,protein:Number.MAX_VALUE},1000),RangeError);
 assert.ok(Number.isFinite(mealNutrients([{per100g:{...food,protein:1e300},grams:100}]).protein));
});
