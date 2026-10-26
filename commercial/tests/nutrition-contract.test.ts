import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nutritionTotals, parseCompositionV1, parsePortionV1, type CompositionV1} from '../lib/nutrition-contract';
const composition: CompositionV1 = {contractVersion: 1, basis: {amount: 100, unit: 'g'}, nutrients: {calories: 101, protein: 1, carbs: 20, fat: 0}};
const portion = (amount: number, source = composition) => ({composition: source, quantity: {amount, unit: 'g' as const}});
test('V1 isolates snapshots, preserves known zero and rejects implicit unknowns', () => {
 const copy = parseCompositionV1(composition); copy.nutrients.calories = 999;
 assert.equal(composition.nutrients.calories, 101);
 assert.equal(nutritionTotals([portion(100)]).nutrients.fat, 0);
 for (const invalid of [{...composition, contractVersion: 2}, {...composition, basis: {amount: 100, unit: 'ml'}}, {...composition, extra: true}, {...composition, nutrients: {...composition.nutrients, fat: undefined}}]) assert.throws(() => parseCompositionV1(invalid));
});
test('quantity and composition reject negative, nonfinite, excessive and ambiguous precision', () => {
 for (const amount of [0, -1, NaN, Infinity, 5000.001, 1.0001]) assert.throws(() => parsePortionV1(portion(amount)));
 for (const value of [-1, NaN, Infinity, 1000.001, 1.0001]) assert.throws(() => parseCompositionV1({...composition, nutrients: {...composition.nutrients, calories: value}}));
 assert.throws(() => parsePortionV1({...portion(10), quantity: {amount: 10, unit: 'kg'}}));
 assert.throws(() => parseCompositionV1({...composition, nutrients: {...composition.nutrients, protein: 101}}));
});
test('partial composition exposes subtotal and missing count without inventing energy', () => {
 const partial = {...composition, nutrients: {...composition.nutrients, calories: null}};
 const total = nutritionTotals([portion(100), portion(50, partial)]);
 assert.equal(total.nutrients.calories, null); assert.equal(total.knownSubtotal.calories, 101); assert.equal(total.missing.calories, 1);
 assert.equal(total.nutrients.protein, 1.5); assert.equal(total.compositionComplete, false);
 assert.equal(nutritionTotals([]).nutrients.calories, null);
 assert.equal(nutritionTotals([]).compositionComplete, false);
});
test('quantity revisions recompute immutable source instead of rounded previous values', () => {
 assert.equal(nutritionTotals([portion(100)]).nutrients.calories, 101);
 assert.equal(nutritionTotals([portion(50)]).nutrients.calories, 50.5);
 assert.equal(nutritionTotals([portion(100)]).nutrients.calories, 101);
 const source = {...composition, nutrients: {...composition.nutrients, calories: 1.005}};
 assert.equal(nutritionTotals([portion(100, source)]).nutrients.calories, 1.01);
 assert.equal(nutritionTotals(Array.from({length: 3}, () => portion(33.333))).nutrients.protein, 1);
});
test('bounded fractional arithmetic agrees with independent integer oracle across 1600 portions', () => {
 let numerator = BigInt(0);
 const inputs = Array.from({length: 1600}, (_, i) => {
  const milliValue = (i * 997) % 1_000_001, milliGrams = (i * 7919) % 5_000_000 + 1;
  numerator += BigInt(milliValue) * BigInt(milliGrams);
  return portion(milliGrams / 1000, {...composition, nutrients: {...composition.nutrients, calories: milliValue / 1000}});
 });
 assert.equal(nutritionTotals(inputs).nutrients.calories, Number((numerator + BigInt(500_000)) / BigInt(1_000_000)) / 100);
 assert.throws(() => nutritionTotals([...inputs, portion(1)]));
});


