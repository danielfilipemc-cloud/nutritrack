import {validDate} from '../../../lib/validation';
import {saveDemoAction,type DemoActionPlan} from './actions';
import {createDemoStudents,demoDate,type DemoStudent} from './model';

export const exercises=[
 {id:'squat',name:'Agachamento ao banco',material:'Banco',description:'Esquema de uma transição entre estar de pé e aproximar o corpo do banco.',phases:['De pé junto ao banco','Aproximação ao banco']},
 {id:'row',name:'Remada com elástico',material:'Elástico',description:'Esquema do deslocamento dos braços com um elástico.',phases:['Braços à frente','Braços próximos do tronco']},
 {id:'wall',name:'Flexão na parede',material:'Parede',description:'Esquema de aproximação e afastamento do tronco em relação à parede.',phases:['Afastamento da parede','Aproximação da parede']},
 {id:'step',name:'Subida de degrau',material:'Degrau',description:'Esquema de passagem do chão para um degrau.',phases:['Apoio no chão','Apoio no degrau']},
 {id:'calf',name:'Elevação de calcanhares',material:'Apoio',description:'Esquema da mudança de apoio do pé.',phases:['Calcanhares apoiados','Calcanhares elevados']},
 {id:'march',name:'Marcha no lugar',material:'Sem material',description:'Esquema de alternância de apoio das pernas.',phases:['Primeiro apoio','Apoio alternado']},
] as const;
export type ExerciseId=typeof exercises[number]['id'];
export type TrainingItem={id:number;exerciseId:ExerciseId;mode:'reps'|'seconds';target:number};
export type TrainingBlock={id:number;title:string;kind:'single'|'circuit';rounds:number;rest:number;items:TrainingItem[]};
export type TrainingSession={id:number;title:string;blocks:TrainingBlock[]};
export type TrainingDraft={title:string;from:string;to:string;sessions:TrainingSession[]};
export type TrainingPublication=TrainingDraft&{version:number;draftRevision:number;publishedOn:string};
export type TrainingPlan={studentId:number;revision:number;draft:TrainingDraft;publications:TrainingPublication[];activeVersion:number|null};
export type SetResultDraft={round:number;done:boolean;items:{itemId:number;performed:string;load:string;effort:string}[]};
export type SetResult={round:number;items:{itemId:number;performed:number;load:number|null;effort:number|null}[]};
export type BlockResultDraft={blockId:number;rounds:string;items:{itemId:number;performed:string;load:string}[];sets?:SetResultDraft[]};
export type ExecutionDraft={requestId:string;version:number;sessionId:number;date:string;outcome:'completed'|'partial';note:string;blocks:BlockResultDraft[]};
export type TrainingExecution={id:number;studentId:number;contractVersion:1;scope:'aura-demo';source:'simulated-student';sourceRecordId:string;requestId:string;version:number;planTitle:string;session:TrainingSession;date:string;outcome:'completed'|'partial';note:string;blocks:{blockId:number;rounds:number;items:{itemId:number;performed:number|null;load:number|null}[];sets?:SetResult[]}[];reviewedOn:string;reviewer:string};
export type TrainingState={plans:TrainingPlan[];records:TrainingExecution[];nextRecord:number};
export class TrainingError extends Error{constructor(message:string,readonly field:'plan'|'date'|'results'='plan'){super(message);}}
function fail(text:string,field:'plan'|'date'|'results'='plan'):never{throw new TrainingError(text,field);}
function student(students:readonly DemoStudent[],id:number){const s=students.find(s=>s.id===id);if(!s)fail('Escolhe um aluno fictício existente.');return s!;}
export function trainingPlan(state:TrainingState,id:number){return state.plans.find(p=>p.studentId===id);}
export function activeTraining(state:TrainingState,id:number){const p=trainingPlan(state,id);return p?.publications.find(v=>v.version===p.activeVersion);}
export function trainingTemplate():TrainingDraft{return {title:'Plano de movimento de exemplo',from:demoDate,to:'2026-11-20',sessions:[
 {id:1,title:'Treino A',blocks:[{id:1,title:'Preparação',kind:'single',rounds:1,rest:30,items:[{id:1,exerciseId:'march',mode:'seconds',target:30}]},{id:2,title:'Circuito de exemplo',kind:'circuit',rounds:2,rest:60,items:[{id:2,exerciseId:'squat',mode:'reps',target:8},{id:3,exerciseId:'row',mode:'reps',target:8}]}]},
 {id:2,title:'Treino B',blocks:[{id:3,title:'Bloco de exemplo',kind:'circuit',rounds:2,rest:60,items:[{id:4,exerciseId:'wall',mode:'reps',target:8},{id:5,exerciseId:'step',mode:'reps',target:6},{id:6,exerciseId:'calf',mode:'reps',target:10}]}]},
]};}
export function emptyTraining():TrainingDraft{return {title:'',from:demoDate,to:'2026-11-20',sessions:[]};}
function integer(value:number,min:number,max:number){if(!Number.isInteger(value)||value<min||value>max)fail(`Valor fora do intervalo ${min}–${max}.`);return value;}
export function validateTraining(input:TrainingDraft):TrainingDraft{
 const title=input.title.trim();if(title.length<2||title.length>80)fail('Indica um título de plano com 2 a 80 caracteres.');
 if(!validDate(input.from)||!validDate(input.to)||input.from<'2000-01-01'||input.to>'2100-12-31'||input.from>input.to)fail('Indica um período válido para o plano.');
 if(!input.sessions.length||input.sessions.length>6)fail('O exemplo permite 1 a 6 sessões.');
 const ids={sessions:new Set<number>(),blocks:new Set<number>(),items:new Set<number>()};let count=0;
 const unique=(set:Set<number>,id:number)=>{integer(id,1,100000);if(set.has(id))fail('IDs repetidos no plano de exemplo.');set.add(id);};
 for(const s of input.sessions){unique(ids.sessions,s.id);if(s.title.trim().length<2||s.title.trim().length>60||!s.blocks.length||s.blocks.length>6)fail('Cada sessão precisa de título e 1 a 6 blocos.');
  for(const b of s.blocks){unique(ids.blocks,b.id);if(b.title.trim().length<2||b.title.trim().length>60||!['single','circuit'].includes(b.kind)||!b.items.length||b.items.length>6||b.kind==='single'&&b.items.length!==1)fail('Revê o título, formato e exercícios de cada bloco.');integer(b.rounds,1,10);integer(b.rest,0,3600);
   for(const i of b.items){unique(ids.items,i.id);if(!exercises.some(e=>e.id===i.exerciseId)||!['reps','seconds'].includes(i.mode))fail('Escolhe um exercício e unidade de exemplo.');integer(i.target,1,i.mode==='reps'?1000:3600);count++;}
  }
 }if(count>60)fail('O plano de exemplo permite até 60 posições de exercício.');return structuredClone({...input,title});
}
export function saveTrainingDraft(state:TrainingState,id:number,draft:TrainingDraft,expected:number,students:readonly DemoStudent[]):TrainingState{
 student(students,id);const previous=trainingPlan(state,id);if((previous?.revision||0)!==expected)fail('O rascunho mudou. Conserva a tua edição e revê a versão.');const value=validateTraining(draft);
 const plan:TrainingPlan={studentId:id,revision:expected+1,draft:value,publications:previous?.publications||[],activeVersion:previous?.activeVersion??null};return {...state,plans:previous?state.plans.map(p=>p.studentId===id?plan:p):[...state.plans,plan]};
}
export function publishTraining(state:TrainingState,id:number,expected:number,students:readonly DemoStudent[]):TrainingState{
 student(students,id);const p=trainingPlan(state,id);if(!p||p.revision!==expected)fail('Guarda e revê o rascunho antes de disponibilizar.');if(p.publications.some(v=>v.draftRevision===p.revision)&&p.activeVersion!==null)fail('Esta revisão já está disponibilizada no exemplo.');
 if(p.publications.length>=20)fail('Limite de 20 versões disponibilizadas por aluno.');
 const version=p.publications.length+1,value={...validateTraining(p.draft),version,draftRevision:p.revision,publishedOn:demoDate};return {...state,plans:state.plans.map(plan=>plan.studentId===id?{...p,activeVersion:version,publications:[...p.publications,value]}:plan)};
}
export function withdrawTraining(state:TrainingState,id:number,students:readonly DemoStudent[]):TrainingState{student(students,id);const p=trainingPlan(state,id);if(!p?.activeVersion)fail('Não existe versão disponibilizada.');return {...state,plans:state.plans.map(plan=>plan.studentId===id?{...p,activeVersion:null}:plan)};}
export function createTrainingState():TrainingState{
 let state:TrainingState={plans:[],records:[],nextRecord:1};const students=createDemoStudents();state=saveTrainingDraft(state,1,trainingTemplate(),0,students);state=publishTraining(state,1,1,students);return saveTrainingDraft(state,2,trainingTemplate(),0,students);
}
export function executionDraft(pub:TrainingPublication,sessionId:number,requestId:string):ExecutionDraft{
 const s=pub.sessions.find(s=>s.id===sessionId);if(!s)fail('Sessão inexistente nesta versão.');return {requestId,version:pub.version,sessionId,date:demoDate,outcome:'completed',note:'',blocks:s!.blocks.map(b=>({blockId:b.id,rounds:'',items:b.items.map(i=>({itemId:i.id,performed:'',load:''}))}))};
}
function numberText(text:string,max:number,decimal=false,optional=false):number|null{if(optional&&!text.trim())return null;if(!(decimal?/^\d+(?:[.,]\d{1,2})?$/:/^\d+$/).test(text.trim()))fail('Preenche os resultados com números válidos.','results');const n=Number(text.trim().replace(',','.'));if(!Number.isFinite(n)||n<0||n>max)fail('Resultado fora dos limites do exemplo.','results');return n;}
export function submitTraining(state:TrainingState,id:number,draft:ExecutionDraft,students:readonly DemoStudent[]):TrainingState{
 student(students,id);if(!/^demo-training-[1-9]\d{0,8}-[1-9]\d{0,8}$/.test(draft.requestId)||!draft.requestId.startsWith(`demo-training-${id}-`))fail('Identificador de registo inválido.');
 const existing=state.records.find(r=>r.studentId===id&&r.requestId===draft.requestId);
 const pub=trainingPlan(state,id)?.publications.find(p=>p.version===draft.version);const session=pub?.sessions.find(s=>s.id===draft.sessionId);if(!pub||!session)fail('A versão ou sessão não pertence a este aluno.');
 if(!validDate(draft.date)||draft.date<'2000-01-01'||draft.date>demoDate||draft.date<pub.from||draft.date>pub.to)fail('Escolhe um dia dentro da vigência do plano e até à referência da demo.','date');
 if(!['completed','partial'].includes(draft.outcome)||draft.note.trim().length>500||draft.blocks.length!==session!.blocks.length)fail('Revê o estado, a nota e os blocos do registo.','results');
 const blocks=session!.blocks.map(b=>{const raw=draft.blocks.filter(r=>r.blockId===b.id);if(raw.length!==1||raw[0].items.length!==b.items.length)fail('Os resultados não correspondem aos blocos da sessão.','results');if(raw[0].sets!==undefined){
   const sets=raw[0].sets;if(!Array.isArray(sets)||sets.length!==b.rounds||sets.some((set,index)=>set.round!==index+1||typeof set.done!=='boolean'||!Array.isArray(set.items)||set.items.length!==b.items.length))fail('Revê as séries individuais e a sua ordem.','results');
   const performedSets:SetResult[]=sets.flatMap(set=>{const items=b.items.map(i=>{const rows=set.items.filter(row=>row.itemId===i.id);if(rows.length!==1)fail('Os exercícios de cada série devem corresponder ao plano.','results');const row=rows[0];if(!set.done)return {itemId:i.id,performed:0,load:null,effort:null};const performed=numberText(row.performed,i.mode==='reps'?1000:3600)!;if(performed===0)fail('Indica um resultado positivo nas séries realizadas.','results');return {itemId:i.id,performed,load:numberText(row.load,500,true,true),effort:numberText(row.effort,10,true,true)};});return set.done?[{round:set.round,items}]:[];});
   if(draft.outcome==='completed'&&performedSets.length!==b.rounds)fail('Um treino concluído exige todas as séries/rondas. Usa Parcial para outro resultado.','results');
   return {blockId:b.id,rounds:performedSets.length,items:b.items.map(i=>({itemId:i.id,performed:null,load:null})),sets:performedSets};
  }
  const rounds=numberText(raw[0].rounds,b.rounds)!;
  if(draft.outcome==='completed'&&rounds!==b.rounds)fail('Um treino concluído exige todas as séries/rondas. Usa Parcial para outro resultado.','results');
  const items=b.items.map(i=>{const rows=raw[0].items.filter(r=>r.itemId===i.id);if(rows.length!==1)fail('Exercício repetido ou inexistente nos resultados.','results');const performed=numberText(rows[0].performed,i.mode==='reps'?1000:3600,false,rounds===0),load=numberText(rows[0].load,500,true,true);if(rounds>0&&(performed===null||performed===0))fail('Indica repetições/segundos nos exercícios realizados.','results');if(rounds===0&&(performed!==null||load!==null))fail('Um bloco sem execução deve manter resultados e carga vazios.','results');return {itemId:i.id,performed,load};});return {blockId:b.id,rounds,items};});
 const value={studentId:id,contractVersion:1 as const,scope:'aura-demo' as const,source:'simulated-student' as const,sourceRecordId:`training:${id}:${draft.requestId}`,requestId:draft.requestId,version:draft.version,planTitle:pub!.title,session:structuredClone(session!),date:draft.date,outcome:draft.outcome,note:draft.note.trim(),blocks};
 if(existing){const {id:recordId,reviewedOn,reviewer,...old}=existing;void recordId;void reviewedOn;void reviewer;if(JSON.stringify(old)!==JSON.stringify(value))fail('Este pedido já tem outro conteúdo; o original foi preservado.');return state;}
 if(activeTraining(state,id)?.version!==draft.version)fail('A versão disponibilizada mudou ou foi retirada. O rascunho mantém-se; prepara um registo da versão atual.');
 if(state.records.filter(r=>r.studentId===id).length>=100)fail('Limite de 100 registos de treino por aluno.');return {...state,nextRecord:state.nextRecord+1,records:[...state.records,{id:state.nextRecord,...value,reviewedOn:'',reviewer:''}]};
}
export function reviewTraining(state:TrainingState,id:number,recordId:number,students:readonly DemoStudent[]):TrainingState{const s=student(students,id),record=state.records.find(r=>r.id===recordId&&r.studentId===id);if(!record||record.reviewedOn)fail('Escolhe um registo deste aluno por rever.');if(!s.care.responsible)fail('Guarda um responsável no acompanhamento antes de rever.');return {...state,records:state.records.map(r=>r.id===recordId?{...r,reviewedOn:demoDate,reviewer:s.care.responsible}:r)};}
export function actionFromTraining(actions:DemoActionPlan,state:TrainingState,id:number,recordId:number,students:DemoStudent[]){const r=state.records.find(r=>r.studentId===id&&r.id===recordId);if(!r?.reviewedOn)fail('Revê primeiro o registo de treino.');if(actions.actions.some(a=>a.studentId===id&&a.sourceTrainingId===recordId))return actions;const next=saveDemoAction(actions,id,{title:`Rever sessão a partir do treino #${recordId}`,due:''},students);return {...next,actions:next.actions.map(a=>a.id===actions.nextId?{...a,sourceTrainingId:recordId}:a)};}
