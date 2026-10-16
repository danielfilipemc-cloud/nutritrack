import {addDays} from './care';
export type EvolutionRecord = {id:string;assessed_on:string;weight_kg:number|null;height_cm:number|null;waist_cm:number|null;superseded_at:string|null};
export type EvolutionMetric = 'weight_kg'|'height_cm'|'waist_cm';
export function evolutionStart(today:string,days:number){return days===0?null:addDays(today,1-days);}
export function evolutionSeries(records:EvolutionRecord[],metric:EvolutionMetric,today:string,days:number){
 const start=evolutionStart(today,days);
 return records.filter(r=>!r.superseded_at&&r.assessed_on<=today&&(!start||r.assessed_on>=start)&&r[metric]!==null&&Number.isFinite(r[metric]))
  .sort((a,b)=>a.assessed_on.localeCompare(b.assessed_on)||a.id.localeCompare(b.id))
  .map(r=>({date:r.assessed_on,value:r[metric] as number}));
}
export function evolutionChange(points:{value:number}[]){return points.length<2?null:Math.round((points.at(-1)!.value-points[0].value)*100)/100;}

/** Keep each request below the reviewed PostgREST cap (1000), including lookahead.
 * A failed/cancelled page never publishes a partial window as complete.
 */
export async function loadEvolutionWindow<T>(read:(offset:number,size:number)=>Promise<T[]>,limit:number,current=()=>true){
 if(!Number.isInteger(limit)||limit<1||limit>2000)throw new RangeError('Invalid evolution window');
 const rows:T[]=[];
 while(rows.length<limit+1){
  if(!current())return null;
  const size=Math.min(201,limit+1-rows.length),page=await read(rows.length,size);
  if(!current())return null;
  if(page.length>size)throw new Error('Evolution response exceeded requested page');
  rows.push(...page);
  if(page.length<size)break;
 }
 return {rows:rows.slice(0,limit),more:rows.length>limit};
}
