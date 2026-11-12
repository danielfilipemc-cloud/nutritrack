'use client';
import {useRef} from 'react';
import {foodDraft,type FoodDraft} from '../lib/nutrition-editor';
const nutrients={calories:'Energia (kcal)',protein:'Proteína (g)',carbs:'Hidratos (g)',fat:'Gordura (g)'};
export default function NutritionFoodEditor({value,onChange,disabled=false,max=8}:{value:FoodDraft[];onChange:(v:FoodDraft[])=>void;disabled?:boolean;max?:number}){
 const labels=useRef<Record<string,HTMLInputElement|null>>({});
 function change(key:string,field:keyof FoodDraft,text:string){onChange(value.map(v=>v.key===key?{...v,[field]:text}:v));}
 function add(){const next=foodDraft();onChange([...value,next]);setTimeout(()=>labels.current[next.key]?.focus(),0);}
 function remove(index:number){const next=value.filter((_,i)=>i!==index);onChange(next);setTimeout(()=>labels.current[next[Math.min(index,next.length-1)].key]?.focus(),0);}
 return <div><p>Composição manual por 100 g. Vazio significa desconhecido; indica zero explicitamente.</p>{value.map((item,index)=><fieldset key={item.key} disabled={disabled}><legend>Alimento {index+1}</legend>
  <label>Nome do alimento<input ref={el=>{labels.current[item.key]=el;}} maxLength={120} required value={item.label} onChange={e=>change(item.key,'label',e.target.value)}/></label>
  <label>Quantidade (g)<input type="number" min="0.001" max="5000" step="0.001" required value={item.grams} onChange={e=>change(item.key,'grams',e.target.value)}/></label>
  <div className="columns">{(Object.keys(nutrients) as (keyof typeof nutrients)[]).map(k=><label key={k}>{nutrients[k]} por 100 g<input type="number" min="0" max={k==='calories'?1000:100} step="0.001" value={item[k]} onChange={e=>change(item.key,k,e.target.value)}/></label>)}</div>
  {value.length>1&&<button type="button" className="outline" onClick={()=>remove(index)}>Remover alimento {index+1}</button>}
 </fieldset>)}<button type="button" className="outline" disabled={disabled||value.length>=max} onClick={add}>Adicionar alimento</button></div>;
}
