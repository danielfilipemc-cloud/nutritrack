import {validateLisbonAppointment} from './local-time';
import {createAppointment,shiftDemoDate,type AppointmentDraft,type DemoSchedule} from './appointments';
import {demoDate,type DemoStudent} from './model';

export type SeriesScope='one'|'following'|'all';
export type SeriesDraft=AppointmentDraft&{count:string;interval:string};
export function createSeries(state:DemoSchedule,draft:SeriesDraft,students:DemoStudent[]):DemoSchedule {
 if(!['2','3','4','5','6','7','8','9','10','11','12'].includes(draft.count)||!['1','2'].includes(draft.interval))throw Error('Escolhe 2 a 12 ocorrências e um intervalo de uma ou duas semanas.');
 if(draft.date<demoDate)throw Error('Uma série nova deve começar na data de referência ou depois.');
 let next=state;const seriesId=Math.max(0,...state.appointments.map(a=>a.seriesId||0))+1;
 for(let index=0;index<Number(draft.count);index++){
  // Validate the first date before shifting it; invalid dates must not reach Date arithmetic.
  const date=index===0?draft.date:shiftDemoDate(draft.date,index*7*Number(draft.interval));
  next=createAppointment(next,{...draft,date},students);
  if(!next.result?.ok)throw Error(`Ocorrência ${index+1}: ${next.result?.text||'não foi possível criar'}`);
  validateLisbonAppointment(date,draft.time,draft.duration);
  const id=next.result.created!.id;next={...next,appointments:next.appointments.map(a=>a.id===id?{...a,seriesId,occurrence:index+1}:a)};
 }
 return {...next,sequence:state.sequence+1,result:{ok:true,text:`Série fictícia criada com ${draft.count} ocorrências. Nada foi enviado.`}};
}
export function changeSeries(state:DemoSchedule,id:number,scope:SeriesScope,operation:'edit'|'cancel',time:string,duration:string,students:DemoStudent[]):DemoSchedule {
 if(!['one','following','all'].includes(scope)||!['edit','cancel'].includes(operation))throw Error('Escolhe uma operação e um âmbito válidos.');
 const selected=state.appointments.find(a=>a.id===id&&a.seriesId&&a.status==='scheduled');
 if(!selected||selected.date<demoDate)throw Error('Escolhe uma ocorrência ativa na data de referência ou depois.');
 const targets=state.appointments.filter(a=>a.seriesId===selected.seriesId&&a.status==='scheduled'&&a.date>=demoDate&&(scope==='all'||scope==='one'&&a.id===id||scope==='following'&&(a.occurrence||0)>=(selected.occurrence||0)));
 const ids=new Set(targets.map(a=>a.id));
 if(operation==='cancel')return {...state,sequence:state.sequence+1,appointments:state.appointments.map(a=>ids.has(a.id)?{...a,status:'cancelled'}:a),result:{ok:true,text:`${targets.length} ocorrência(s) cancelada(s) no exemplo. Histórico e exceções preservados.`}};
 let validation={...state,appointments:state.appointments.filter(a=>!ids.has(a.id))};
 for(const original of targets){validation=createAppointment(validation,{studentId:String(original.studentId),kind:original.kind,date:original.date,time,duration},students);if(!validation.result?.ok)throw Error(`Conflito em ${original.date}: ${validation.result?.text}`);validateLisbonAppointment(original.date,time,duration);}
 return {...state,sequence:state.sequence+1,appointments:state.appointments.map(a=>ids.has(a.id)?{...a,time,duration:Number(duration)}:a),result:{ok:true,text:`${targets.length} ocorrência(s) atualizada(s) no exemplo. Datas e identificadores preservados.`}};
}
