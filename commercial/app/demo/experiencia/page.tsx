"use client";
import {useEffect,useRef,useState} from "react";
import AuraBrand from "../../../components/AuraBrand";
import DemoStudentHub,{type DemoStudentView} from "./DemoStudentHub";
import DemoAgenda from "./DemoAgenda";
import {type DemoMetric,type AgendaRequest} from "./journey";
import DemoStudentDirectory from "./DemoStudentDirectory";
import {filterDemoStudents,type DemoDirectoryFilter} from "./directory";
import DemoDashboard from "./DemoDashboard";
import DemoTeam from "./DemoTeam";
import DemoBrand from "./DemoBrand";
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
   <div hidden={tab!=="inicio"}><DemoDashboard visible={tab==='inicio'} studentMetrics={studentMetrics} onMetric={setStudentMetric} students={records} appointments={schedule.appointments} chosen={chosen} onChoose={setChosen} onStudent={(id,area)=>openStudent(id,area,'overview')} onAgenda={(id,date)=>id===undefined?go('agenda'):openStudentAgenda(id,'consult',date)} onDirectory={()=>go('alunos')}/></div>
   {tab==="alunos"&&<><div className="aura-preview-heading"><span className="aura-preview-overline">ACOMPANHAMENTO</span><h1>Os teus alunos</h1><p>Experimenta criar e consultar alunos fictícios.</p><button type="button" className="quiet aura-preview-journey-action" onClick={()=>{nameInput.current?.focus({preventScroll:true});nameInput.current?.scrollIntoView({block:'center',behavior:'instant'});}}>Novo aluno fictício →</button></div><DemoStudentDirectory rows={directoryRows} total={records.length} query={directoryQuery} status={directoryStatus} onQuery={setDirectoryQuery} onStatus={setDirectoryStatus} onOpen={openDirectoryStudent}/><section className="aura-preview-panel"><h2>Registar aluno fictício</h2><form onSubmit={addStudent} className="aura-preview-inputrow"><label>Nome de exemplo<input ref={nameInput} value={newName} maxLength={100} onChange={e=>setNewName(e.target.value)} placeholder="Ex.: Joana Exemplo"/></label><button type="submit">Adicionar aluno</button></form></section></>}

   <div hidden={tab!=="ficha"}><DemoStudentHub availableResponsible={availableResponsible} studentMetrics={studentMetrics} onMetric={setStudentMetric} view={profileView} onViewChange={setProfileView} focusRequest={profileFocus} allAppointments={schedule.appointments} student={student} students={records} brand={brandName} onChoose={setChosen} onUpdate={updateStudent} onAgenda={()=>openStudentAgenda(student.id,'consult')} onScheduleReview={()=>openStudentAgenda(student.id,'review')} onBack={()=>go(profileOrigin==='directory'?'alunos':profileOrigin==='agenda'?'agenda':profileOrigin==='team'?'equipa':'inicio')} backLabel={profileOrigin==='directory'?'Voltar aos resultados':profileOrigin==='agenda'?'Voltar à agenda':profileOrigin==='team'?'Voltar à equipa':'Voltar à visão geral'}/></div>
   <div hidden={tab!=="agenda"}><DemoAgenda request={agendaRequest} onRequestReview={id=>openStudentAgenda(id,'review')} onContinueCare={id=>openStudent(id,'care','agenda')} students={records} schedule={schedule} onCreate={draft=>setSchedule(previous=>createAppointment(previous,draft,records))} onReschedule={(id,draft)=>setSchedule(previous=>rescheduleAppointment(previous,id,draft,records))} onCancel={id=>setSchedule(previous=>cancelAppointment(previous,id))} onClearResult={()=>setSchedule(previous=>({...previous,result:null}))} onOpenStudent={id=>openStudent(id,'agenda','agenda')}/></div>
   <DemoTeam visible={tab==='equipa'} team={team} students={records} onChange={(id,patch)=>setTeam(v=>updateDemoTeam(v,id,patch))} onStudent={id=>openStudent(id,'care','team')}/>
   <DemoBrand visible={tab==='marca'} brand={brand} accent={accent} onBrand={setBrand} onAccent={setAccent} onReset={()=>{setBrand(defaultDemoBrand);setAccent(defaultDemoAccent);}}/>
   {message&&<p role="status" className="aura-preview-message">{message}</p>}
   </div>
   <footer>Pré-visualização Premium · Dados locais e fictícios · Atualizar a página repõe os exemplos · <a href="/demo">Abrir demonstração clássica</a></footer>
  </section>
 </main>;
}
