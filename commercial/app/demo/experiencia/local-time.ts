export class DemoLocalTimeError extends Error {}
function lisbonOffset(date:string,time:string):number {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const stamp=Date.parse(`${date}T${time}:00Z`);
 if(!Number.isFinite(stamp))throw new DemoLocalTimeError('Indica uma data e hora válidas.');
 const matches=[0,1].filter(offset=>{const p=Object.fromEntries(parts.formatToParts(new Date(stamp-offset*3600000)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`===`${date}T${time}`;});
 if(matches.length!==1)throw new DemoLocalTimeError('Hora inexistente ou ambígua em Europe/Lisbon. Escolhe outro horário.');
 return matches[0];
}
export function validateLisbonAppointment(date:string,time:string,duration:string){
 const offset=lisbonOffset(date,time),end=new Date(`${date}T${time}:00Z`);end.setUTCMinutes(end.getUTCMinutes()+Number(duration));
 if(!Number.isFinite(end.getTime())||offset!==lisbonOffset(end.toISOString().slice(0,10),end.toISOString().slice(11,16)))throw new DemoLocalTimeError('A ocorrência atravessa uma mudança de hora. Escolhe outro horário.');
}
