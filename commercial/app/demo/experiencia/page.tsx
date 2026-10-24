"use client";
import {useEffect,useRef,useState} from "react";
import AuraBrand from "../../../components/AuraBrand";
import DemoStudentHub,{type DemoStudentView} from "./DemoStudentHub";
import DemoAgenda from "./DemoAgenda";
import {createTrainingState,saveTrainingDraft,publishTraining,withdrawTraining,submitTraining,reviewTraining,actionFromTraining} from "./training";
import {createNutritionState,actionFromNutrition} from './nutrition';
import type {TrainingCommands} from "./DemoTraining";
import {type DemoMetric,type AgendaRequest} from "./journey";
import DemoStudentDirectory from "./DemoStudentDirectory";
import {filterDemoStudents,type DemoDirectoryFilter} from "./directory";
import DemoDashboard from "./DemoDashboard";
import DemoTeam from "./DemoTeam";
import {createDemoActionPlan,saveDemoAction,toggleDemoAction} from "./actions";
import DemoBrand from "./DemoBrand";
import DemoReviewQueue from "./DemoReviewQueue";
import {createCheckinPlan,prepareCheckin,submitCheckin,reviewCheckin,cancelCheckin,actionFromCheckin} from "./checkins";
import type {CheckinCommands} from "./DemoCheckins";
import {createDemoTeam,updateDemoTeam,activeResponsible} from "./team";
import {defaultDemoBrand,defaultDemoAccent,accentAppearance} from "./branding";
import {createDemoSchedule,createAppointment,rescheduleAppointment,cancelAppointment,sortedAppointments} from "./appointments";
import useDemoNavigationFocus from "./use-demo-navigation-focus";
import {createDemoStudents,demoDate,type DemoStudent} from "./model";
import "./experience.css";
type Tab="inicio"|"alunos"|"ficha"|"agenda"|"marca"|"equipa";
export default function DemoExperience(){
 const [ready,setReady]=useState(false);
 useEffect(()=>setReady(true),[]);
 const [records,setRecords]=useState(createDemoStudents),[tab,setTab]=useState<Tab>("inicio"),[chosen,setChosen]=useState(1),[newName,setNewName]=useState(""),[brand,setBrand]=useState(defaultDemoBrand),[accent,setAccent]=useState(defaultDemoAccent),[message,setMessage]=useState("");
 const [studentMetrics,setStudentMetrics]=useState<Record<number,DemoMetric>>({});
 const setStudentMetric=(id:number,metric:DemoMetric)=>setStudentMetrics(v=>({...v,[id]:metric}));
 const [team,setTeam]=useState(createDemoTeam);
 const [actionPlan,setActionPlan]=useState(createDemoActionPlan);
 const [nutrition,setNutrition]=useState(createNutritionState);
 const [training,setTraining]=useState(createTrainingState);
 const trainingCommands:TrainingCommands={save:(id,draft,expected)=>setTraining(saveTrainingDraft(training,id,draft,expected,records)),publish:(id,expected)=>setTraining(publishTraining(training,id,expected,records)),withdraw:id=>setTraining(withdrawTraining(training,id,records)),submit:(id,draft)=>setTraining(submitTraining(training,id,draft,records)),review:(id,recordId)=>setTraining(reviewTraining(training,id,recordId,records)),action:(id,recordId)=>setActionPlan(actionFromTraining(actionPlan,training,id,recordId,records))};
 const [checkinPlan,setCheckinPlan]=useState(createCheckinPlan);
 const checkinCommands:CheckinCommands={prepare:(id,due)=>setCheckinPlan(prepareCheckin(checkinPlan,id,due,records)),submit:(studentId,id,answers)=>setCheckinPlan(submitCheckin(checkinPlan,studentId,id,answers)),review:(studentId,id)=>setCheckinPlan(reviewCheckin(checkinPlan,studentId,id,records)),cancel:(studentId,id)=>setCheckinPlan(cancelCheckin(checkinPlan,studentId,id)),action:(studentId,id)=>setActionPlan(actionFromCheckin(actionPlan,checkinPlan,studentId,id,records))};
 const availableResponsible=activeResponsible(team),brandName=brand.trim()||"O teu espaço",appearance=accentAppearance(accent);
 const students=records;
 const student=students.find(s=>s.id===chosen)||students[0];
 const [schedule,setSchedule]=useState(createDemoSchedule);
 const [profileAreas,setProfileAreas]=useState<Record<number,DemoStudentView['section']>>({}),[profileFocus,setProfileFocus]=useState(0);
 const profileView:DemoStudentView={studentId:chosen,section:profileAreas[chosen]||'overview'};
 const setProfileView=(view:DemoStudentView)=>setProfileAreas(v=>({...v,[view.studentId]:view.section}));
 const [profileOrigin,setProfileOrigin]=useState<'directory'|'agenda'|'overview'|'team'>('directory');
 const [agendaRequest,setAgendaRequest]=useState<AgendaRequest|null>(null);
 const nameInput=useRef<HTMLInputElement>(null);
 const openStudent=(id:number,section:DemoStudentView['section'],origin:'directory'|'agenda'|'overview'|'team')=>{setChosen(id);setProfileView({studentId:id,section});setProfileOrigin(origin);setProfileFocus(n=>n+1);setTab('ficha');setMessage('');};
 const openStudentAgenda=(id:number,mode:'consult'|'review',date?:string)=>{const current=records.find(s=>s.id===id)!;const next=sortedAppointments(schedule.appointments).find(a=>a.studentId===id&&a.status==='scheduled'&&a.date>=demoDate);setAgendaRequest(v=>({sequence:(v?.sequence||0)+1,studentId:id,mode,date:mode==='review'?current.care.review||demoDate:date||next?.date||demoDate}));setTab('agenda');setMessage('');};
 const [directoryQuery,setDirectoryQuery]=useState(''),[directoryStatus,setDirectoryStatus]=useState<DemoDirectoryFilter>('all');
 const directoryRows=filterDemoStudents(records,directoryQuery,directoryStatus);
 const openDirectoryStudent=(id:number)=>openStudent(id,'overview','directory');
 const {container,requestFocus}=useDemoNavigationFocus(tab);
 const go=(next:Tab)=>{if(next!==tab)requestFocus();setTab(next);setMessage("");};
 const updateStudent=(student:DemoStudent)=>setRecords(v=>v.map(s=>s.id===student.id?student:s));
 const addStudent=(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const name=newName.trim();if(name.length<2||name.length>100){setMessage("Indica um nome fictício com 2 a 100 caracteres.");return;}const next=Math.max(...students.map(s=>s.id))+1;setRecords(v=>[...v,{id:next,name,assessments:[],care:{status:"active",responsible:"",review:"",goal:""}}]);setChosen(next);setProfileOrigin('directory');setProfileView({studentId:next,section:'overview'});setNewName("");go("ficha");setMessage("Aluno fictício criado nesta sessão.");};
 const nav:[Tab,string][]=[["inicio","Visão geral"],["alunos","Alunos"],["ficha","Ficha 360.º"],["agenda","Agenda"],["equipa","Equipa"],["marca","A tua marca"]];
 return <main aria-busy={!ready} inert={!ready} className="aura-preview" id="main-content" tabIndex={-1} style={{"--demo-accent":accent,"--demo-accent-ink":appearance.ink} as React.CSSProperties}>
  <aside className="aura-preview-side"><AuraBrand/><span className="aura-preview-overline">AMBIENTE DE DEMONSTRAÇÃO</span><nav aria-label="Navegação da demonstração">{nav.map(([key,label])=><button type="button" key={key} className={tab===key?"selected":""} aria-current={tab===key?"page":undefined} onClick={()=>go(key)}>{label}</button>)}</nav><div className="aura-preview-sidefoot"><strong>{brandName}</strong><small>Dados totalmente fictícios, sem conta ou base de dados.</small><a href="/demo">Demonstração clássica ↗</a><a href="/">Voltar ao login ↗</a></div></aside>
  <section className="aura-preview-main">
   <header className="aura-preview-top"><div className="aura-preview-mobilebrand"><AuraBrand/></div><div><span className="aura-preview-overline">AURA BUSINESS / PRÉ-VISUALIZAÇÃO</span><strong>{brandName}</strong></div><span className="aura-preview-pill">Sem dados reais</span></header>
   <nav className="aura-preview-mobiletabs" aria-label="Áreas da demonstração">{nav.map(([key,label])=><button key={key} type="button" aria-current={tab===key?"page":undefined} onClick={()=>go(key)}>{label}</button>)}</nav>
   <div className="aura-preview-content" ref={container}>
   <div hidden={tab!=="inicio"}><DemoDashboard visible={tab==='inicio'} studentMetrics={studentMetrics} onMetric={setStudentMetric} students={records} appointments={schedule.appointments} chosen={chosen} onChoose={setChosen} onStudent={(id,area)=>openStudent(id,area,'overview')} onAgenda={(id,date)=>id===undefined?go('agenda'):openStudentAgenda(id,'consult',date)} onDirectory={()=>go('alunos')}/>{records.some(s=>nutrition.entries.some(e=>e.studentId===s.id&&!e.reviewedOn)||training.records.some(r=>r.studentId===s.id&&!r.reviewedOn))&&<section className="aura-preview-panel" aria-labelledby="demo-student-records-pending"><h2 id="demo-student-records-pending">Registos do aluno por rever</h2><p>Execuções e refeições simuladas, separadas das datas de revisão do acompanhamento.</p><ul className="aura-demo-continuity-list">{records.map(s=>{const food=nutrition.entries.filter(e=>e.studentId===s.id&&!e.reviewedOn).length,work=training.records.filter(r=>r.studentId===s.id&&!r.reviewedOn).length;return food||work?<li key={s.id}><h3>{s.name}</h3><p>Alimentação: {food} · Treino: {work} por rever</p>{food>0&&<button type="button" className="quiet" onClick={()=>openStudent(s.id,'nutrition','overview')}>Rever alimentação na ficha de {s.name}</button>}{work>0&&<button type="button" className="quiet" onClick={()=>openStudent(s.id,'training','overview')}>Rever treino na ficha de {s.name}</button>}</li>:null;})}</ul></section>}</div>
   {tab==="alunos"&&<><div className="aura-preview-heading"><span className="aura-preview-overline">ACOMPANHAMENTO</span><h1>Os teus alunos</h1><p>Experimenta criar e consultar alunos fictícios.</p><button type="button" className="quiet aura-preview-journey-action" onClick={()=>{nameInput.current?.focus({preventScroll:true});nameInput.current?.scrollIntoView({block:'center',behavior:'instant'});}}>Novo aluno fictício →</button></div><DemoStudentDirectory rows={directoryRows} total={records.length} query={directoryQuery} status={directoryStatus} onQuery={setDirectoryQuery} onStatus={setDirectoryStatus} onOpen={openDirectoryStudent}/><section className="aura-preview-panel"><h2>Registar aluno fictício</h2><form onSubmit={addStudent} className="aura-preview-inputrow"><label>Nome de exemplo<input ref={nameInput} value={newName} maxLength={100} onChange={e=>setNewName(e.target.value)} placeholder="Ex.: Joana Exemplo"/></label><button type="submit">Adicionar aluno</button></form></section></>}

   <DemoReviewQueue nutritionRecords={nutrition.entries} onNutrition={id=>openStudent(id,'nutrition','directory')} trainingRecords={training.records} onTraining={id=>openStudent(id,'training','directory')} visible={tab==='alunos'} students={records} plan={checkinPlan} actions={actionPlan} onStudent={id=>openStudent(id,'care','directory')}/>
   <div hidden={tab!=="ficha"}><DemoStudentHub nutrition={nutrition} onNutritionChange={setNutrition} onNutritionAction={(studentId,id)=>setActionPlan(actionFromNutrition(actionPlan,nutrition,studentId,id,records))} training={training} trainingCommands={trainingCommands} checkinPlan={checkinPlan} checkinCommands={checkinCommands} actionPlan={actionPlan} onActionSave={(id,draft,editingId)=>setActionPlan(saveDemoAction(actionPlan,id,draft,records,editingId))} onActionToggle={(studentId,id)=>setActionPlan(toggleDemoAction(actionPlan,studentId,id))} availableResponsible={availableResponsible} studentMetrics={studentMetrics} onMetric={setStudentMetric} view={profileView} onViewChange={setProfileView} focusRequest={profileFocus} allAppointments={schedule.appointments} student={student} students={records} brand={brandName} onChoose={setChosen} onUpdate={updateStudent} onAgenda={()=>openStudentAgenda(student.id,'consult')} onScheduleReview={()=>openStudentAgenda(student.id,'review')} onBack={()=>go(profileOrigin==='directory'?'alunos':profileOrigin==='agenda'?'agenda':profileOrigin==='team'?'equipa':'inicio')} backLabel={profileOrigin==='directory'?'Voltar aos resultados':profileOrigin==='agenda'?'Voltar à agenda':profileOrigin==='team'?'Voltar à equipa':'Voltar à visão geral'}/></div>
   <div hidden={tab!=="agenda"}><DemoAgenda onScheduleChange={next=>setSchedule({...next,result:null})} request={agendaRequest} onRequestReview={id=>openStudentAgenda(id,'review')} onContinueCare={id=>openStudent(id,'care','agenda')} students={records} schedule={schedule} onCreate={draft=>setSchedule(previous=>createAppointment(previous,draft,records))} onReschedule={(id,draft)=>setSchedule(previous=>rescheduleAppointment(previous,id,draft,records))} onCancel={id=>setSchedule(previous=>cancelAppointment(previous,id))} onClearResult={()=>setSchedule(previous=>({...previous,result:null}))} onOpenStudent={id=>openStudent(id,'agenda','agenda')}/></div>
   <DemoTeam actionPlan={actionPlan} visible={tab==='equipa'} team={team} students={records} onChange={(id,patch)=>setTeam(v=>updateDemoTeam(v,id,patch))} onStudent={id=>openStudent(id,'care','team')}/>
   <DemoBrand visible={tab==='marca'} brand={brand} accent={accent} onBrand={setBrand} onAccent={setAccent} onReset={()=>{setBrand(defaultDemoBrand);setAccent(defaultDemoAccent);}}/>
   {message&&<p role="status" className="aura-preview-message">{message}</p>}
   </div>
   <footer>Pré-visualização Premium · Dados locais e fictícios · Atualizar a página repõe os exemplos · <a href="/demo">Abrir demonstração clássica</a></footer>
  </section>
 </main>;
}
