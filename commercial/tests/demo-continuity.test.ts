import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoStudents,demoDate} from '../app/demo/experiencia/model';
import {createCheckinPlan,prepareCheckin,submitCheckin,reviewCheckin,cancelCheckin,actionFromCheckin,reviewRows,blankCheckin,latestSubmittedCheckin} from '../app/demo/experiencia/checkins';
import {createDemoActionPlan,toggleDemoAction} from '../app/demo/experiencia/actions';
import {createDemoSchedule,createAppointment,rescheduleAppointment} from '../app/demo/experiencia/appointments';
import {createSeries,changeSeries,type SeriesDraft} from '../app/demo/experiencia/recurrence';
const students=createDemoStudents();
const draft:SeriesDraft={studentId:'1',date:demoDate,time:'16:00',duration:'30',kind:'Revisão de acompanhamento',count:'4',interval:'1'};
test('check-in lifecycle keeps original answers and question snapshots, reviewer and action origins separate',()=>{
 const base=createCheckinPlan(),before=structuredClone(base);let plan=prepareCheckin(base,3,demoDate,students);
 assert.equal(plan.items.at(-1)?.questions.version,1);
 const answers={...blankCheckin,activity:'skip' as const,topic:'  Tema de exemplo  '};plan=submitCheckin(plan,3,3,answers);answers.topic='Mutação fora do registo';
 assert.equal(plan.items.at(-1)?.answers?.topic,'Tema de exemplo');assert.throws(()=>submitCheckin(plan,3,3,answers));
 const original=structuredClone(plan.items.at(-1)?.answers);plan=reviewCheckin(plan,3,3,students);assert.deepEqual(plan.items.at(-1)?.answers,original);assert.equal(plan.items.at(-1)?.reviewer,students[2].care.responsible);
 const actions=actionFromCheckin(createDemoActionPlan(),plan,3,3,students);assert.equal(actions.actions.at(-1)?.sourceCheckinId,3);assert.equal(actionFromCheckin(actions,plan,3,3,students),actions);
 assert.equal(actionFromCheckin(toggleDemoAction(actions,3,3),plan,3,3,students).actions.length,3);assert.deepEqual(base,before);
});
test('check-in guards reject cross-student, invalid dates, future simulation and destructive transitions',()=>{
 const plan=createCheckinPlan(),snapshot=structuredClone(plan);
 for(const date of ['2026-02-30','1999-12-31','2101-01-01',''])assert.throws(()=>prepareCheckin(plan,1,date,students));
 assert.throws(()=>prepareCheckin(plan,99,demoDate,students));assert.throws(()=>reviewCheckin(plan,2,1,students));assert.throws(()=>cancelCheckin(plan,1,1));
 assert.throws(()=>submitCheckin(plan,2,2,blankCheckin));assert.throws(()=>submitCheckin(plan,2,2,{...blankCheckin,activity:'yes',topic:'x'.repeat(501)}));
 const future=prepareCheckin(plan,2,'2026-10-21',students);assert.throws(()=>submitCheckin(future,2,3,{...blankCheckin,activity:'yes'}));
 const cancelled=cancelCheckin(plan,2,2);assert.throws(()=>submitCheckin(cancelled,2,2,{...blankCheckin,activity:'yes'}));
 assert.throws(()=>actionFromCheckin(createDemoActionPlan(),plan,1,1,students));assert.throws(()=>reviewCheckin(plan,1,1,students.map(s=>s.id===1?{...s,care:{...s.care,responsible:''}}:s)));assert.deepEqual(plan,snapshot);
});
test('review queue counts each student once and derives distinct reasons from authoritative records',()=>{
 const plan=createCheckinPlan(),actions=createDemoActionPlan();const rows=reviewRows(students,plan,actions);
 assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>[r.student.id,r.unreviewed,r.overdue,r.pending]),[[1,1,0,1],[2,0,1,1]]);
 const reviewed=reviewCheckin(plan,1,1,students);assert.equal(reviewRows(students,reviewed,actions)[0].unreviewed,0);
 assert.equal(reviewRows(students,reviewed,toggleDemoAction(actions,1,1)).some(r=>r.student.id===1),false);
});
test('latest answer follows submission order even when older prepared forms are answered later',()=>{
 let plan=prepareCheckin(createCheckinPlan(),1,demoDate,students);plan=prepareCheckin(plan,1,demoDate,students);
 plan=submitCheckin(plan,1,4,{...blankCheckin,activity:'yes'});assert.equal(latestSubmittedCheckin(plan,1)?.id,4);
 plan=submitCheckin(plan,1,3,{...blankCheckin,activity:'partly'});assert.equal(latestSubmittedCheckin(plan,1)?.id,3);
 assert.equal(latestSubmittedCheckin(plan,2),undefined);
});
test('series preserve local civil hours across DST, stable ids and one calendar conflict rules',()=>{
 const base=createDemoSchedule(),next=createSeries(base,draft,students),series=next.appointments.filter(a=>a.seriesId);
 assert.deepEqual(series.map(a=>a.date),['2026-10-20','2026-10-27','2026-11-03','2026-11-10']);assert.ok(series.every(a=>a.time==='16:00'));assert.deepEqual(series.map(a=>a.occurrence),[1,2,3,4]);assert.equal(base.appointments.length,3);
 const second=createSeries(next,{...draft,time:'17:00',count:'2',interval:'2'},students);assert.deepEqual([...new Set(second.appointments.filter(a=>a.seriesId).map(a=>a.seriesId))],[1,2]);
 const clash=createAppointment(base,{...draft,date:'2026-11-03'},students);const snapshot=structuredClone(clash);assert.throws(()=>createSeries(clash,draft,students),/Ocorrência 3/);assert.deepEqual(clash,snapshot);
});
test('series validation rejects impossible dates, unbounded counts and DST gaps/ambiguities atomically',()=>{
 const base=createDemoSchedule(),snapshot=structuredClone(base);
 for(const patch of [{date:'2026-02-30'},{date:'2026-10-19'},{date:'2100-12-31'},{count:'13'},{count:'Infinity'},{interval:'0'},{time:'23:45',duration:'30'},{date:'2026-10-25',time:'01:30'},{date:'2026-10-25',time:'00:30',duration:'120'},{date:'2027-03-28',time:'01:30'}])assert.throws(()=>createSeries(base,{...draft,...patch},students));
 assert.deepEqual(base,snapshot);
});
test('series edits use original order and preserve individual exceptions and cancelled history',()=>{
 let state=createSeries(createDemoSchedule(),draft,students);const first=state.appointments.find(a=>a.seriesId)!,second=state.appointments.find(a=>a.occurrence===2)!;
 state=rescheduleAppointment(state,second.id,{date:'2026-11-20',time:'18:00',duration:'30'},students);
 state=changeSeries(state,second.id,'following','edit','17:00','45',students);
 assert.equal(state.appointments.find(a=>a.id===first.id)?.time,'16:00');assert.equal(state.appointments.find(a=>a.id===second.id)?.date,'2026-11-20');assert.equal(state.appointments.find(a=>a.occurrence===3)?.time,'17:00');
 state=changeSeries(state,second.id,'one','cancel','','',students);const cancelled=structuredClone(state.appointments.find(a=>a.id===second.id));
 state=changeSeries(state,first.id,'all','edit','18:00','30',students);assert.deepEqual(state.appointments.find(a=>a.id===second.id),cancelled);
 assert.equal(state.appointments.filter(a=>a.seriesId&&a.status==='scheduled').length,3);
});
test('series bulk changes are atomic on late conflicts and cannot rewrite past records',()=>{
 let state=createSeries(createDemoSchedule(),draft,students);const first=state.appointments.find(a=>a.seriesId)!;
 state=createAppointment(state,{...draft,date:'2026-11-10',time:'18:00'},students);const snapshot=structuredClone(state);
 assert.throws(()=>changeSeries(state,first.id,'all','edit','18:00','30',students),/Conflito/);assert.deepEqual(state,snapshot);
 const past={...first,id:999,date:'2026-10-01'};state={...state,appointments:[...state.appointments,past]};const next=changeSeries(state,first.id,'all','cancel','','',students);assert.deepEqual(next.appointments.find(a=>a.id===999),past);assert.throws(()=>changeSeries(state,999,'one','edit','18:00','30',students));
});
test('individual series exceptions cannot bypass Lisbon DST rules or rewrite past occurrences',()=>{
 const state=createSeries(createDemoSchedule(),draft,students),first=state.appointments.find(a=>a.seriesId)!;
 for(const patch of [{date:'2026-10-25',time:'01:30',duration:'30'},{date:'2027-03-28',time:'01:30',duration:'30'},{date:'2026-10-25',time:'00:30',duration:'120'},{date:'2026-10-19',time:'16:00',duration:'30'}]){
  const next=rescheduleAppointment(state,first.id,patch,students);assert.equal(next.result?.ok,false);assert.equal(next.result?.field,patch.date<'2026-10-20'?'date':'time');assert.deepEqual(next.appointments,state.appointments);
 }
 const past={...state,appointments:state.appointments.map(a=>a.id===first.id?{...a,date:'2026-10-01'}:a)};
 assert.equal(rescheduleAppointment(past,first.id,{date:demoDate,time:'17:00',duration:'30'},students).result?.ok,false);
});
