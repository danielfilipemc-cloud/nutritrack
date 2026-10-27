import {nutrientKeys,nutritionTotals,type PortionV1} from '../../../lib/nutrition-contract';
const format=(n:number)=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:2}).format(n);
const labels={calories:'Energia',protein:'Proteína',carbs:'Hidratos',fat:'Gordura'};
export default function NutritionComposition({portions}:{portions:PortionV1[]}){const total=nutritionTotals(portions);return <dl className="aura-demo-nutrition-metrics">{nutrientKeys.map(key=><div key={key}><dt>{labels[key]}</dt><dd>{total.nutrients[key]===null?'—':format(total.nutrients[key])}<small> {key==='calories'?'kcal':'g'}</small>{total.missing[key]>0&&<small className="aura-demo-nutrition-subtotal">{format(total.knownSubtotal[key])} conhecidos · {total.missing[key]} sem valor</small>}</dd></div>)}</dl>;}
