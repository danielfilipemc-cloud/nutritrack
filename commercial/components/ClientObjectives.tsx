"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {db} from '../lib/supabase';
import {RequestScope} from '../lib/request-scope';
import {businessToday,careError} from '../lib/care';
import {objectiveDraft,objectiveDeadline,objectiveTimestamp,objectiveStates,type Objective} from '../lib/objectives';
type GoalEvent={id:string;objective_id:string;action:string;revision:number;from_state:string|null;to_state:string;created_at:string};
const actionLabels:Record<string,string>={created:'Objetivo criado',updated:'Objetivo atualizado',completed:'Objetivo concluído',cancelled:'Objetivo cancelado',reopened:'Objetivo reaberto'};
export default function ClientObjectives({org,userId,clientId,archived,writable,onDirtyChange}:{org:string;userId:string;clientId:string;archived:boolean;writable:boolean;onDirtyChange?:(dirty:boolean,pending?:boolean)=>void}){
 const reads=useRef(new RequestScope()),writes=useRef(new RequestScope()),historyReads=useRef(new RequestScope()),writing=useRef(false);
 const [goals,setGoals]=useState<Objective[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(0),[filter,setFilter]=useState('active'),[reload,setReload]=useState(0);
 const [loading,setLoading]=useState(true),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[loadError,setLoadError]=useState(''),[message,setMessage]=useState(''),[conflict,setConflict]=useState(false),[uncertain,setUncertain]=useState(false);
 const [editing,setEditing]=useState<Objective|null>(null),[title,setTitle]=useState(''),[due,setDue]=useState('');
 const [events,setEvents]=useState<GoalEvent[]>([]),[historyPage,setHistoryPage]=useState(0),[historyLoading,setHistoryLoading]=useState(true),[historyError,setHistoryError]=useState('');
 const dirty=title!==(editing?.title||'')||due!==(editing?.due_on||'');
 useEffect(()=>{onDirtyChange?.(dirty||busy,busy);const leave=(e:BeforeUnloadEvent)=>{if(dirty||busy){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',leave);return()=>{onDirtyChange?.(false);window.removeEventListener('beforeunload',leave);};},[dirty,busy,onDirtyChange]);
 useEffect(()=>()=>{reads.current.invalidate();writes.current.invalidate();historyReads.current.invalidate();},[]);
 useEffect(()=>{
  if(!db)return;const valid=reads.current.begin();setReady(false);setLoading(true);setLoadError('');setGoals([]);
  let query=db.from('client_objectives').select('id,organization_id,client_id,title,state,due_on,completed_at,revision,created_at,updated_at',{count:'exact'}).eq('organization_id',org).eq('client_id',clientId);
  if(filter!=='all')query=query.eq('state',filter);
  void(async()=>{try{const r=await query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*25,page*25+24);if(!valid())return;if(r.error)throw r.error;setGoals(r.data||[]);setTotal(r.count||0);setReady(true);}catch{if(valid())setLoadError('Não foi possível carregar os objetivos.');}finally{if(valid())setLoading(false);}})();
  return()=>reads.current.invalidate();
 },[org,userId,clientId,page,filter,reload]);
 useEffect(()=>{
  if(!db)return;const valid=historyReads.current.begin();setHistoryLoading(true);setHistoryError('');setEvents([]);
  void(async()=>{try{const r=await db!.rpc('aura_objective_history',{p_org:org,p_client:clientId,p_offset:historyPage*25});if(!valid())return;if(r.error)throw r.error;setEvents(r.data||[]);}catch{if(valid())setHistoryError('Não foi possível carregar o histórico dos objetivos.');}finally{if(valid())setHistoryLoading(false);}})();
  return()=>historyReads.current.invalidate();
 },[org,userId,clientId,historyPage,reload]);
 function discard(){return !dirty||window.confirm('Descartar as alterações locais do objetivo?');}
 function reset(){setEditing(null);setTitle('');setDue('');}
 function refresh(){if(writing.current||!discard())return;reset();setConflict(false);setUncertain(false);setMessage('');setPage(0);setHistoryPage(0);setReload(n=>n+1);}
 async function persist(goal:Objective|null,state:Objective['state'],values:{title:string;due_on:string|null}){
  if(!db||writing.current||!ready||!writable||archived||conflict||uncertain)return;const valid=writes.current.begin();writing.current=true;setBusy(true);setMessage('');
  try{const r=await db.rpc('aura_objective_save',{p_org:org,p_client:clientId,p_id:goal?.id||null,p_title:values.title,p_state:state,p_due:values.due_on,p_revision:goal?.revision||0});if(!valid())return;
   if(r.error){if(r.status===0||r.status>=500){setUncertain(true);setMessage('Não foi possível confirmar a gravação. Atualiza os objetivos antes de repetir.');return;}setMessage(careError(r.error));if(r.error.code==='PT409')setConflict(true);if(r.error.code==='42501'){setGoals([]);setReady(false);}return;}
   reset();if(!goal||state==='active')setFilter('active');setMessage(goal?'Objetivo atualizado.':'Objetivo criado.');setPage(0);setHistoryPage(0);setReload(n=>n+1);
  }catch{if(valid()){setUncertain(true);setMessage('Não foi possível confirmar a gravação. Atualiza os objetivos antes de repetir.');}}finally{writing.current=false;if(valid())setBusy(false);}
 }
 function save(e:FormEvent){e.preventDefault();try{const values=objectiveDraft(title,due);void persist(editing,'active',values);}catch{setMessage('Indica um título e um prazo válido, quando aplicável.');}}
 function changeState(goal:Objective,state:Objective['state']){
  if(!discard())return;
  if(state==='cancelled'&&!window.confirm('Cancelar este objetivo? O registo e o histórico serão preservados.'))return;
  if(state==='active'&&!window.confirm('Reabrir este objetivo? A conclusão ou cancelamento anterior mantém-se no histórico.'))return;
  void persist(goal,state,{title:goal.title,due_on:goal.due_on});
 }
 const disabled=busy||!ready||conflict||uncertain;
 return <section className="panel" aria-label="Objetivos de acompanhamento" aria-busy={loading}>
  <div className="aura-section-title"><h2>Objetivos de acompanhamento</h2><button type="button" className="outline" disabled={busy||loading} onClick={refresh}>Atualizar objetivos</button></div>
  <p>O foco geral mantém-se no plano. Acompanha aqui objetivos concretos, prazos e conclusões. Não introduzas dados clínicos reais nesta demonstração.</p>
  <label>Estado dos objetivos<select value={filter} disabled={disabled||dirty} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="active">Em curso</option><option value="completed">Concluídos</option><option value="cancelled">Cancelados</option><option value="all">Todos</option></select></label>
  {loading?<p role="status">A carregar objetivos...</p>:loadError?<p role="alert">{loadError}</p>:<><p>{total} objetivos neste filtro.</p>{!goals.length?<p>Sem objetivos neste filtro.</p>:<ul className="aura-objectives">{goals.map(goal=><li key={goal.id}><h3>{goal.title}</h3><p>{objectiveStates[goal.state]} · {goal.due_on?`Prazo: ${goal.due_on}`:'Sem prazo'}{objectiveDeadline(goal,businessToday())==='overdue'?' · Em atraso':objectiveDeadline(goal,businessToday())==='today'?' · Prazo hoje':''}{goal.completed_at?` · Concluído em ${objectiveTimestamp(goal.completed_at)}`:''}</p>{writable&&!archived&&<div className="aura-quick-actions">{goal.state==='active'?<><button className="outline" disabled={disabled} aria-label={`Editar objetivo: ${goal.title}`} onClick={()=>{if(discard()){setEditing(goal);setTitle(goal.title);setDue(goal.due_on||'');setMessage('');}}}>Editar</button><button className="outline" disabled={disabled} aria-label={`Concluir objetivo: ${goal.title}`} onClick={()=>changeState(goal,'completed')}>Concluir</button><button className="outline" disabled={disabled} aria-label={`Cancelar objetivo: ${goal.title}`} onClick={()=>changeState(goal,'cancelled')}>Cancelar</button></>:<button className="outline" disabled={disabled} aria-label={`Reabrir objetivo: ${goal.title}`} onClick={()=>changeState(goal,'active')}>Reabrir</button>}</div>}</li>)}</ul>}
  <div className="aura-quick-actions"><button className="outline" disabled={disabled||dirty||page===0} onClick={()=>setPage(n=>n-1)}>Objetivos anteriores</button><span>Página {page+1} de {Math.max(1,Math.ceil(total/25))}</span><button className="outline" disabled={disabled||dirty||(page+1)*25>=total} onClick={()=>setPage(n=>n+1)}>Mais objetivos</button></div></>}
  {archived?<p>Aluno arquivado: objetivos apenas para consulta.</p>:!writable?<p>Permissão de consulta: a alteração exige acompanhamento com escrita.</p>:<form onSubmit={save}><h3>{editing?'Editar objetivo':'Novo objetivo'}</h3><label>Título do objetivo<input required maxLength={160} value={title} disabled={disabled} onChange={e=>setTitle(e.target.value)}/></label><label>Prazo do objetivo (opcional)<input type="date" min="2000-01-01" max="2100-12-31" value={due} disabled={disabled} onChange={e=>setDue(e.target.value)}/></label><div className="aura-quick-actions"><button disabled={disabled}>{editing?'Guardar alterações do objetivo':'Criar objetivo'}</button>{editing&&<button type="button" className="outline" disabled={busy} onClick={()=>{if(discard())reset();}}>Cancelar edição do objetivo</button>}</div></form>}
  {uncertain&&<p role="alert">O pedido pode ter sido guardado. O rascunho foi conservado; atualiza os objetivos e verifica a lista antes de repetir.</p>}{conflict&&<p role="alert">O objetivo foi alterado por outro pedido. O rascunho foi conservado; atualiza os objetivos antes de voltar a guardar.</p>}<p role="status">{message}</p>
  <details><summary>Histórico dos objetivos</summary><p>Ações e estados, sem copiar os textos anteriores.</p>{historyLoading?<p role="status">A carregar histórico dos objetivos...</p>:historyError?<p role="alert">{historyError}</p>:!events.length?<p>Sem eventos nesta página.</p>:<ul>{events.map(event=><li key={event.id}>{actionLabels[event.action]||'Objetivo alterado'} · #{event.objective_id.slice(0,8)} · Versão {event.revision} · {objectiveTimestamp(event.created_at)}</li>)}</ul>}<div className="aura-quick-actions"><button className="outline" disabled={busy||historyLoading||historyPage===0} onClick={()=>setHistoryPage(n=>n-1)}>Histórico anterior dos objetivos</button><button className="outline" disabled={busy||historyLoading||events.length<25} onClick={()=>setHistoryPage(n=>n+1)}>Mais histórico dos objetivos</button></div></details>
 </section>;
}
