"use client";
import {useRef,useState,useEffect} from 'react';
import StudentIdentity from '../../../components/StudentIdentity';
import ProfileNavigation from '../../../components/ProfileNavigation';
import ProgressChart from '../../../components/ProgressChart';
import DemoActions from './DemoActions';
import DemoNutrition from './DemoNutrition';
import DemoTraining,{type TrainingCommands,type TrainingRequest} from './DemoTraining';
import {activeTraining,type TrainingState} from './training';
import {createNutritionState,studentMeals} from './nutrition';
import DemoCheckins,{type CheckinCommands} from './DemoCheckins';
import DemoSessionPreparation from './DemoSessionPreparation';
import type {CheckinPlan} from './checkins';
import type {DemoActionDraft,DemoActionPlan} from './actions';
import DemoEvolution from './DemoEvolution';
import {nextStudentReview} from './journey';
import ClientProgressSummary from '../../../components/ClientProgressSummary';
import {appointmentEnd,sortedAppointments} from './appointments';
import useDemoNavigationFocus from './use-demo-navigation-focus';
import {DemoCareError,demoResponsible,parseDemoCare} from './followup';
import {demoDate,emptyAssessment,parseDemoAssessment,sortedAssessments,type AssessmentDraft,type DemoCare,type DemoStudent,type DemoAppointment} from './model';

