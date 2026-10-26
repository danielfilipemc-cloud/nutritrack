"use client";
import {useEffect,useRef} from 'react';
import {nutritionFoods,optionPortion,parseMealOption,nutritionTotals,type MealDraft} from './nutrition';
import {nutrientKeys} from '../../../lib/nutrition-contract';
const labels={calories:'Energia',protein:'Proteína',carbs:'Hidratos',fat:'Gordura'};
const format=(n:number)=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:2}).format(n);
export default function MealCompositionEditor({draft,onChange}:{draft:MealDraft;onChange:(next:Partial<MealDraft>)=>void}){
 const addButton=useRef<HTMLButtonElement>(null),group=useRef<HTMLFieldSetElement>(null);
 const pendingFocus=useRef<'add'|'item'|null>(null);
 useEffect(()=>{if(pendingFocus.current==='add')addButton.current?.focus();if(pendingFocus.current==='item'){const selects=group.current?.querySelectorAll('select');selects?.[selects.length-1]?.focus();}pendingFocus.current=null;},[draft.additional?.length]);
 const items=draft.additional||[];
 const portions=[{foodId:draft.foodId,grams:draft.grams},...items];
 let total:ReturnType<typeof nutritionTotals>|null=null;
 try{total=nutritionTotals(portions.map(item=>optionPortion(parseMealOption(item.foodId,item.grams)).portion));}catch{/* Keep the draft intact while quantities are incomplete. */}
 return <fieldset ref={group} className="aura-meal-composer"><legend>Composição da refeição</legend><p>O alimento principal e os alimentos abaixo formam uma única refeição. A alternativa substitui este conjunto.</p>
 {items.map((item,index)=><div className="aura-meal-composer-row" key={index}><label>Alimento adicional {index+1}<select value={item.foodId} onChange={e=>onChange({additional:items.map((value,i)=>i===index?{...value,foodId:e.target.value}:value)})}>{nutritionFoods.map(food=><option key={food.id} value={food.id}>{food.name}</option>)}</select></label><label>Quantidade adicional {index+1} (g)<input type="number" required min="0.001" max="5000" step="0.001" value={item.grams} onChange={e=>onChange({additional:items.map((value,i)=>i===index?{...value,grams:e.target.value}:value)})}/></label><button className="quiet" type="button" aria-label={`Remover alimento adicional ${index+1}`} onClick={()=>{pendingFocus.current='add';onChange({additional:items.filter((_,i)=>i!==index)});}}>Remover</button></div>)}
 <button ref={addButton} type="button" className="quiet" disabled={items.length>=7} onClick={()=>{pendingFocus.current='item';onChange({additional:[...items,{foodId:'fruta',grams:'100'}]});}}>Adicionar alimento à refeição</button><span className="aura-preview-note">{items.length+1} de 8 alimentos</span>
 <section aria-label="Composição do rascunho"><h4>Composição desta opção principal</h4>{total?<dl className="aura-demo-nutrition-metrics">{nutrientKeys.map(key=><div key={key}><dt>{labels[key]}</dt><dd>{total.nutrients[key]===null?'—':format(total.nutrients[key])}<small> {key==='calories'?'kcal':'g'}</small>{total.missing[key]>0&&<small className="aura-demo-nutrition-subtotal">{format(total.knownSubtotal[key])} conhecidos · {total.missing[key]} sem valor</small>}</dd></div>)}</dl>:<p>Completa as quantidades para consultar a composição.</p>}<p className="aura-preview-note">Valores inventados para demonstração. Sem metas ou recomendações. A alternativa não entra neste total.</p></section>
 </fieldset>;
}
