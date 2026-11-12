'use client';
import {dishDraft,mealDraft,type DishDraft,type MealDraft} from '../lib/nutrition-plan-editor';
import type {DocumentVersion} from '../lib/nutrition-document-persistence';
import NutritionFoodEditor from './NutritionFoodEditor';
function DishEditor({value,onChange,recipes,disabled,label}:{value:DishDraft;onChange:(v:DishDraft)=>void;recipes:DocumentVersion[];disabled:boolean;label:string}){
 const key=value.recipeId?`${value.recipeId}:${value.revision}`:'';
 return <fieldset disabled={disabled}><legend>{label}</legend><label>Origem do prato<select value={value.source} onChange={e=>onChange({...value,source:e.target.value as DishDraft['source']})}><option value="manual">Alimentos manuais</option><option value="recipe">Receita publicada</option></select></label>
  {value.source==='manual'?<NutritionFoodEditor value={value.foods} onChange={foods=>onChange({...value,foods})} disabled={disabled}/>:<><label>Receita e versão publicada<select required value={key} onChange={e=>{const [recipeId,revision]=e.target.value.split(':');onChange({...value,recipeId,revision});}}><option value="">Seleciona uma receita</option>{key&&!recipes.some(r=>`${r.documentId}:${r.revision}`===key)&&<option value={key}>Referência histórica · versão {value.revision}</option>}{recipes.map(r=><option key={r.documentId} value={`${r.documentId}:${r.revision}`}>{r.body.title} · versão {r.revision}</option>)}</select></label><p>A versão escolhida fica explícita. Se deixou de estar disponível, escolhe outra conscientemente; não há substituição automática.</p></>}
 </fieldset>;
}
export default function NutritionPlanEditor({value,onChange,recipes,disabled}:{value:MealDraft[];onChange:(m:MealDraft[])=>void;recipes:DocumentVersion[];disabled:boolean}){
 const update=(id:string,change:Partial<MealDraft>)=>onChange(value.map(m=>m.id===id?{...m,...change}:m));
 return <div>{value.map((meal,index)=><fieldset key={meal.id} disabled={disabled}><legend>Refeição do plano {index+1}</legend>
  <label>Nome da refeição<input required maxLength={120} value={meal.label} onChange={e=>update(meal.id,{label:e.target.value})}/></label><label>Hora da refeição (opcional)<input type="time" value={meal.time} onChange={e=>update(meal.id,{time:e.target.value})}/></label>
  <DishEditor label="Prato principal" value={meal.primary} recipes={recipes} disabled={disabled} onChange={primary=>update(meal.id,{primary})}/>
  {meal.alternatives.map((a,i)=><fieldset key={a.id}><legend>Alternativa {i+1}</legend><label>Nome da alternativa<input required maxLength={120} value={a.label} onChange={e=>update(meal.id,{alternatives:meal.alternatives.map(x=>x.id===a.id?{...x,label:e.target.value}:x)})}/></label><DishEditor label={`Composição da alternativa ${i+1}`} value={a.dish} recipes={recipes} disabled={disabled} onChange={dish=>update(meal.id,{alternatives:meal.alternatives.map(x=>x.id===a.id?{...x,dish}:x)})}/><button type="button" className="outline" onClick={()=>update(meal.id,{alternatives:meal.alternatives.filter(x=>x.id!==a.id)})}>Remover alternativa {i+1}</button></fieldset>)}
  <button type="button" className="outline" disabled={meal.alternatives.length>=3} onClick={()=>update(meal.id,{alternatives:[...meal.alternatives,{id:crypto.randomUUID(),label:'',dish:dishDraft()}]})}>Adicionar alternativa</button>
  {value.length>1&&<button type="button" className="outline" onClick={()=>onChange(value.filter(m=>m.id!==meal.id))}>Remover refeição {index+1}</button>}
 </fieldset>)}<button type="button" className="outline" disabled={disabled||value.length>=12} onClick={()=>onChange([...value,mealDraft()])}>Adicionar refeição ao plano</button><p>Alternativas substituem o prato principal; não são somadas como consumo. Este documento não regista o que foi consumido.</p></div>;
}
