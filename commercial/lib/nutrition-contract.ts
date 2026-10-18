import {portionNutrients, type Nutrients} from './nutrition';

export const nutrientKeys = ['calories', 'protein', 'carbs', 'fat'] as const;
export type CompositionV1 = {
 contractVersion: 1;
 basis: {amount: 100; unit: 'g'};
 nutrients: Record<keyof Nutrients, number | null>;
};
export type PortionV1 = {composition: CompositionV1; quantity: {amount: number; unit: 'g'}};

function object(value: unknown, fields: string[]): Record<string, unknown> {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected object');
 const record = value as Record<string, unknown>;
 if (Object.keys(record).length !== fields.length || fields.some(key => !Object.hasOwn(record, key))) throw new TypeError('Unexpected fields');
 return record;
}
function decimal(value: unknown, max: number, positive = false): number {
 if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value === 0) || value > max || value !== Number(value.toFixed(3))) throw new RangeError('Invalid nutritional value');
 return value;
}
/** Explicit null means unknown; absent fields, other units and versions are rejected. */
export function parseCompositionV1(input: unknown): CompositionV1 {
 const value = object(input, ['contractVersion', 'basis', 'nutrients']);
 const basis = object(value.basis, ['amount', 'unit']);
 if (value.contractVersion !== 1 || basis.amount !== 100 || basis.unit !== 'g') throw new TypeError('Unsupported composition contract');
 const source = object(value.nutrients, [...nutrientKeys]);
 const nutrients = Object.fromEntries(nutrientKeys.map(key => [key, source[key] === null ? null : decimal(source[key], key === 'calories' ? 1000 : 100)])) as CompositionV1['nutrients'];
 return {contractVersion: 1, basis: {amount: 100, unit: 'g'}, nutrients};
}
export function parsePortionV1(input: unknown): PortionV1 {
 const value = object(input, ['composition', 'quantity']);
 const quantity = object(value.quantity, ['amount', 'unit']);
 if (quantity.unit !== 'g') throw new TypeError('Only mass in grams is supported');
 return {composition: parseCompositionV1(value.composition), quantity: {amount: decimal(quantity.amount, 5000, true), unit: 'g'}};
}
/** Round once after summation. Unknown composition never silently becomes zero.
 * Bounded three-decimal inputs recover integer 1e-8 numerators from the existing
 * portion calculator; <=1000 portions keep their sum within safe integer limits.
 */
export function nutritionTotals(input: readonly PortionV1[]) {
 if (!Array.isArray(input) || input.length > 1000) throw new RangeError('Too many portions');
 const numerators: Nutrients = {calories: 0, protein: 0, carbs: 0, fat: 0};
 const missing: Nutrients = {calories: 0, protein: 0, carbs: 0, fat: 0};
 for (const item of input) {
  const {composition, quantity} = parsePortionV1(item);
  const known = Object.fromEntries(nutrientKeys.map(key => [key, composition.nutrients[key] ?? 0])) as Nutrients;
  const scaled = portionNutrients(known, quantity.amount);
  for (const key of nutrientKeys) {
   if (composition.nutrients[key] === null) missing[key]++;
   else numerators[key] += Math.round(scaled[key] * 100_000_000);
   if (!Number.isSafeInteger(numerators[key])) throw new RangeError('Total overflow');
  }
 }
 const knownSubtotal = Object.fromEntries(nutrientKeys.map(key => [key, Math.floor((numerators[key] + 500_000) / 1_000_000) / 100])) as Nutrients;
 const nutrients = Object.fromEntries(nutrientKeys.map(key => [key, !input.length || missing[key] ? null : knownSubtotal[key]])) as CompositionV1['nutrients'];
 return {count: input.length, nutrients, knownSubtotal, missing, compositionComplete: input.length > 0 && nutrientKeys.every(key => missing[key] === 0)};
}

