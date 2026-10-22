"use client";
import {useEffect,useRef,useState} from 'react';
import {blankCheckin,checkinQuestions,checkinState,type CheckinAnswers,type CheckinPlan} from './checkins';
import {demoDate,type DemoStudent} from './model';
import type {DemoActionPlan} from './actions';
export type CheckinCommands={prepare:(studentId:number,due:string)=>void;submit:(studentId:number,id:number,answers:CheckinAnswers)=>void;review:(studentId:number,id:number)=>void;cancel:(studentId:number,id:number)=>void;action:(studentId:number,id:number)=>void};
const activityLabels={yes:'Sim',partly:'Parcialmente',no:'Não',skip:'Prefiro não responder'};
type View={due:string;selected:number|null;filter:string;feedback:string;error:boolean};
const empty:View={due:demoDate,selected:null,filter:'all',feedback:'',error:false};
export default function DemoCheckins({visible,student,plan,actions,commands,sourceRequest}:{sourceRequest:{id:number;sequence:number}|null;visible:boolean;student:DemoStudent;plan:CheckinPlan;actions:DemoActionPlan;commands:CheckinCommands}){
 const [views,setViews]=useState<Record<number,View>>({}),[drafts,setDrafts]=useState<Record<number,CheckinAnswers>>({});
 const heading=useRef<HTMLHeadingElement>(null),answerInput=useRef<HTMLSelectElement>(null);
 const [focusSequence,setFocusSequence]=useState(0);
 useEffect(()=>{if(focusSequence){heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'instant'});}},[focusSequence]);
 const [focusOrigin,setFocusOrigin]=useState<number|null>(null);
 const originHeadings=useRef<Record<number,HTMLHeadingElement|null>>({});
 const view=views[student.id]||empty;
 const patch=(next:Partial<View>)=>setViews(v=>({...v,[student.id]:{...(v[student.id]||empty),...next}}));
 const execute=(operation:()=>void,text:string)=>{try{operation();patch({feedback:text,error:false,selected:null});setFocusSequence(v=>v+1);}catch(e){patch({feedback:e instanceof Error?e.message:'Não foi possível guardar o exemplo.',error:true});}};
 useEffect(()=>{if(sourceRequest&&plan.items.some(i=>i.id===sourceRequest.id&&i.studentId===student.id)){patch({filter:'all'});setFocusOrigin(sourceRequest.id);}},[sourceRequest?.sequence]);
 useEffect(()=>{if(focusOrigin!==null){originHeadings.current[focusOrigin]?.focus({preventScroll:true});originHeadings.current[focusOrigin]?.scrollIntoView({block:'start',behavior:'instant'});setFocusOrigin(null);}},[focusOrigin]);
 useEffect(()=>{if(visible&&view.selected!==null)answerInput.current?.focus();},[view.selected,student.id,visible]);
 if(!visible)return null;
 const all=plan.items.filter(i=>i.studentId===student.id).slice().reverse();
 const rows=all.filter(i=>view.filter==='all'||view.filter==='review'&&i.status==='submitted'&&!i.reviewedOn||view.filter==='overdue'&&i.status==='prepared'&&i.due<demoDate);
 const selected=all.find(i=>i.id===view.selected&&i.status==='prepared'),draft=selected?(drafts[selected.id]||{...blankCheckin}):blankCheckin;
 const answer=(next:Partial<CheckinAnswers>)=>{if(selected){setDrafts(v=>({...v,[selected.id]:{...draft,...next}}));patch({feedback:''});}};
 return <section className="aura-preview-panel aura-demo-continuity" aria-labelledby="demo-checkins-title">
  <span className="aura-preview-overline">ENTRE SESSÕES</span><h2 ref={heading} tabIndex={-1} id="demo-checkins-title">Check-ins de acompanhamento</h2>
  <p>Exemplos estruturados de {student.name}. As respostas são simuladas e não são notas do profissional. Nada é enviado.</p>
  <details><summary>Consultar perguntas do modelo · versão {checkinQuestions.version}</summary><ul><li>{checkinQuestions.activity}</li><li>{checkinQuestions.difficulty} (opcional)</li><li>{checkinQuestions.topic} (opcional)</li></ul></details>
  <form className="aura-preview-form" onSubmit={e=>{e.preventDefault();execute(()=>commands.prepare(student.id,view.due),'Check-in preparado para simulação. Nenhuma mensagem enviada.');}}>
   <label>Prazo do check-in<input type="date" required min="2000-01-01" max="2100-12-31" value={view.due} onChange={e=>patch({due:e.target.value,feedback:''})}/></label><button type="submit">Preparar check-in fictício</button>
  </form>
  <p className="aura-preview-note">Referência fixa: {demoDate}. Só é possível simular uma resposta num exemplo cujo prazo não seja futuro. Prazo vencido significa apenas ausência de resposta.</p>
  {view.feedback&&<p role={view.error?'alert':'status'} className="aura-preview-message">{view.feedback}</p>}
  <label>Mostrar check-ins<select value={view.filter} onChange={e=>patch({filter:e.target.value})}><option value="all">Todos</option><option value="review">Por rever</option><option value="overdue">Prazo vencido</option></select></label>
  {selected&&<form aria-label="Simular resposta do aluno" className="aura-preview-form" onSubmit={e=>{e.preventDefault();execute(()=>commands.submit(student.id,selected.id,draft),'Resposta fictícia submetida. Aguarda revisão do profissional.');}}>
   <h3 className="aura-preview-full">Simulação de resposta · check-in #{selected.id}</h3>
   <label className="aura-preview-full">{selected.questions.activity}<select ref={answerInput} required value={draft.activity} onChange={e=>answer({activity:e.target.value as CheckinAnswers['activity']})}><option value="">Escolher resposta de exemplo</option>{Object.entries(activityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label className="aura-preview-full">{selected.questions.difficulty}<textarea maxLength={500} value={draft.difficulty} onChange={e=>answer({difficulty:e.target.value})}/></label>
   <label className="aura-preview-full">{selected.questions.topic}<textarea maxLength={500} value={draft.topic} onChange={e=>answer({topic:e.target.value})}/></label>
   <button type="submit">Submeter resposta simulada</button><button type="button" className="quiet" onClick={()=>{patch({selected:null});heading.current?.focus();}}>Fechar simulação e manter rascunho</button>
  </form>}
  {rows.length?<ul className="aura-demo-continuity-list">{rows.map(item=>{const linked=actions.actions.find(a=>a.studentId===student.id&&a.sourceCheckinId===item.id);return <li key={item.id} aria-label={`Check-in #${item.id}`}><h3 tabIndex={-1} ref={el=>{originHeadings.current[item.id]=el;}}>Check-in #{item.id} · {checkinState(item)}</h3><p>Prazo: <time dateTime={item.due}>{item.due}</time> · Modelo v{item.questions.version}</p>
   {item.answers&&<><p className="aura-preview-note">Origem: resposta fictícia do aluno · Submetida em {item.submittedOn}. O exemplo original é preservado.</p><dl><dt>{item.questions.activity}</dt><dd>{activityLabels[item.answers.activity as keyof typeof activityLabels]}</dd><dt>{item.questions.difficulty}</dt><dd>{item.answers.difficulty||'Sem resposta opcional'}</dd><dt>{item.questions.topic}</dt><dd>{item.answers.topic||'Sem resposta opcional'}</dd></dl>{item.reviewedOn&&<p>Revisto em {item.reviewedOn} por {item.reviewer}. Não representa uma avaliação clínica.</p>}</>}
   <div className="aura-demo-continuity-buttons">{item.status==='prepared'&&<><button type="button" disabled={item.due>demoDate} onClick={()=>{patch({selected:item.id,feedback:''});}} aria-label={`Simular resposta ao check-in #${item.id}`}>Simular resposta</button><button type="button" className="quiet" onClick={()=>execute(()=>commands.cancel(student.id,item.id),'Check-in sem resposta cancelado; exemplo mantido no histórico.')} aria-label={`Cancelar check-in #${item.id}`}>Cancelar exemplo sem resposta</button></>}
   {item.status==='submitted'&&!item.reviewedOn&&<button type="button" onClick={()=>execute(()=>commands.review(student.id,item.id),'Resposta fictícia marcada como revista. O conteúdo original foi preservado.')} aria-label={`Marcar check-in #${item.id} como revisto`}>Marcar como revisto</button>}
   {item.reviewedOn&&(linked?<p>Ação ligada: {linked.title} · {linked.status==='done'?'Concluída':'Por concluir'}</p>:<button type="button" className="quiet" onClick={()=>execute(()=>commands.action(student.id,item.id),'Ação interna criada no Plano de ações abaixo. Não altera a resposta ou a agenda.')} aria-label={`Criar ação a partir do check-in #${item.id}`}>Criar ação interna desta resposta</button>)}</div>
  </li>;})}</ul>:<p>{all.length?'Sem check-ins neste filtro. Os restantes exemplos mantêm-se em Todos.':'Ainda não existem check-ins. Prepara o primeiro exemplo para este aluno.'}</p>}
 </section>;
}
