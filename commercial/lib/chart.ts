export type ChartPoint={date:string;value:number|null};
export function chartData(records:ChartPoint[]){
 return records.filter((p):p is {date:string;value:number}=>p.value!==null&&Number.isFinite(p.value)&&Number.isFinite(Date.parse(p.date))).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30);
}
export function timePosition(date:string,first:string,last:string){const span=Date.parse(last)-Date.parse(first);return span===0?340:50+580*(Date.parse(date)-Date.parse(first))/span;}
