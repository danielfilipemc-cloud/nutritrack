/** Pure portion arithmetic adapted from NutriTrack index.html selectFood.
 * No storage, identity, network, recommendation or legacy synchronisation.
 * Values describe food composition per 100g, not personalised targets.
 */
export type Nutrients={calories:number;protein:number;carbs:number;fat:number};
const keys=['calories','protein','carbs','fat'] as const;
export function portionNutrients(per100g:Nutrients,grams:number):Nutrients{
 if(!Number.isFinite(grams)||grams<0)throw new RangeError('Invalid portion');
 return Object.fromEntries(keys.map(key=>{
  const value=per100g[key];if(!Number.isFinite(value)||value<0)throw new RangeError('Invalid composition');
  const scaled=value*grams/100;if(!Number.isFinite(scaled))throw new RangeError('Portion overflow');
  return [key,scaled];
 })) as Nutrients;
}
export function mealNutrients(portions:{per100g:Nutrients;grams:number}[]):Nutrients{
 const total:Nutrients={calories:0,protein:0,carbs:0,fat:0};
 for(const portion of portions){const values=portionNutrients(portion.per100g,portion.grams);for(const key of keys){total[key]+=values[key];if(!Number.isFinite(total[key]))throw new RangeError('Meal overflow');}}
 return Object.fromEntries(keys.map(key=>[key,total[key]>Number.MAX_VALUE/100?total[key]:Math.round(total[key]*100)/100])) as Nutrients;
}
