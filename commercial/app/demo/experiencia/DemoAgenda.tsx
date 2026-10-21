"use client";
import {useEffect,useRef,useState} from 'react';
import {copyComposer,reviewComposer,type ComposerSnapshot,type AgendaRequest} from './journey';
import {validDate} from '../../../lib/validation';
import {demoDate,type DemoAppointment,type DemoStudent} from './model';
import {appointmentEnd,appointmentKinds,emptyAppointment,inAppointmentRange,shiftDemoDate,sortedAppointments,weekStart,type AppointmentDraft,type RescheduleDraft,type DemoSchedule} from './appointments';

export default function DemoAgenda({students,schedule,onCreate,onReschedule,onCancel,onClearResult,onOpenStudent,request,onRequestReview,onContinueCare}:{students:DemoStudent[];schedule:DemoSchedule;onCreate:(draft:AppointmentDraft)=>void;onReschedule:(id:number,draft:RescheduleDraft)=>void;onCancel:(id:number)=>void;onClearResult:()=>void;onOpenStudent:(id:number)=>void;request:AgendaRequest|null;onRequestReview:(id:number)=>void;onContinueCare:(id:number)=>void}){
 const [day,setDay]=useState(demoDate),[view,setView]=useState<'day'|'week'>('day'),[filter,setFilter]=useState('');
 const [draft,setDraft]=useState<AppointmentDraft>({...emptyAppointment});
 const [editing,setEditing]=useState<number|null>(null),[cancelId,setCancelId]=useState<number|null>(null);
 const [statusFilter,setStatusFilter]=useState('scheduled'),[focusSequence,setFocusSequence]=useState(0);
 const savedCreateDraft=useRef<AppointmentDraft>({...emptyAppointment});
 const cancelTrigger=useRef<HTMLButtonElement|null>(null),keepButton=useRef<HTMLButtonElement>(null),listHeading=useRef<HTMLHeadingElement>(null);
 const form=useRef<HTMLFormElement>(null);
 const createHeading=useRef<HTMLHeadingElement>(null);
 const {result}=schedule;
 const [contextStudent,setContextStudent]=useState<number|null>(null),[reviewStudent,setReviewStudent]=useState<number|null>(null);
 const reviewSlots=useRef<Record<number,ComposerSnapshot>>({}),generalSlot=useRef<ComposerSnapshot|null>(null);
 const previousQuery=useRef<{day:string;view:'day'|'week';filter:string;statusFilter:string}|null>(null);
 const snapshot=():ComposerSnapshot=>copyComposer({draft,editing,savedCreateDraft:savedCreateDraft.current});
 const restoreComposer=(next:ComposerSnapshot)=>{setDraft({...next.draft});setEditing(next.editing);savedCreateDraft.current={...next.savedCreateDraft};};
 const resumeAgenda=()=>{
  if(reviewStudent!==null){reviewSlots.current[reviewStudent]=snapshot();if(generalSlot.current)restoreComposer(generalSlot.current);setReviewStudent(null);generalSlot.current=null;}
  if(previousQuery.current){const q=previousQuery.current;setDay(q.day);setView(q.view);setFilter(q.filter);setStatusFilter(q.statusFilter);previousQuery.current=null;}
  setContextStudent(null);setCancelId(null);onClearResult();listHeading.current?.focus({preventScroll:true});listHeading.current?.scrollIntoView({block:'start',behavior:'instant'});
 };

 const pendingCancel=schedule.appointments.find(a=>a.id===cancelId&&a.status==='scheduled');
 useEffect(()=>{if(focusSequence){createHeading.current?.focus({preventScroll:true});createHeading.current?.scrollIntoView({block:'start',behavior:'instant'});}},[focusSequence]);
 useEffect(()=>{if(cancelId!==null)keepButton.current?.focus();},[cancelId]);
 const openForm=(appointment?:DemoAppointment)=>{
  onClearResult();setCancelId(null);
  if(appointment){if(editing===null)savedCreateDraft.current={...draft};setEditing(appointment.id);setDraft({...appointment,studentId:String(appointment.studentId),duration:String(appointment.duration)});}
  else {if(editing!==null)setDraft({...savedCreateDraft.current});setEditing(null);}
  setFocusSequence(n=>n+1);
 };
 const keepAppointment=()=>{setCancelId(null);const target=cancelTrigger.current;if(target?.isConnected&&target.getClientRects().length)target.focus();else{listHeading.current?.focus({preventScroll:true});listHeading.current?.scrollIntoView({block:'start',behavior:'instant'});}};
 useEffect(()=>{
  if(!result)return;
  if(result.ok&&result.created){setDay(result.created.date);setFilter(reviewStudent===null?'':String(reviewStudent));setStatusFilter('scheduled');setDraft(v=>({...v,time:''}));}
  else if(result.ok&&result.operation==='reschedule'&&result.updated){setDay(result.updated.date);setFilter(reviewStudent===null?'':String(reviewStudent));setStatusFilter('scheduled');}
  else if(result.ok&&result.operation==='cancel'){setCancelId(null);if(editing===result.updated?.id){setEditing(null);setDraft({...savedCreateDraft.current});}listHeading.current?.focus({preventScroll:true});listHeading.current?.scrollIntoView({block:'start',behavior:'instant'});}
  else if(result.field)form.current?.querySelector<HTMLElement>(`[name="${result.field}"]`)?.focus();
 },[schedule.sequence,result]);
 useEffect(()=>{
  if(!request)return;
  if(!previousQuery.current)previousQuery.current={day,view,filter,statusFilter};
  setContextStudent(request.studentId);setDay(request.date);setView('day');setFilter(String(request.studentId));setStatusFilter('scheduled');setCancelId(null);onClearResult();
  if(request.mode==='review'){
   if(reviewStudent===null)generalSlot.current=snapshot();else reviewSlots.current[reviewStudent]=snapshot();
   const next=reviewSlots.current[request.studentId]||reviewComposer(request.studentId,request.date);
   restoreComposer(next);setReviewStudent(request.studentId);setFocusSequence(n=>n+1);
  }else{
   if(reviewStudent!==null){reviewSlots.current[reviewStudent]=snapshot();if(generalSlot.current)restoreComposer(generalSlot.current);setReviewStudent(null);generalSlot.current=null;}
   listHeading.current?.focus({preventScroll:true});listHeading.current?.scrollIntoView({block:'start',behavior:'instant'});
  }
 },[request?.sequence]);
 const validDay=validDate(day)&&day>='2000-01-01'&&day<='2100-12-31';
 const rows=sortedAppointments(schedule.appointments).filter(a=>validDay&&inAppointmentRange(a.date,day,view)&&(!filter||a.studentId===Number(filter))&&(statusFilter==='all'||a.status===statusFilter));
 const patch=(key:keyof AppointmentDraft,value:string)=>{setDraft(v=>({...v,[key]:value}));onClearResult();};
 const errorProps=(field:keyof AppointmentDraft)=>({'aria-invalid':!result?.ok&&result?.field===field||undefined,'aria-describedby':!result?.ok&&result?.field===field?'demo-booking-hint demo-booking-error':'demo-booking-hint'});
 const start=view==='day'||!validDay?day:weekStart(day),end=view==='day'||!validDay?day:shiftDemoDate(start,6);
 const move=(direction:number)=>{const next=shiftDemoDate(day,direction*(view==='day'?1:7));if(next>='2000-01-01'&&next<='2100-12-31')setDay(next);};
 return <>
  <div className="aura-preview-heading"><span className="aura-preview-overline">ORGANIZAÇÃO DIÁRIA</span><h1>Agenda de exemplo</h1><p>Experimenta organizar marcações fictícias. Data de referência: <time dateTime={demoDate}>{demoDate}</time>.</p><button type="button" className="quiet aura-preview-agenda-link" onClick={()=>openForm()}>Nova marcação de exemplo →</button></div>
  {contextStudent!==null&&<section className="aura-preview-panel aura-preview-agenda-context" aria-label="Contexto da agenda"><p>A partir da ficha de <strong>{students.find(s=>s.id===contextStudent)?.name}</strong></p><div className="aura-preview-agenda-actions"><button type="button" className="quiet aura-preview-agenda-link" onClick={()=>onRequestReview(contextStudent)}>Agendar revisão deste aluno →</button><button type="button" className="quiet aura-preview-agenda-link" onClick={()=>onOpenStudent(contextStudent)}>Voltar à agenda do aluno</button><button type="button" className="quiet aura-preview-agenda-link" onClick={resumeAgenda}>Retomar agenda e rascunho anteriores</button></div></section>}
  <section className="aura-preview-panel" aria-labelledby="demo-agenda-title">
   <h2 id="demo-agenda-title" ref={listHeading} tabIndex={-1}>Consultar marcações fictícias</h2>
   <div className="aura-preview-agenda-toolbar">
    <label>Vista da agenda<select value={view} onChange={e=>setView(e.target.value as 'day'|'week')}><option value="day">Dia</option><option value="week">Semana</option></select></label>
    <label>Data da consulta<input type="date" min="2000-01-01" max="2100-12-31" required value={day} aria-invalid={!validDay||undefined} aria-describedby={!validDay?'demo-agenda-date-error':undefined} onChange={e=>setDay(e.target.value)}/></label>
    <label>Filtrar por aluno<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todos os alunos</option>{students.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
    <label>Estado da marcação<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="scheduled">Ativas</option><option value="cancelled">Canceladas</option><option value="all">Todas</option></select></label>
   </div>
   {!validDay&&<p id="demo-agenda-date-error" className="aura-preview-note">Escolhe uma data válida entre 2000-01-01 e 2100-12-31 para consultar a agenda.</p>}
   <div className="aura-preview-agenda-actions"><button type="button" disabled={!validDay||shiftDemoDate(day,-(view==='day'?1:7))<'2000-01-01'} onClick={()=>move(-1)}>Anterior</button><button type="button" onClick={()=>setDay(demoDate)}>Dia de referência</button><button type="button" disabled={!validDay||shiftDemoDate(day,view==='day'?1:7)>'2100-12-31'} onClick={()=>move(1)}>Seguinte</button></div>
   <p className="aura-preview-note" aria-live="polite">{validDay?`${view==='day'?'Dia':'Semana'}: ${start}${start!==end?` a ${end}`:''} · ${rows.length} marcações fictícias`:'Consulta sem data válida'}</p>
   {pendingCancel&&<section className="aura-preview-cancel-confirm" aria-labelledby="demo-cancel-title" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();keepAppointment();}}}>
    <h3 id="demo-cancel-title">Cancelar esta marcação fictícia?</h3><p>{students.find(s=>s.id===pendingCancel.studentId)?.name} · {pendingCancel.date} · {pendingCancel.time}–{appointmentEnd(pendingCancel)}</p><p>O exemplo sai das marcações ativas e mantém-se no histórico local. Nada é enviado.</p>
    <div className="aura-preview-agenda-actions"><button type="button" ref={keepButton} onClick={keepAppointment}>Manter marcação</button><button type="button" onClick={()=>onCancel(pendingCancel.id)}>Confirmar cancelamento fictício</button></div>
   </section>}
   {result?.operation==='cancel'&&<p role={result.ok?'status':'alert'} className="aura-preview-message">{result.text}</p>}
   {rows.length?<ul className="aura-preview-bookings">{rows.map(a=><li key={a.id}><div><time dateTime={`${a.date}T${a.time}`}>{a.date} · {a.time}–{appointmentEnd(a)}</time><strong>{a.kind}</strong><span>{students.find(s=>s.id===a.studentId)?.name} · {a.duration} min</span><small>Profissional de exemplo · {a.status==='cancelled'?'Cancelado':'Agendado'} · Apenas nesta sessão</small></div><div className="aura-preview-booking-actions"><button type="button" className="quiet aura-preview-agenda-link" onClick={()=>onOpenStudent(a.studentId)}>Abrir ficha de {students.find(s=>s.id===a.studentId)?.name}</button>{a.status==='scheduled'&&<><button type="button" disabled={reviewStudent!==null&&a.studentId!==reviewStudent} aria-label={`Reagendar marcação de ${students.find(s=>s.id===a.studentId)?.name} em ${a.date} às ${a.time}`} onClick={()=>openForm(a)}>Reagendar</button><button type="button" aria-label={`Cancelar marcação de ${students.find(s=>s.id===a.studentId)?.name} em ${a.date} às ${a.time}`} onClick={e=>{cancelTrigger.current=e.currentTarget;onClearResult();setCancelId(a.id);}}>Cancelar</button></>}</div></li>)}</ul>:<p>Sem marcações de exemplo neste período e filtro.</p>}
  </section>
  <section className="aura-preview-panel"><h2 ref={createHeading} tabIndex={-1}>{editing===null?'Criar marcação fictícia':'Reagendar marcação fictícia'}</h2>{reviewStudent!==null&&<p className="aura-preview-note">Revisão de <strong>{students.find(s=>s.id===reviewStudent)?.name}</strong>. O rascunho da agenda anterior fica preservado ao retomar. Para reagendar outro aluno, retoma primeiro a agenda anterior.</p>}{editing!==null&&<p className="aura-preview-note">Aluno e tipo preservados. Altera apenas data, hora e duração. <button type="button" className="quiet aura-preview-agenda-link" onClick={()=>openForm()}>Voltar à criação</button></p>}
   <p id="demo-booking-hint" className="aura-preview-note">Um único calendário de profissional de exemplo, das 00:00 às 24:00. Horários sobrepostos não são permitidos. Usa apenas dados fictícios; nada é enviado ou guardado fora desta sessão.</p>
   <form ref={form} className="aura-preview-form" aria-describedby="demo-booking-hint" onSubmit={e=>{e.preventDefault();if(editing===null)onCreate({...draft});else onReschedule(editing,{date:draft.date,time:draft.time,duration:draft.duration});}}>
    <label>Aluno da marcação<select disabled={editing!==null||reviewStudent!==null} name="studentId" value={draft.studentId} onChange={e=>patch('studentId',e.target.value)} {...errorProps('studentId')}>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>Tipo de marcação<select disabled={editing!==null||reviewStudent!==null} name="kind" value={draft.kind} onChange={e=>patch('kind',e.target.value)} {...errorProps('kind')}>{appointmentKinds.map(kind=><option key={kind}>{kind}</option>)}</select></label>
    <label>Data da marcação<input name="date" type="date" required min="2000-01-01" max="2100-12-31" value={draft.date} onChange={e=>patch('date',e.target.value)} {...errorProps('date')}/></label>
    <label>Hora da marcação<input name="time" type="time" required value={draft.time} onChange={e=>patch('time',e.target.value)} {...errorProps('time')}/></label>
    <label>Duração da marcação<select name="duration" value={draft.duration} onChange={e=>patch('duration',e.target.value)} {...errorProps('duration')}>{[15,30,45,60,90,120].map(minutes=><option key={minutes} value={minutes}>{minutes} minutos</option>)}</select></label>
    <button type="submit">{editing===null?'Criar marcação fictícia':'Guardar reagendamento fictício'}</button>
   </form>
   {result?.ok&&result.created&&<button type="button" className="quiet aura-preview-agenda-link" onClick={()=>onContinueCare(result.created!.studentId)}>Continuar no acompanhamento do aluno →</button>}
   {result&&result.operation!=='cancel'&&<p id={result.ok?undefined:'demo-booking-error'} role={result.ok?'status':'alert'} className="aura-preview-message">{result.text}</p>}
  </section>
 </>;
}
