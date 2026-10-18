import {parsePortionV1, type PortionV1} from './nutrition-contract';
import {validDate} from './validation';
export type NutritionItemV1 = PortionV1 & {label: string; source: 'manual'};
export type NutritionCommandV1 = {
 contractVersion: 1; requestId: string; mealId: string | null; expectedRevision: number;
 consumedOn: string; mealKind: 'breakfast'|'lunch'|'dinner'|'snack'|'other'; operation: 'save'|'void'; items: NutritionItemV1[];
};
function record(value: unknown, keys: string[]): Record<string, unknown> {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new TypeError('Unexpected command fields');
 return value as Record<string, unknown>;
}
function uuid(value: unknown) {
 if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new TypeError('Invalid request identity');
 return value.toLowerCase();
}
/** Pure command contract only. Organization/client are separate RPC arguments;
 * the database must authorize them and derive the actor. No network or storage.
 */
export function parseNutritionCommandV1(input: unknown, today: string): NutritionCommandV1 {
 const value = record(input, ['contractVersion','requestId','mealId','expectedRevision','consumedOn','mealKind','operation','items']);
 const mealId = value.mealId === null ? null : uuid(value.mealId);
 if (value.contractVersion !== 1 || typeof value.expectedRevision !== 'number' || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < (mealId ? 1 : 0) || (!mealId && value.expectedRevision !== 0)
 || typeof value.consumedOn !== 'string' || !validDate(today) || !validDate(value.consumedOn) || value.consumedOn.startsWith('0000-') || value.consumedOn > today
 || !['breakfast','lunch','dinner','snack','other'].includes(value.mealKind as string) || !['save','void'].includes(value.operation as string)
 || !Array.isArray(value.items) || (value.operation === 'void' ? !mealId || value.items.length !== 0 : value.items.length < 1 || value.items.length > 50)) throw new RangeError('Invalid nutrition command');
 const items = value.items.map(input => {
  const item = record(input, ['label','quantity','composition','source']);
  if (typeof item.label !== 'string' || Array.from(item.label.trim()).length < 1 || Array.from(item.label.trim()).length > 120 || /[\u0000-\u001f\u007f]/.test(item.label) || item.source !== 'manual') throw new TypeError('Invalid manual food snapshot');
  return {...parsePortionV1({composition: item.composition, quantity: item.quantity}), label: item.label.trim(), source: 'manual' as const};
 });
 return {contractVersion: 1, requestId: uuid(value.requestId), mealId, expectedRevision: value.expectedRevision, consumedOn: value.consumedOn, mealKind: value.mealKind as NutritionCommandV1['mealKind'], operation: value.operation as NutritionCommandV1['operation'], items};
}
