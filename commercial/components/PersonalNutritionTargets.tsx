'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '../lib/supabase';
import {createStudentNutritionPersistence} from '../lib/nutrition-student-persistence';
import {createPersonalTargetPersistence,type PersonalTargetCommand,type PersonalTargetState} from '../lib/nutrition-personal-targets';
import {NutritionPersistenceError} from '../lib/nutrition-persistence';
import {businessToday} from '../lib/care';
import {nutrientKeys,type PortionV1} from '../lib/nutrition-contract';
import {targetBalance,type ManualTargetsV1} from '../lib/nutrition-planning';
import NutritionUncertain from './NutritionUncertain';
const labels={calories:'Energia',protein:'Proteína',carbs:'Hidratos',fat:'Gordura'};
const fresh=()=>({values:{calories:'',protein:'',carbs:'',fat:''},reason:'',base:0,dirty:false});
type Draft=ReturnType<typeof fresh>;
const format=(n:number)=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:2}).format(n);
export default function PersonalNutritionTargets({org,clientId,userId,day,portions,complete,disabled,onDirtyChange}:{org:string;clientId:string;userId:string;day:string;portions:PortionV1[];complete:boolean;disabled:boolean;onDirtyChange:(dirty:boolean,pending:boolean)=>void}){
 const [draft,setDraft]=useState(fresh),draftRef=useRef(draft),[current,setCurrent]=useState<PersonalTargetState|null>(null),[canWrite,setCanWrite]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState('');
 const [conflict,setConflict]=useState(false),[ack,setAck]=useState(false),[uncertain,setUncertain]=useState<PersonalTargetCommand|null>(null),[abandoned,setAbandoned]=useState(false);
 const [history,setHistory]=useState<{revision:number;reason:string}[]>([]),[cursor,setCursor]=useState<number|null>(null);
 const repo=useRef<ReturnType<typeof createPersonalTargetPersistence>|null>(null),permission=useRef<ReturnType<typeof createStudentNutritionPersistence>|null>(null),epoch=useRef(0),pending=useRef(false),notify=useRef(onDirtyChange);notify.current=onDirtyChange;
 function update(next:Draft){draftRef.current=next;setDraft(next);}
 useEffect(()=>{notify.current(draft.dirty||!!uncertain,busy||!!uncertain&&!abandoned);},[draft.dirty,busy,uncertain,abandoned]);useEffect(()=>()=>notify.current(false,false),[]);
 const error=(e:unknown)=>e instanceof NutritionPersistenceError?e.message:'Revê os valores e tenta novamente.';
 async function load(){const adapter=repo.current,access=permission.current;if(!adapter||!access)return;const version=++epoch.current;setLoading(true);setReady(false);setCanWrite(false);setCurrent(null);setAck(false);
  try{const [data,context]=await Promise.all([adapter.read(day),access.context()]);if(version!==epoch.current)return;setCurrent(data);setCanWrite(context.canWrite);setReady(true);
   if(!draftRef.current.dirty)update({values:Object.fromEntries(nutrientKeys.map(k=>[k,data.targets?.nutrients[k]===null||!data.targets?'':String(data.targets.nutrients[k])])) as Draft['values'],reason:'',base:data.revision,dirty:false});
   else setConflict(old=>old||data.revision!==draftRef.current.base);
  }catch(e){if(version===epoch.current)setMessage(error(e));}finally{if(version===epoch.current)setLoading(false);}
 }
 useEffect(()=>{if(!db)return;repo.current=createPersonalTargetPersistence(db,{organizationId:org,clientId});permission.current=createStudentNutritionPersistence(db,{organizationId:org,clientId},businessToday);update(fresh());setConflict(false);setUncertain(null);setHistory([]);setCursor(null);void load();
  const focus=()=>{if(!pending.current)void load();};window.addEventListener('focus',focus);
  return()=>{epoch.current++;repo.current?.dispose();permission.current?.dispose();repo.current=null;permission.current=null;window.removeEventListener('focus',focus);};
 },[org,clientId,userId,day]);
 async function save(){const adapter=repo.current;if(!adapter||pending.current||disabled||!ready||!canWrite||uncertain||conflict&&!ack)return;
  const command:PersonalTargetCommand={contractVersion:1,requestId:crypto.randomUUID(),expectedRevision:conflict?current!.revision:draft.base,targetDate:day,reason:draft.reason,targets:{contractVersion:1,source:'manual',nutrients:Object.fromEntries(nutrientKeys.map(k=>[k,draft.values[k].trim()===''?null:Number(draft.values[k])])) as ManualTargetsV1['nutrients']}};
  pending.current=true;setBusy(true);setMessage('');const version=epoch.current;
  try{await adapter.save(command);if(version!==epoch.current)return;update({...draftRef.current,dirty:false,reason:''});setConflict(false);await load();setMessage('Referências guardadas para este dia.');}
  catch(e){if(version!==epoch.current)return;if(e instanceof NutritionPersistenceError){if(e.kind==='uncertain'){setUncertain(command);setAbandoned(false);}if(e.kind==='conflict'){setConflict(true);setAck(false);await load();}if(e.kind==='denied'){setCurrent(null);setReady(false);setCanWrite(false);}}setMessage(error(e));}
  finally{pending.current=false;setBusy(false);}
 }
 async function check(){const adapter=repo.current;if(!adapter||!uncertain||pending.current||disabled)return;pending.current=true;setBusy(true);const version=epoch.current;try{const receipt=await adapter.requestStatus(uncertain.requestId);if(version!==epoch.current)return;if(!receipt||receipt.targetDate!==uncertain.targetDate||receipt.revision!==uncertain.expectedRevision+1){setMessage('Ainda sem recibo correspondente. Não repitas a gravação.');return;}setUncertain(null);setAbandoned(false);update({...draftRef.current,dirty:false,reason:''});setConflict(false);await load();}catch(e){if(version===epoch.current)setMessage(error(e));}finally{pending.current=false;setBusy(false);}}
 async function showHistory(more=false){const adapter=repo.current;if(!adapter||pending.current||disabled||!ready)return;pending.current=true;setBusy(true);const version=epoch.current;try{const result=await adapter.history(day,more?cursor:null);if(version!==epoch.current)return;setHistory(old=>more?[...old,...result.versions]:result.versions);setCursor(result.nextCursor);}catch(e){if(version===epoch.current){setHistory([]);setCursor(null);if(e instanceof NutritionPersistenceError&&e.kind==='denied'){setReady(false);setCurrent(null);setCanWrite(false);}setMessage(error(e));}}finally{pending.current=false;setBusy(false);}}
 let balance:ReturnType<typeof targetBalance>|null=null;try{if(current?.targets)balance=targetBalance(portions,current.targets,complete);}catch{/* Incomplete/unbounded input cannot become a daily total. */}
 return <section className="panel aura-nutrition-tools aura-personal-targets" aria-label="Referências privadas do dia" aria-busy={busy||loading}>
  <h3>As tuas referências do dia</h3><p>Valores individuais introduzidos manualmente. Guardar referências não regista refeições nem fornece uma prescrição.</p>
  <p role="status">{message}</p><button type="button" className="outline" disabled={busy||loading||disabled||!!uncertain} onClick={()=>void load()}>Atualizar referências</button>
  {uncertain&&<NutritionUncertain requestId={uncertain.requestId} busy={busy||disabled} abandoned={abandoned} onCheck={()=>void check()} onAbandon={()=>setAbandoned(true)}/>}
  {!ready?<p>{loading?'A carregar referências…':'Referências indisponíveis. Os rascunhos não foram substituídos por exemplos.'}</p>:<><p>{current?.revision?`Guardado · versão ${current.revision}`:'Sem referências guardadas neste dia.'}</p>
   <div className="aura-nutrition-tools-metrics" role="group" aria-label="Balanço pelas referências guardadas">{nutrientKeys.map(k=><article key={k}><span>{labels[k]}</span><strong>{balance?.[k]===null||!balance?'—':format(balance[k]!)}</strong><small>Referência: {current?.targets?.nutrients[k]===null||!current?.targets?'—':format(current.targets.nutrients[k]!)} {k==='calories'?'kcal':'g'}</small><small>{balance?.[k]===null||!balance?'Sem balanço completo':`${balance[k]!<0?'Acima da referência':'Falta registar'} ${k==='calories'?'kcal':'g'}`}</small></article>)}</div><p>Compara apenas a versão guardada com os registos carregados numa única leitura. Alterar o rascunho não altera este balanço.</p>
   {canWrite&&!uncertain?<details open={draft.dirty||conflict}><summary>Editar referências deste dia</summary><form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||disabled}><legend>Referências individuais · {day}</legend><div className="aura-nutrition-tools-grid">{nutrientKeys.map(k=><label key={k}>Referência de {labels[k].toLocaleLowerCase('pt')} ({k==='calories'?'kcal':'g'})<input type="number" min="0.001" max={k==='calories'?10000:k==='carbs'?2000:1000} step="0.001" value={draft.values[k]} onChange={e=>update({...draftRef.current,values:{...draftRef.current.values,[k]:e.target.value},dirty:true})}/></label>)}</div><p>Vazio significa desconhecido. Não copies automaticamente as metas de outra pessoa; adapta-as ao teu acompanhamento.</p>
    <label>Motivo da referência<input required minLength={3} maxLength={300} value={draft.reason} onChange={e=>update({...draftRef.current,reason:e.target.value,dirty:true})}/></label>
    {conflict&&<div role="alert"><p>A referência mudou. O teu rascunho foi preservado. Versão atual: {current?.revision}. Valores guardados: {nutrientKeys.map(k=>`${labels[k]} ${current?.targets?.nutrients[k]??'—'}`).join(' · ')}.</p><label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>Revi os valores guardados e quero aplicar o meu rascunho à versão {current?.revision}.</label></div>}
    <button disabled={!draft.dirty||conflict&&!ack}>Guardar referências</button><button type="button" className="outline" onClick={()=>{if(!draftRef.current.dirty||window.confirm('Descartar o rascunho e carregar as referências guardadas?')){update(fresh());setConflict(false);void load();}}}>Descartar referências em rascunho</button>
   </fieldset></form></details>:<p>Sem edição disponível neste contexto.</p>}
   <button type="button" className="outline" disabled={busy||disabled} onClick={()=>void showHistory()}>Histórico das referências</button>{history.length>0&&<ul>{history.map(v=><li key={v.revision}>Versão {v.revision} · {v.reason}</li>)}</ul>}{cursor&&<button type="button" disabled={busy||disabled} onClick={()=>void showHistory(true)}>Mais versões das referências</button>}
  </>}
 </section>;
}
