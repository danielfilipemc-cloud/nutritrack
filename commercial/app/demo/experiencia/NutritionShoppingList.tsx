import type {NutritionPublication} from './nutrition';
import {nutritionShopping,type ShoppingChoice,type ShoppingView} from './nutrition-shopping';
const format=(value:number)=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:3}).format(value);

export default function NutritionShoppingList({publication,studentId,current,view,onChange}:{publication:NutritionPublication;studentId:number;current:boolean;view:ShoppingView;onChange:(next:Partial<ShoppingView>)=>void}){
 if(!current)return <p className="aura-preview-note">A lista de compras está disponível na versão alimentar atual. As escolhas de cada versão mantêm-se separadas.</p>;
 let result:ReturnType<typeof nutritionShopping>;
 try{result=nutritionShopping(publication,studentId,view.days,view.choices);}catch{return <p role="alert">Não foi possível preparar a lista desta versão. O plano e os registos mantêm-se.</p>;}
 const sameNames=new Map<string,number>();for(const item of result.items)sameNames.set(item.name,(sameNames.get(item.name)||0)+1);
 return <section className="aura-native-shopping" aria-label="Lista de compras do plano"><details open={view.open}><summary onClick={event=>{event.preventDefault();onChange({open:!view.open});}}>Preparar lista de compras</summary>
  <h3>Compras para o plano · versão {publication.version}</h3><p>As opções principais estão pré-selecionadas. Escolhe o que queres incluir; uma alternativa substitui a refeição principal completa.</p>
  <label>Número de dias iguais<select value={view.days} onChange={event=>onChange({days:event.target.value})}>{[1,2,3,4,5,6,7].map(day=><option key={day} value={day}>{day} {day===1?'dia':'dias'}</option>)}</select></label>
  <p className="aura-preview-note">Repete as mesmas escolhas pelos dias indicados. Esta lista não altera o plano, não regista consumo e não é uma nova recomendação alimentar. Quantidades em gramas, sem conversão entre alimentos crus e cozinhados.</p>
  <div className="aura-shopping-choices">{publication.meals.map(meal=><label key={meal.id}>Escolha para compras · {meal.name} às {meal.time}<select value={view.choices[meal.id]||'main'} onChange={event=>onChange({choices:{...view.choices,[meal.id]:event.target.value as ShoppingChoice}})}><option value="main">Opção principal</option>{meal.alternativeSnapshot&&<option value="alternative">Alternativa à refeição completa</option>}<option value="omit">Não incluir nesta compra</option></select></label>)}</div>
  <div role="status" className="aura-preview-note">{result.includedMeals} {result.includedMeals===1?'refeição selecionada':'refeições selecionadas'} · {result.days} {result.days===1?'dia igual':'dias iguais'} · {result.items.length} {result.items.length===1?'alimento':'alimentos'}</div>
  {result.items.length?<ul className="aura-shopping-items">{result.items.map(item=><li key={item.key}><div><strong>{item.name}</strong>{sameNames.get(item.name)!>1&&<span className="aura-preview-note">Composição ou origem distinta; apresentado separadamente.</span>}<details><summary>Ver refeições de origem · {item.name}</summary><ul>{item.sources.map((source,index)=><li key={index}>{source.mealName} · {source.choice==='main'?'opção principal':'alternativa'} · {format(source.gramsPerDay)} g por dia</li>)}</ul></details></div><strong>{format(item.grams)} g</strong></li>)}</ul>:<p>Nenhum alimento selecionado para esta compra. O plano mantém-se.</p>}
 </details></section>;
}
