"use client";
import {chartData,timePosition,type ChartPoint} from "../lib/chart";
export default function ProgressChart({records,unit}:{records:ChartPoint[];unit:string}){
 const data=chartData(records);
 if(data.length===0)return <p>Regista avaliações para visualizar a evolução.</p>;
 const min=Math.min(...data.map(p=>p.value)),max=Math.max(...data.map(p=>p.value));
 const pad=Math.max((max-min)*.12,.5),lo=min-pad,hi=max+pad;
 const X=(i:number)=>timePosition(data[i].date,data[0].date,data[data.length-1].date);
 const Y=(n:number)=>205-165*(n-lo)/(hi-lo);
 const coordinates=data.map((p,i)=>`${X(i)},${Y(p.value)}`).join(" ");
 return <div className="chartbox">
 <svg viewBox="0 0 680 250" role="img" aria-label={`Evolução: ${data.length} medições, de ${data[0].value} a ${data[data.length-1].value} ${unit}`}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1="50" y1={40+i*41.25} x2="630" y2={40+i*41.25} stroke="#e5ebee"/><text x="44" y={44+i*41.25} textAnchor="end" fontSize="12" fill="#66777f">{(hi-i*(hi-lo)/4).toFixed(1)}</text></g>)}
 <polyline points={coordinates} fill="none" stroke="#137F79" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
 {data.map((p,i)=><circle key={i} cx={X(i)} cy={Y(p.value)} r="4" fill="#137F79"><title>{p.date}: {p.value} {unit}</title></circle>)}
 <text x="50" y="238" fontSize="12" fill="#66777f">{data[0].date}</text><text x="630" y="238" textAnchor="end" fontSize="12" fill="#66777f">{data[data.length-1].date}</text>
 </svg><p className="chartnote">{data.length} medições apresentadas · Última: {data[data.length-1].value} {unit}</p><details><summary>Consultar medições em tabela</summary><table><thead><tr><th>Data</th><th>Valor ({unit})</th></tr></thead><tbody>{data.map((p,i)=><tr key={i}><td>{p.date}</td><td>{p.value}</td></tr>)}</tbody></table></details></div>;
}
