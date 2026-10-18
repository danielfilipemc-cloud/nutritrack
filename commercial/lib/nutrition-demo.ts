import type {CompositionV1, PortionV1} from './nutrition-contract';
// Entirely invented examples, never derived from a client or legacy food catalogue.
export const demoFoods: readonly {id: string; name: string; composition: CompositionV1}[] = [
 {id: 'cereal', name: 'Cereal de exemplo', composition: {contractVersion: 1, basis: {amount: 100, unit: 'g'}, nutrients: {calories: 101, protein: 1, carbs: 22, fat: 0}}},
 {id: 'fruta', name: 'Fruta de exemplo', composition: {contractVersion: 1, basis: {amount: 100, unit: 'g'}, nutrients: {calories: 60, protein: 0.5, carbs: 14, fat: 0.2}}},
 {id: 'preparacao', name: 'Preparação de exemplo', composition: {contractVersion: 1, basis: {amount: 100, unit: 'g'}, nutrients: {calories: null, protein: 6, carbs: null, fat: 2}}},
];
export const demoDays = ['2026-10-16', '2026-10-15', '2026-10-14'] as const;
export function demoMeals(day: string): {id: string; name: string; time: string; items: {name: string; portion: PortionV1}[]}[] {
 const item = (index: number, amount: number) => ({name: demoFoods[index].name, portion: {composition: demoFoods[index].composition, quantity: {amount, unit: 'g' as const}}});
 if (day === demoDays[2]) return [];
 return [
  {id: 'breakfast', name: 'Pequeno-almoço', time: '08:30', items: [item(0, 100), item(1, 150)]},
  {id: 'lunch', name: 'Almoço', time: '13:00', items: [item(day === demoDays[0] ? 2 : 0, 200)]},
 ];
}
