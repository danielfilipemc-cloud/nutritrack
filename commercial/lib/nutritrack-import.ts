import {measurement,validDate} from './validation';
export type SourceContent={observed_on:string;weight_kg:number|null;height_cm:number|null;waist_cm:number|null};
export type ImportRecord=SourceContent&{source_record_id:string;expected_revision:number};
export type ImportContext={link:{id:string;source_subject:string;active:boolean}|null;can_manage:boolean;records:{source_record_id:string;revision:number;content:SourceContent;superseded:boolean}[]};
/** Adapter for index.html exportBackup v2. Never transmits the rest of the backup. */
export function parseNutritrackBackup(text:string,today:string):ImportRecord[]{
 if(new TextEncoder().encode(text).length>2_000_000)throw Error('O ficheiro excede 2 MB.');
 let raw:any;try{raw=JSON.parse(text);}catch{throw Error('O ficheiro não contém JSON válido.');}
 if(raw?.app!=='NutriTrack Pro'||raw?.version!==2||!raw.data||typeof raw.data!=='object')throw Error('É necessário um backup NutriTrack Pro versão 2.');
 const weights=raw.data.weightLog??[],measures=raw.data.bodyMeasurements??[];
 if(!Array.isArray(weights)||!Array.isArray(measures)||weights.length+measures.length>5000)throw Error('Formato ou dimensão do histórico inválidos.');
 const days=new Map<string,ImportRecord>();
 const add=(entry:any,body:boolean)=>{
  if(!entry||typeof entry!=='object'||!validDate(entry.date)||entry.date<'2000-01-01'||entry.date>today)throw Error('O histórico contém uma data inválida ou futura.');
  const numeric=(value:unknown,max:number,decimals:number)=>{if(value===null||value===undefined)return null;if(typeof value!=='number')throw Error('As medições devem ser números.');try{return measurement(String(value),max,decimals);}catch{throw Error('Existe uma medição fora dos limites ou precisão suportados.');}};
  const weight=numeric(entry.weight,500,2),waist=body?numeric(entry.waist,300,1):null;
  // Hip/chest/arm/thigh, meals and profile are outside this first integration.
  if(weight===null&&waist===null)return;
  const previous=days.get(entry.date);
  if(previous&&weight!==null&&previous.weight_kg!==null&&weight!==previous.weight_kg)throw Error(`Pesos diferentes no mesmo dia (${entry.date}); revê o backup antes de importar.`);
  if(previous&&waist!==null&&previous.waist_cm!==null&&waist!==previous.waist_cm)throw Error(`Cinturas diferentes no mesmo dia (${entry.date}); revê o backup antes de importar.`);
  days.set(entry.date,{source_record_id:'day:'+entry.date,observed_on:entry.date,weight_kg:weight??previous?.weight_kg??null,height_cm:null,waist_cm:waist??previous?.waist_cm??null,expected_revision:0});
 };
 weights.forEach(e=>add(e,false));measures.forEach(e=>add(e,true));
 const records=[...days.values()].sort((a,b)=>a.observed_on.localeCompare(b.observed_on));
 if(!records.length||records.length>2000)throw Error('Seleciona um backup com 1 a 2000 dias de medições suportadas.');
 return records;
}
export function selectNutritrackWindow(records:ImportRecord[],from:string,to:string){
 if(!validDate(from)||!validDate(to)||from>to)throw Error('Indica um período válido.');
 const rows=records.filter(r=>r.observed_on>=from&&r.observed_on<=to);
 if(!rows.length||rows.length>50)throw Error('Escolhe um período com 1 a 50 dias de medições por importação.');
 return rows;
}
export function previewNutritrack(records:ImportRecord[],context:ImportContext){
 return records.map(record=>{const old=context.records.find(r=>r.source_record_id===record.source_record_id);
  const equal=old&&(['observed_on','weight_kg','height_cm','waist_cm'] as const).every(key=>old.content[key]===record[key]);
  return {record:{...record,expected_revision:old?.revision??0},status:!old?'new':equal?'duplicate':old.superseded?'blocked':'update'};
 });
}
export const syntheticNutritrackBackup={app:'NutriTrack Pro',version:2,exportedAt:'2026-10-16T00:00:00Z',data:{weightLog:[{date:'2026-10-15',weight:80}],bodyMeasurements:[{date:'2026-10-15',weight:80,waist:90}],nutritrackData:{}}};
