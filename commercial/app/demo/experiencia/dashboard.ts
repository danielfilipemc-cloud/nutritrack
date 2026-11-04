import {demoDate,type DemoStudent,type DemoAppointment} from './model';
import {reviewPriorities} from './followup';
import {sortedAppointments,weekStart,shiftDemoDate} from './appointments';
import {validDate} from '../../../lib/validation';

// One projection of saved synthetic state. Drafts and browser time are not inputs.
export function dashboardSnapshot(students:DemoStudent[],appointments:DemoAppointment[],reference=demoDate){
 if(!validDate(reference)||reference<'2000-01-01'||reference>'2100-12-31')throw Error('Referência inválida.');
 const ids=new Set(students.map(s=>s.id));
 const active=sortedAppointments(appointments).filter(a=>a.status==='scheduled'&&ids.has(a.studentId));
 const day=active.filter(a=>a.date===reference),start=weekStart(reference),end=shiftDemoDate(start,6);
 const week=active.filter(a=>a.date>=start&&a.date<=end);
 const days=Array.from({length:7},(_,i)=>{const date=shiftDemoDate(start,i),rows=week.filter(a=>a.date===date);return {date,count:rows.length,minutes:rows.reduce((n,a)=>n+a.duration,0)};});
 const priorities=reviewPriorities(students,reference);
 return {reference,start,end,day,week,days,priorities,next:active.find(a=>a.date>=reference),
  counts:{students:students.length,day:day.length,withWeight:students.filter(s=>s.assessments.some(a=>a.weight!==null)).length,priorities:priorities.length},
  weekMinutes:days.reduce((n,d)=>n+d.minutes,0)};
}
