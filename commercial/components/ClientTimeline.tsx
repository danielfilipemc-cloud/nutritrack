"use client";
import {useEffect,useRef,useState} from 'react';
import {db} from '../lib/supabase';
import {RequestScope} from '../lib/request-scope';
import {businessToday} from '../lib/care';
import {evolutionStart} from '../lib/evolution';
import {objectiveTimestamp} from '../lib/objectives';
import {measurementFields} from '../lib/measurement-contract';
import {profileSectionUrl} from '../lib/daily';
import {timelineLabels,timelineTitle,timelineState,appendTimeline,type TimelineEvent,type TimelinePage,type TimelineCursor} from '../lib/timeline';
export default function ClientTimeline({org,clientId,userId,period,onPeriodChange}:{org:string;clientId:string;userId:string;period?:number;onPeriodChange?:(days:number)=>void}){
 const scope=useRef(new RequestScope()),access=useRef<string|null>(null);const [localDays,setDays]=useState(90),[kind,setKind]=useState<keyof typeof timelineLabels>('all'),[reload,setReload]=useState(0);const days=period??localDays;
 const [items,setItems]=useState<TimelineEvent[]>([]),[next,setNext]=useState<TimelineCursor|null>(null),[more,setMore]=useState(false),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const today=businessToday();
 async function load(cursor:TimelineCursor|null){
  const valid=scope.current.begin();setLoading(true);setError('');
  if(!cursor){setItems([]);setMore(false);setNext(null);setTotal(0);access.current=null;}
  try{if(!db)throw Error();const [r,permissions]=await Promise.all([db.rpc('aura_client_timeline',{p_org:org,p_client:clientId,p_from:evolutionStart(today,days),p_to:today,p_kind:kind,p_before:cursor?.before||null,p_key:cursor?.key||null}),db.rpc('aura_client_permissions',{p_org:org,p_client:clientId})]);if(!valid())return;
   const current=JSON.stringify(['assessments_read','followup_read','schedule_read'].map(key=>permissions.data?.[key]===true));
   if(permissions.error||!permissions.data||(cursor&&access.current!==current)||r.status===401||r.status===403||r.error?.code==='42501'){setItems([]);setTotal(0);setMore(false);setNext(null);access.current=null;setError('Os acessos mudaram ou não puderam ser confirmados. Atualiza a cronologia.');return;}
   if(r.error||!r.data)throw Error();access.current=current;const page=r.data as TimelinePage;setItems(previous=>cursor?appendTimeline(previous,page.items):page.items);setTotal(page.total);setNext(page.next);setMore(page.more);
  }catch{if(valid())setError('Não foi possível carregar a cronologia.');}finally{if(valid())setLoading(false);}
 }
 useEffect(()=>{void load(null);return()=>scope.current.invalidate();},[org,clientId,userId,days,kind,reload,today]);
 return <section className="panel" aria-label="Cronologia integrada do aluno" aria-busy={loading}>
  <div className="aura-section-title"><h2>Cronologia integrada</h2><button className="outline" disabled={loading} onClick={()=>setReload(n=>n+1)}>Atualizar cronologia</button></div>
  <p className="aura-caption">Avaliações, acompanhamento, objetivos e marcações autorizados. Uma sessão agendada não é uma sessão realizada.</p>
  <div className="columns"><label>Período da cronologia<select value={days} onChange={e=>(onPeriodChange||setDays)(Number(e.target.value))}><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>365 dias</option><option value={0}>Todo o histórico</option></select></label><label>Tipo de registo<select value={kind} onChange={e=>setKind(e.target.value as keyof typeof timelineLabels)}>{Object.entries(timelineLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
  {error&&<p role="alert">{error} {items.length>0?'Os registos anteriores continuam visíveis; a lista está incompleta.':''}</p>}
  {loading&&<p role="status">A carregar cronologia...</p>}
  {!loading&&!error&&!items.length&&<div className="aura-empty-state"><strong>Sem registos neste período</strong><p>Seleciona outro período ou tipo de registo.</p></div>}
  {items.length>0&&<><p>{items.length} de {total} registos autorizados carregados. {more?'Existem mais registos.':'Fim dos registos deste filtro.'}</p><div className="aura-timeline-viewport" role="region" aria-label="Registos da cronologia; desloca para consultar todo o histórico carregado" tabIndex={0}><ol className="aura-timeline">{items.map(event=><li key={event.event_key}>
   <span className="eyebrow">{timelineLabels[event.kind]}</span><h3>{timelineTitle(event)}</h3><p><time dateTime={event.kind==='assessment'?event.occurred_on:event.occurred_at}>{event.kind==='assessment'?event.occurred_on:objectiveTimestamp(event.occurred_at)}</time>{timelineState(event)?` · ${timelineState(event)}`:''}</p>
   {event.kind==='assessment'&&<><dl className="aura-measurement-values">{Object.entries(measurementFields).map(([key,definition])=>{const value=event.details[key];return typeof value==='number'&&Number.isFinite(value)?<div key={key}><dt>{definition.label}</dt><dd>{value} {definition.unit}</dd></div>:null;})}</dl><p>Origem: {event.details.source==='nutritrack'?'NutriTrack':'AURA'} · avaliação {event.record_id.slice(0,8)}. Data da medição; versões substituídas não entram na evolução.</p></>}
   {event.kind==='objective'&&<p>Objetivo #{event.record_id.slice(0,8)} · versão {String(event.details.revision||'—')}. O histórico não copia o texto anterior.</p>}
   <a href={profileSectionUrl(org,clientId,event.kind==='assessment'?'assessments':event.kind==='appointment'?'agenda':event.kind==='objective'?'objectives':'overview')}>Abrir {event.kind==='assessment'?'avaliações':event.kind==='appointment'?'agenda':event.kind==='objective'?'objetivos':'acompanhamento'}</a>
  </li>)}</ol></div></>}
  {more&&items.length<500&&<button className="outline" disabled={loading} onClick={()=>void load(next)}>Carregar mais registos</button>}
  {more&&items.length>=500&&<p>Limite de 500 registos carregados. Escolhe um período menor.</p>}
  <p className="aura-caption">Desloca a lista para consultar os registos carregados. Horários em Europe/Lisbon. Sem interpretação clínica. Medições NutriTrack entram apenas por importação assistida e confirmada; não existe sincronização automática.</p>
 </section>;
}
