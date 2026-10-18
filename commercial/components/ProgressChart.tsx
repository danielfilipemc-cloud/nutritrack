"use client";
import {chartData,timePosition,type ChartPoint} from "../lib/chart";
import {useEffect,useRef,useState} from "react";
export default function ProgressChart({records,unit,maxPoints=30,responsive=false}:{records:ChartPoint[];unit:string;maxPoints?:number;responsive?:boolean}){
 const container=useRef<HTMLDivElement>(null),[width,setWidth]=useState(680);
 const data=chartData(records,maxPoints);
 const hasData=data.length>0;
 useEffect(()=>{if(!responsive||!hasData||!container.current)return;const observer=new ResizeObserver(entries=>{const size=entries[0]?.contentRect.width;if(size)setWidth(Math.min(680,Math.max(320,Math.round(size))));});observer.observe(container.current);return()=>observer.disconnect();},[responsive,hasData]);
 if(data.length===0)return <p>Regista avaliações para visualizar a evolução.</p>;
 const min=Math.min(...data.map(p=>p.value)),max=Math.max(...data.map(p=>p.value));
 const pad=Math.max((max-min)*.12,.5),lo=min-pad,hi=max+pad;
 const right=width===680?630:width-20,left=width===680?50:44;
 const X=(i:number)=>left+(right-left)*(timePosition(data[i].date,data[0].date,data[data.length-1].date)-50)/580;
 const Y=(n:number)=>205-165*(n-lo)/(hi-lo);
 const coordinates=data.map((p,i)=>`${X(i)},${Y(p.value)}`).join(" ");
 return <div className="chartbox" ref={container}>
 <svg viewBox={`0 0 ${width} 250`} role="img" aria-label={`Evolução: ${data.length} medições, de ${data[0].value} a ${data[data.length-1].value} ${unit}`}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1={left} y1={40+i*41.25} x2={right} y2={40+i*41.25} stroke="var(--aura-chart-grid, #354541)"/><text x={left-6} y={44+i*41.25} textAnchor="end" fontSize="12" fill="var(--aura-chart-label, #B8CAC5)">{(hi-i*(hi-lo)/4).toFixed(1)}</text></g>)}
 <polyline points={coordinates} fill="none" stroke="var(--aura-chart-stroke, #70D6CA)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
 {data.map((p,i)=><circle key={i} cx={X(i)} cy={Y(p.value)} r="4.5" fill="var(--aura-chart-stroke, #70D6CA)"><title>{p.date}: {p.value} {unit}</title></circle>)}
 <text x={left} y="238" fontSize="12" fill="var(--aura-chart-label, #B8CAC5)">{data[0].date}</text><text x={right} y="238" textAnchor="end" fontSize="12" fill="var(--aura-chart-label, #B8CAC5)">{data[data.length-1].date}</text>
 </svg><p className="chartnote">{data.length} medições apresentadas · Última: {data[data.length-1].value} {unit}</p><details><summary>Consultar medições em tabela</summary><table><caption>Medições apresentadas ({unit})</caption><thead><tr><th scope="col">Data</th><th scope="col">Valor ({unit})</th></tr></thead><tbody>{data.map((p,i)=><tr key={i}><td>{p.date}</td><td>{p.value}</td></tr>)}</tbody></table></details></div>;
}
