import {useEffect,useRef} from 'react';
import type {MealDraft,NutritionState} from './nutrition';
import {entryPortions} from './nutrition';
import {demoDate} from './model';
import NativeMealFields from './NativeMealFields';

export type FreeEntryEdit={id:number;revision:number;mode:'correct'|'void';draft:MealDraft;date:string;note:string;reason:string};
export function FreeEntryEditor({edit,onChange,onSave,onCancel}:{edit:FreeEntryEdit;onChange:(next:FreeEntryEdit)=>void;onSave:()=>void;onCancel:()=>void}){
 const form=useRef<HTMLFormElement>(null);
 useEffect(()=>{form.current?.querySelector<HTMLElement>('input,textarea')?.focus();},[edit.id,edit.mode]);
 return <form ref={form} className="aura-preview-form" aria-label="Alteração do registo livre" onSubmit={event=>{event.preventDefault();onSave();}}>
  <h4 className="aura-demo-nutrition-full">{edit.mode==='correct'?'Corrigir':'Anular'} registo livre #{edit.id} · revisão {edit.revision}</h4>
  <p className="aura-demo-nutrition-full">O histórico anterior fica preservado. As ações de acompanhamento já criadas não são alteradas. {edit.mode==='correct'?'A correção volta à fila de revisão profissional.':'A anulação retira o registo dos totais e da fila de revisão.'}</p>
  {edit.mode==='correct'&&<><label>Dia da correção<input required type="date" min="2000-01-01" max={demoDate} value={edit.date} onChange={event=>onChange({...edit,date:event.target.value})}/></label><NativeMealFields mode="diary" draft={edit.draft} onChange={next=>onChange({...edit,draft:{...edit.draft,...next}})}/><label>Nota corrigida<textarea maxLength={500} value={edit.note} onChange={event=>onChange({...edit,note:event.target.value})}/></label></>}
  <label className="aura-demo-nutrition-full">Motivo da alteração<textarea required minLength={3} maxLength={300} value={edit.reason} onChange={event=>onChange({...edit,reason:event.target.value})}/></label>
  <button type="submit">{edit.mode==='correct'?'Guardar correção fictícia':'Confirmar anulação fictícia'}</button><button className="quiet" type="button" onClick={onCancel}>Cancelar alteração</button>
 </form>;
}

export function FreeEntryHistory({state,studentId,entryId}:{state:NutritionState;studentId:number;entryId:number}){
 const changes=(state.entryChanges||[]).filter(change=>change.studentId===studentId&&change.entryId===entryId);
 if(!changes.length)return null;
 return <details><summary>Histórico do registo livre #{entryId}</summary><ol>{changes.map(change=><li key={change.revision}><h5>Revisão {change.revision} · {change.kind==='correct'?'Corrigida':'Anulada'}</h5><p>{change.before.date} · {change.before.mealTime} · {change.before.mealName}</p><ul>{entryPortions(change.before).map((item,index)=><li key={index}>{item.name} · {item.portion.quantity.amount} g</li>)}</ul>{change.before.note&&<p>Nota anterior: {change.before.note}</p>}<p>{change.before.reviewedOn?`Revisto em ${change.before.reviewedOn} por ${change.before.reviewer}`:'Ainda não tinha revisão profissional'}</p><p>Motivo: {change.reason}</p></li>)}</ol></details>;
}
