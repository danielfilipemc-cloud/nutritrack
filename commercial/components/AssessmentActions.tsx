'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {db} from '../lib/supabase';
import {measurement,validDate} from '../lib/validation';
import {foundationError} from '../lib/foundations';
export type EditableAssessment={id:string;assessed_on:string;weight_kg:number|null;height_cm:number|null;waist_cm:number|null;revision:number;student_visible:boolean;superseded_at:string|null};
export default function AssessmentActions({org,assessment:a,onSaved}:{org:string;assessment:EditableAssessment;onSaved:()=>void}){
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[conflict,setConflict]=useState(false),[reason,setReason]=useState('');
 const [date,setDate]=useState(a.assessed_on),[weight,setWeight]=useState(String(a.weight_kg??'')),[height,setHeight]=useState(String(a.height_cm??'')),[waist,setWaist]=useState(String(a.waist_cm??''));
 async function run(params:Record<string,unknown>,correct=false){if(!db||busy||conflict)return;setBusy(true);setMessage('');try{
 const r=await db.rpc(correct?'aura_assessment_correct':'aura_assessment_share',params);if(!alive.current)return;
 if(r.error){setMessage(foundationError(r.error));setConflict(r.error.code==='PT409');return;}onSaved();
 }catch{if(alive.current)setMessage('Falha de ligação.');}finally{if(alive.current)setBusy(false);}}
 function correct(e:FormEvent){e.preventDefault();try{
 if(!validDate(date)||reason.trim().length<5)throw new Error();
 const w=measurement(weight,500,2),h=measurement(height,300,1),wa=measurement(waist,300,1);if([w,h,wa].every(v=>v===null))throw new Error();
 void run({p_org:org,p_assessment:a.id,p_revision:a.revision,p_date:date,p_weight:w,p_height:h,p_waist:wa,p_reason:reason.trim()},true);
 }catch{setMessage('Indica uma data, uma medição válida e o motivo da correção (5–500 caracteres).');}}
 if(a.superseded_at)return <span>Substituída por correção; original preservado.</span>;
 return <><button className="outline" disabled={busy||conflict} onClick={()=>void run({p_org:org,p_assessment:a.id,p_revision:a.revision,p_visible:!a.student_visible})}>{a.student_visible?'Retirar partilha':'Partilhar com aluno'}</button>
 <details><summary>Corrigir medição</summary><form onSubmit={correct}><label>Data da correção<input type="date" required value={date} onChange={e=>setDate(e.target.value)} disabled={busy||conflict}/></label><label>Peso corrigido (kg)<input type="number" step=".01" min=".01" max={500} value={weight} onChange={e=>setWeight(e.target.value)} disabled={busy||conflict}/></label><label>Altura corrigida (cm)<input type="number" step=".1" value={height} onChange={e=>setHeight(e.target.value)} disabled={busy||conflict}/></label><label>Cintura corrigida (cm)<input type="number" step=".1" value={waist} onChange={e=>setWaist(e.target.value)} disabled={busy||conflict}/></label><label>Motivo da correção<input required minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy||conflict}/></label><p>O original fica preservado. A nova medição exige nova partilha com o aluno.</p><button disabled={busy||conflict}>Guardar correção</button></form></details>
 {message&&<p role="status">{message}</p>}{conflict&&<button className="outline" onClick={onSaved}>Recarregar histórico</button>}</>;
}