type Section='overview'|'assessments'|'evolution'|'agenda'|'care'|'nutrition'|'training';
export type DemoStudentView={studentId:number;section:Section};
type CareFeedback={error:boolean;text:string;field?:keyof DemoCare};
const sections:ReadonlyArray<readonly [Section,string]>=[['overview','Resumo'],['assessments','Avaliações'],['evolution','Evolução'],['agenda','Agenda do aluno'],['care','Acompanhamento'],['nutrition','Nutrição'],['training','Treino']];
const journeySections=sections.filter(([key])=>key!=='nutrition'&&key!=='training');
const metrics=[['weight','Peso','kg'],['height','Altura','cm'],['waist','Cintura','cm']] as const;
type Metric=typeof metrics[number][0];
type Drafts={assessment:AssessmentDraft;care:DemoCare};
const statusLabels={active:'Em acompanhamento',paused:'Em pausa',completed:'Concluído'};
export default function DemoStudentHub({training,trainingCommands,view,onViewChange,focusRequest,allAppointments,student,students,brand,onChoose,onUpdate,onAgenda,onScheduleReview,onBack,backLabel,studentMetrics,onMetric,availableResponsible,actionPlan,onActionSave,onActionToggle,checkinPlan,checkinCommands}:{training:TrainingState;trainingCommands:TrainingCommands;checkinPlan:CheckinPlan;checkinCommands:CheckinCommands;view:DemoStudentView;onViewChange:(view:DemoStudentView)=>void;focusRequest:number;allAppointments:DemoAppointment[];student:DemoStudent;students:DemoStudent[];brand:string;onChoose:(id:number)=>void;onUpdate:(student:DemoStudent)=>void;onAgenda:()=>void;onScheduleReview:()=>void;onBack:()=>void;backLabel:string;studentMetrics:Record<number,Metric>;onMetric:(id:number,metric:Metric)=>void;availableResponsible:readonly string[];actionPlan:DemoActionPlan;onActionSave:(studentId:number,draft:DemoActionDraft,editingId:number|null)=>void;onActionToggle:(studentId:number,id:number)=>void}) {
 const [trainingRequest,setTrainingRequest]=useState<TrainingRequest|null>(null);
 const openTraining=(recordId:number|null=null)=>{setTrainingRequest(v=>({studentId:student.id,recordId,sequence:(v?.sequence||0)+1}));openSection('training');};
 useEffect(()=>{if(focusRequest&&section==='training')setTrainingRequest(v=>({studentId:student.id,recordId:null,sequence:(v?.sequence||0)+1}));},[focusRequest]);
 const [nutrition,setNutrition]=useState(createNutritionState);
 const [checkinOrigin,setCheckinOrigin]=useState<{id:number;sequence:number}|null>(null);
 const section=view.studentId===student.id?view.section:'overview';
 const setSection=(next:Section)=>onViewChange({studentId:student.id,section:next});
 const {container,requestFocus}=useDemoNavigationFocus(`${student.id}:${section}`,focusRequest);
 const openSection=(next:Section)=>{if(next!==section)requestFocus();setSection(next);};
 const metric=studentMetrics[student.id]||'weight';
 const setMetric=(next:Metric)=>onMetric(student.id,next);
 const [drafts,setDrafts]=useState<Record<number,Drafts>>({});
 const [feedback,setFeedback]=useState<Record<number,{assessment?:{error:boolean;text:string};care?:CareFeedback}>>({});
 const availableKey=availableResponsible.join('|');
 useEffect(()=>setFeedback(previous=>{let changed=false;const next={...previous};for(const [id,value] of Object.entries(previous)){if(value.care?.error&&value.care.field==='responsible'){next[Number(id)]={...value,care:undefined};changed=true;}}return changed?next:previous;}),[availableKey]);
 const weightInput=useRef<HTMLInputElement>(null);
 const assessmentFeedback=feedback[student.id]?.assessment;
 const careFeedback=feedback[student.id]?.care;
 const careForm=useRef<HTMLFormElement>(null);
 const clearCareFeedback=()=>setFeedback(v=>({...v,[student.id]:{...v[student.id],care:undefined}}));
 const careErrorProps=(field:keyof DemoCare)=>({'aria-invalid':careFeedback?.error&&careFeedback.field===field||undefined,'aria-describedby':careFeedback?.error&&careFeedback.field===field?'demo-care-hint demo-care-error':'demo-care-hint'});
 const draft=drafts[student.id]||{assessment:{...emptyAssessment},care:{...student.care}};
 const updateDraft=(next:Partial<Drafts>)=>setDrafts(v=>({...v,[student.id]:{...draft,...next}}));
 const notifyAssessment=(text:string,error=false)=>setFeedback(v=>({...v,[student.id]:{...v[student.id],assessment:{text,error}}}));
 const clearAssessmentFeedback=()=>setFeedback(v=>({...v,[student.id]:{...v[student.id],assessment:undefined}}));
 const nutritionMealCount=studentMeals(nutrition,student.id).length,nutritionEntryCount=nutrition.entries.filter(e=>e.studentId===student.id).length;
 const records=sortedAssessments(student);
 const appointments=sortedAppointments(allAppointments).filter(a=>a.studentId===student.id);
 const nextReview=nextStudentReview(allAppointments,student.id);
 const sectionIndex=journeySections.findIndex(([key])=>key===section);
 function saveAssessment(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  try {
   const assessment=parseDemoAssessment(draft.assessment);
   // A repeat on the same example date replaces that day's local example.
   onUpdate({...student,assessments:[...student.assessments.filter(a=>a.date!==assessment.date),assessment]});
   updateDraft({assessment:{...emptyAssessment}});
   notifyAssessment('Avaliação fictícia guardada apenas nesta sessão. Um registo por data.');
  }catch(error){notifyAssessment(error instanceof Error?error.message:'Não foi possível guardar o exemplo.',true);weightInput.current?.focus();}
 }
 function saveCare(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  try {
   const care=parseDemoCare(draft.care,availableResponsible,student.care.responsible);onUpdate({...student,care});updateDraft({care});
   setFeedback(v=>({...v,[student.id]:{...v[student.id],care:{error:false,text:'Acompanhamento fictício guardado apenas nesta sessão.'}}}));
  }catch(error){
   const field=error instanceof DemoCareError?error.field:undefined;
   setFeedback(v=>({...v,[student.id]:{...v[student.id],care:{error:true,text:error instanceof DemoCareError?error.message:'Não foi possível guardar o acompanhamento fictício.',field}}}));
   careForm.current?.querySelector<HTMLElement>(field?`[name="${field}"]`:'button[type="submit"]')?.focus();
  }
 }
 const context=<dl className="aura-preview-context"><div><dt>Acompanhamento</dt><dd>{statusLabels[student.care.status]}</dd></div><div><dt>Responsável</dt><dd>{student.care.responsible||'Por atribuir'}</dd></div><div><dt>Próxima revisão</dt><dd>{student.care.review?<time dateTime={student.care.review}>{student.care.review}</time>:'Sem revisão marcada'}</dd></div></dl>;
 return <>
  <div className="aura-preview-heading aura-preview-student-title"><span className="aura-preview-overline">ACOMPANHAMENTO / FICHA 360.º</span><h1>{student.name}</h1><p>Informação fictícia · Data de referência: <time dateTime={demoDate}>{demoDate}</time></p><button type="button" className="quiet aura-preview-journey-action" onClick={onBack}>← {backLabel}</button></div>
  <section className="aura-preview-panel aura-preview-student-header">
   <StudentIdentity name={student.name}><strong>{student.name}</strong><small>Aluno de demonstração · {brand}</small></StudentIdentity>
   <label>Escolher aluno<select value={student.id} onChange={event=>onChoose(Number(event.target.value))}>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <div className="aura-preview-context-desktop">{context}</div>
   <details className="aura-preview-context-mobile"><summary>Contexto do acompanhamento <span>{statusLabels[student.care.status]} · {student.care.review?`Revisão: ${student.care.review}`:'Sem revisão marcada'}</span></summary>{context}</details>
  </section>
  <div className="aura-preview-hub">
   <aside className="aura-preview-hubnav"><ProfileNavigation items={sections} value={section} disabled={false} onChange={setSection}/></aside>
   <div className="aura-preview-hubbody" ref={container}>
    {section==='overview'&&<>
     {!records.length&&<section className="aura-preview-panel aura-preview-empty"><h2>Começar o acompanhamento</h2><p>Este aluno ainda não tem avaliações de exemplo. Regista uma medição para preencher o resumo e a evolução.</p><button type="button" onClick={()=>openSection('assessments')}>Registar primeira avaliação</button></section>}
     <div className="aura-preview-summary"><ClientProgressSummary records={records.slice(-30).map(r=>({assessed_on:r.date,weight_kg:r.weight,height_cm:r.height,waist_cm:r.waist}))}/></div>
     <section className="aura-preview-panel"><div className="aura-preview-panelhead"><h2>Evolução recente</h2><button type="button" className="quiet" onClick={()=>openSection('evolution')}>Consultar evolução →</button></div><ProgressChart responsive records={records.map(r=>({date:r.date,value:r.weight}))} unit="kg"/><button type="button" className="quiet" onClick={()=>openSection('assessments')}>Consultar avaliações →</button></section>
     <section className="aura-preview-panel"><div className="aura-preview-panelhead"><h2>Agenda e revisão</h2><button type="button" className="quiet" onClick={()=>openSection('agenda')}>Consultar agenda →</button></div><p>{appointments.some(a=>a.status==='scheduled')?`${appointments.filter(a=>a.status==='scheduled').length} marcação de exemplo associada a este aluno.`:'Sem marcações ativas de exemplo para este aluno.'}</p><p>Próxima revisão: {student.care.review||'Sem revisão marcada'}</p><button type="button" className="quiet" onClick={()=>openSection('care')}>Editar acompanhamento →</button></section>
    </>}
    {section==='overview'&&<section className="aura-preview-panel"><div className="aura-preview-panelhead"><h2>Alimentação do aluno</h2><button type="button" className="quiet" onClick={()=>openSection('nutrition')}>Consultar nutrição →</button></div><p>{nutritionMealCount} {nutritionMealCount===1?'refeição':'refeições'} no plano · {nutritionEntryCount} {nutritionEntryCount===1?'registo simulado':'registos simulados'} no diário.</p><p className="aura-preview-note">Plano e diário separados, sem metas ou interpretação clínica.</p></section>}
    {section==='overview'&&<section className="aura-preview-panel"><div className="aura-preview-panelhead"><h2>Treino do aluno</h2><button type="button" className="quiet" onClick={()=>openSection('training')}>Consultar treino →</button></div><p>{activeTraining(training,student.id)?`Versão ${activeTraining(training,student.id)!.version} disponibilizada no exemplo.`:'Sem plano disponibilizado.'} {training.records.filter(r=>r.studentId===student.id).length} {training.records.filter(r=>r.studentId===student.id).length===1?'execução simulada':'execuções simuladas'} · {training.records.filter(r=>r.studentId===student.id&&!r.reviewedOn).length} por rever.</p><button type="button" className="quiet" onClick={()=>openTraining()}>Rever execuções de treino</button></section>}
    <DemoTraining visible={section==='training'} student={student} state={training} commands={trainingCommands} actions={actionPlan} onCare={()=>openSection('care')} request={trainingRequest}/>
    <DemoNutrition visible={section==='nutrition'} student={student} students={students} state={nutrition} onChange={setNutrition}/>
    <DemoSessionPreparation trainingRecords={training.records} onTraining={()=>openTraining()} visible={section==='overview'} student={student} appointments={allAppointments} plan={checkinPlan} actions={actionPlan} onCare={()=>openSection('care')} onAgenda={()=>openSection('agenda')} onAssessments={()=>openSection('assessments')}/>
    {section==='assessments'&&<>
     <section className="aura-preview-panel"><h2>Registar avaliação fictícia</h2><form onSubmit={saveAssessment} className="aura-preview-form" onChange={clearAssessmentFeedback} aria-describedby="demo-assessment-hint">
      <label>Data da avaliação<input type="date" required min="2000-01-01" max={demoDate} value={draft.assessment.date} onChange={e=>updateDraft({assessment:{...draft.assessment,date:e.target.value}})}/></label>
      {metrics.map(([key,label,unit])=><label key={key}>{label} ({unit})<input inputMode="decimal" type="number" min={key==='weight'?'0.01':'0.1'} max={key==='weight'?500:300} step={key==='weight'?'0.01':'0.1'} ref={key==='weight'?weightInput:undefined} aria-invalid={assessmentFeedback?.error||undefined} aria-describedby={assessmentFeedback?.error?'demo-assessment-hint demo-assessment-error':'demo-assessment-hint'} value={draft.assessment[key]} onChange={e=>updateDraft({assessment:{...draft.assessment,[key]:e.target.value}})}/></label>)}
      <button type="submit">Guardar avaliação</button>
     </form><p id="demo-assessment-hint" className="aura-preview-note">Preenche pelo menos uma medição. Um registo por data; guardar novamente substitui o exemplo dessa data. Rascunhos mantidos por aluno nesta sessão.</p>{assessmentFeedback&&<p id={assessmentFeedback.error?'demo-assessment-error':undefined} role={assessmentFeedback.error?'alert':'status'} className="aura-preview-message">{assessmentFeedback.text}</p>}</section>
     <section className="aura-preview-panel"><h2>Histórico de avaliações</h2>{records.length?<div className="aura-preview-table" role="region" tabIndex={0} aria-label={`Histórico de avaliações de ${student.name}. Usa as setas para deslocar e Tab para sair.`}><table><caption>Avaliações fictícias de {student.name}</caption><thead><tr><th scope="col">Data</th><th scope="col">Peso (kg)</th><th scope="col">Altura (cm)</th><th scope="col">Cintura (cm)</th></tr></thead><tbody>{records.slice().reverse().map(r=><tr key={r.date}><th scope="row">{r.date}</th><td>{r.weight??'—'}</td><td>{r.height??'—'}</td><td>{r.waist??'—'}</td></tr>)}</tbody></table></div>:<p>Este aluno ainda não tem avaliações de exemplo.</p>}</section>
    </>}
    {section==='evolution'&&<DemoEvolution records={records} metric={metric} onMetric={setMetric} onAssessment={()=>openSection('assessments')}/>}
    {section==='agenda'&&<section className="aura-preview-panel"><div className="aura-preview-panelhead"><h2>Agenda do aluno</h2><button type="button" className="quiet" onClick={onAgenda}>Abrir agenda geral →</button></div><p>Marcações fictícias associadas a este aluno. Referência: <time dateTime={demoDate}>{demoDate}</time>.</p>{appointments.length?<div className="aura-preview-timeline aura-preview-student-bookings">{appointments.map(a=><div key={a.id}><time dateTime={`${a.date}T${a.time}`}>{a.date} · {a.time}–{appointmentEnd(a)}</time><span className="aura-preview-dot"/><div><strong>{a.kind}</strong><small>{student.name} · {a.status==='cancelled'?'Cancelado':'Agendado'} · Exemplo</small></div></div>)}</div>:<p>Sem marcações de exemplo para este aluno.</p>}<button type="button" className="aura-preview-journey-action" onClick={onScheduleReview}>Agendar revisão deste aluno →</button><p className="aura-preview-note">Cria exemplos na agenda geral. Marcações profissionais exigem acesso autorizado.</p></section>}
    {section==='care'&&<section className="aura-preview-panel"><h2>Acompanhamento do aluno</h2>{nextReview&&<div className="aura-preview-review-date"><p>Próxima revisão na agenda: <time dateTime={`${nextReview.date}T${nextReview.time}`}>{nextReview.date} · {nextReview.time}</time></p><button type="button" className="quiet aura-preview-journey-action" onClick={()=>{updateDraft({care:{...draft.care,review:nextReview.date}});clearCareFeedback();}}>Usar data da marcação na próxima revisão</button><p className="aura-preview-note">Confirma a data e guarda o acompanhamento para atualizar o cabeçalho e as prioridades. Cancelar uma marcação não altera esta data guardada.</p></div>}<form ref={careForm} className="aura-preview-form" onSubmit={saveCare} onChange={clearCareFeedback} aria-describedby="demo-care-hint">
     <label>Estado do acompanhamento<select name="status" {...careErrorProps('status')} value={draft.care.status} onChange={e=>updateDraft({care:{...draft.care,status:e.target.value as DemoCare['status']}})}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
     <label>Profissional responsável<select name="responsible" {...careErrorProps('responsible')} value={draft.care.responsible} onChange={e=>updateDraft({care:{...draft.care,responsible:e.target.value}})}>{demoResponsible.map(name=><option key={name} value={name} disabled={!!name&&!availableResponsible.includes(name)&&name!==student.care.responsible}>{name?(availableResponsible.includes(name)?name:name+' — Pausado no exemplo'):'Por atribuir'}</option>)}</select></label>
     <label>Próxima revisão<input name="review" {...careErrorProps('review')} type="date" min="2000-01-01" max="2100-12-31" value={draft.care.review} onChange={e=>updateDraft({care:{...draft.care,review:e.target.value}})}/></label>
     <label className="aura-preview-full">Objetivo fictício<textarea name="goal" {...careErrorProps('goal')} rows={3} maxLength={500} value={draft.care.goal} onChange={e=>updateDraft({care:{...draft.care,goal:e.target.value}})}/></label>
     <button type="submit">Guardar acompanhamento</button>
    </form><p id="demo-care-hint" className="aura-preview-note">Usa apenas exemplos. O cabeçalho e as prioridades refletem o acompanhamento guardado nesta sessão; recarregar repõe os exemplos.</p>{careFeedback&&<p id={careFeedback.error?'demo-care-error':undefined} role={careFeedback.error?'alert':'status'} className="aura-preview-message">{careFeedback.text}</p>}</section>}
    <DemoCheckins visible={section==='care'} student={student} plan={checkinPlan} actions={actionPlan} commands={checkinCommands} sourceRequest={checkinOrigin}/>
    <DemoActions onTrainingSource={id=>openTraining(id)} visible={section==='care'} student={student} plan={actionPlan} onSave={onActionSave} onToggle={onActionToggle} onSource={id=>setCheckinOrigin(v=>({id,sequence:(v?.sequence||0)+1}))}/>
    <nav className="aura-preview-journey" aria-label="Continuar percurso do aluno">{sectionIndex>0&&<button type="button" className="quiet" onClick={()=>openSection(journeySections[sectionIndex-1][0])}>← Anterior: {journeySections[sectionIndex-1][1]}</button>}{sectionIndex>=0&&sectionIndex<journeySections.length-1?<button type="button" onClick={()=>openSection(journeySections[sectionIndex+1][0])}>Seguinte: {journeySections[sectionIndex+1][1]} →</button>:<button type="button" onClick={()=>openSection('overview')}>Voltar ao resumo →</button>}</nav>
   </div>
  </div>
 </>;
}
