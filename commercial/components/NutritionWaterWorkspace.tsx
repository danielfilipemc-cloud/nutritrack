'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {createNutritionWaterPersistence,type PersistedWater} from '../lib/nutrition-water-persistence';
import {type WaterCommandV1} from '../lib/nutrition-water-command';
import {NutritionPersistenceError} from '../lib/nutrition-persistence';
import {businessToday} from '../lib/care';
import {useNutritionResource,nutritionError,staleNutrition,type NutritionContext} from '../lib/use-nutrition-resource';
import NutritionUncertain from './NutritionUncertain';
type Props=NutritionContext&{onDirtyChange:(dirty:boolean,pending?:boolean)=>void};
export default function NutritionWaterWorkspace(props:Props){
 const [day,setDay]=useState(businessToday),[entryDay,setEntryDay]=useState(businessToday),[time,setTime]=useState(''),[amount,setAmount]=useState(''),[reason,setReason]=useState('');
 const [editing,setEditing]=useState<PersistedWater|null>(null),[voiding,setVoiding]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState('');
 const [extra,setExtra]=useState<PersistedWater[]>([]),[cursor,setCursor]=useState<string|null>(null),[cursorSet,setCursorSet]=useState(false);
 const [history,setHistory]=useState<PersistedWater[]>([]),[historyId,setHistoryId]=useState(''),[historyCursor,setHistoryCursor]=useState<number|null>(null);
 const [uncertain,setUncertain]=useState<WaterCommandV1|null>(null),[abandoned,setAbandoned]=useState(false);
 const resource=useNutritionResource(props,day,client=>createNutritionWaterPersistence(client,{organizationId:props.org,clientId:props.clientId},businessToday),repo=>repo.diary(day));
 const notify=useRef(props.onDirtyChange);notify.current=props.onDirtyChange;
 useEffect(()=>{notify.current(dirty||!!uncertain,resource.busy||(!!uncertain&&!abandoned));},[dirty,uncertain,resource.busy,abandoned]);
 useEffect(()=>()=>notify.current(false,false),[]);
 useEffect(()=>{setExtra([]);setCursor(null);setCursorSet(false);setHistory([]);setHistoryCursor(null);setHistoryId('');},[resource.data]);
 const rows=[...(resource.data?.entries||[]),...extra],next=cursorSet?cursor:resource.data?.nextCursor;
 const reset=()=>{setEditing(null);setVoiding(false);setEntryDay(day);setTime('');setAmount('');setReason('');setDirty(false);};
 const leave=()=>!resource.busy&&!uncertain&&(!dirty||window.confirm('Descartar o rascunho de água?'));
 function edit(row:PersistedWater,voided=false){if(!leave())return;setEditing(row);setVoiding(voided);setEntryDay(row.entry.consumedOn);setTime(row.entry.time||'');setAmount(String(row.entry.quantity.amount));setReason('');setDirty(true);}
 async function save(event:FormEvent){
  event.preventDefault();if(!resource.canWrite||uncertain)return;
  if(voiding&&!window.confirm('Anular a declaração mantendo o histórico?'))return;
  const command:WaterCommandV1={contractVersion:1,requestId:crypto.randomUUID(),waterId:editing?.waterId||null,expectedRevision:editing?.revision||0,operation:voiding?'void':'save',entry:voiding?null:{consumedOn:entryDay,time:time||null,quantity:{amount:Number(amount),unit:'ml'}},reason:editing?reason:null};
  try{await resource.run(repo=>repo.save(command),true);reset();setMessage('Declaração guardada.');resource.refresh();}
  catch(e){if(staleNutrition(e))return;if(e instanceof NutritionPersistenceError&&e.kind==='uncertain'){setUncertain(command);setAbandoned(false);}setMessage(nutritionError(e));}
 }
 async function check(){if(!uncertain)return;try{const receipt=await resource.run(repo=>repo.requestStatus(uncertain.requestId));if(!receipt){setMessage('Ainda sem recibo; não repitas a operação.');return;}setUncertain(null);setAbandoned(false);reset();resource.refresh();}catch(e){if(!staleNutrition(e))setMessage(nutritionError(e));}}
 async function more(){if(!next)return;try{const r=await resource.run(repo=>repo.diary(day,next));setExtra(old=>[...old,...r.entries]);setCursor(r.nextCursor);setCursorSet(true);}catch(e){if(!staleNutrition(e))setMessage(nutritionError(e));}}
 async function versions(row?:PersistedWater){const target=row?.waterId||historyId;try{const r=await resource.run(repo=>repo.history(target,row?null:historyCursor));setHistory(old=>row?r.versions:[...old,...r.versions]);setHistoryId(target);setHistoryCursor(r.nextCursor);}catch(e){if(!staleNutrition(e))setMessage(nutritionError(e));}}
 return <section className="panel" aria-label="Água persistente" aria-busy={resource.loading||resource.busy}>
  <h2>Água declarada</h2><p>Eventos em ml, sem meta automática. Hora desconhecida não é convertida em meia-noite.</p>
  <label>Dia do diário de água<input type="date" max={businessToday()} value={day} disabled={resource.busy||!!uncertain} onChange={e=>{if(leave()){reset();setDay(e.target.value);setEntryDay(e.target.value);}}}/></label>
  <button className="outline" disabled={resource.busy} onClick={resource.refresh}>Atualizar água</button><p role="status">{resource.loading?'A carregar água…':resource.message||message}</p>
  {uncertain&&<NutritionUncertain requestId={uncertain.requestId} busy={resource.busy} abandoned={abandoned} onCheck={()=>void check()} onAbandon={()=>setAbandoned(true)}/>}
  {resource.ready&&<><p>Total na consulta inicial: <strong>{resource.data!.summary.declaredMl===null?'Sem declarações ativas':`${resource.data!.summary.declaredMl} ml`}</strong>. {next?'A listagem tem mais páginas; o total foi calculado no servidor.':''}</p>
   <div className="tablewrap"><table><thead><tr><th>Hora</th><th>Quantidade</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{rows.map(row=><tr key={row.waterId}><td>{row.entry.time||'Hora desconhecida'}</td><td>{row.entry.quantity.amount} ml · versão {row.revision}</td><td>{row.status==='voided'?'Anulado':'Declarado'}</td><td><button className="outline" disabled={resource.busy} onClick={()=>void versions(row)}>Histórico da água</button>{resource.canWrite&&row.status==='recorded'&&<><button className="outline" disabled={resource.busy||!!uncertain} onClick={()=>edit(row)}>Corrigir água</button><button className="outline" disabled={resource.busy||!!uncertain} onClick={()=>edit(row,true)}>Anular água</button></>}</td></tr>)}</tbody></table></div>
   {!rows.length&&<p>Sem declarações nesta página. Isto não significa consumo zero.</p>}{next&&<button disabled={resource.busy} onClick={()=>void more()}>Carregar mais água</button>}
   {history.length>0&&<details open><summary>Histórico da declaração até à versão {history[0].revision}</summary><ul>{history.map(v=><li key={v.revision}>Versão {v.revision}: {v.entry.consumedOn} · {v.entry.quantity.amount} ml · {v.status==='voided'?'Anulado':'Declarado'}{v.reason&&` · ${v.reason}`}</li>)}</ul>{historyCursor&&<button disabled={resource.busy} onClick={()=>void versions()}>Versões anteriores de água</button>}</details>}
   {resource.canWrite&&!uncertain&&<form onSubmit={save}><h3>{voiding?'Anular declaração':editing?'Corrigir declaração':'Nova declaração de água'}</h3><fieldset disabled={resource.busy}>
    {!voiding&&<><label>Dia da declaração<input type="date" required max={businessToday()} value={entryDay} onChange={e=>{setEntryDay(e.target.value);setDirty(true);}}/></label><label>Hora da declaração (opcional)<input type="time" value={time} onChange={e=>{setTime(e.target.value);setDirty(true);}}/></label><label>Quantidade de água (ml)<input type="number" required min="1" max="5000" step="1" value={amount} onChange={e=>{setAmount(e.target.value);setDirty(true);}}/></label></>}
    {editing&&<label>Motivo da alteração de água<input required minLength={3} maxLength={300} value={reason} onChange={e=>{setReason(e.target.value);setDirty(true);}}/></label>}
    <button>{voiding?'Confirmar anulação de água':'Guardar água'}</button><button type="button" className="outline" onClick={()=>{if(leave())reset();}}>Descartar rascunho de água</button>
   </fieldset></form>}
  </>}
 </section>;
}
