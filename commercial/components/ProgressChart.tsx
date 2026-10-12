"use client";
type Point = {date:string;value:number|null};
export default function ProgressChart({records,unit}:{records:Point[];unit:string}){
 const data=records.filter((p):p is {date:string;value:number}=>p.value!==null&&Number.isFinite(p.value))
   .sort((a,b)=>a.date.localeCompare(b.date)).slice(-30);
 if(data.length===0)return <p>Regista avaliações para visualizar a evolução.</p>;
 const min=Math.min(...data.map(p=>p.value)),max=Math.max(...data.map(p=>p.value));
 const pad=Math.max((max-min)*.12,.5),lo=min-pad,hi=max+pad;
 const X=(i:number)=>50+(data.length===1?290:i*580/(data.length-1));
 const Y=(n:number)=>205-165*(n-lo)/(hi-lo);
 const coordinates=data.map((p,i)=>`${X(i)},${Y(p.value)}`).join(" ");
 return <div className="chartbox">
 <svg viewBox="0 0 680 250" role="img" aria-label={`Evolução: ${data.length} medições, de ${data[0].value} a ${data[data.length-1].value} ${unit}`}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1="50" y1={40+i*41.25} x2="630" y2={40+i*41.25} stroke="#e5ebee"/><text x="44" y={44+i*41.25} textAnchor="end" fontSize="12" fill="#66777f">{(hi-i*(hi-lo)/4).toFixed(1)}</text></g>)}
 <polyline points={coordinates} fill="none" stroke="#1d856e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
 {data.map((p,i)=><circle key={i} cx={X(i)} cy={Y(p.value)} r="4" fill="#1d856e"><title>{p.date}: {p.value} {unit}</title></circle>)}
 <text x="50" y="238" fontSize="12" fill="#66777f">{data[0].date}</text><text x="630" y="238" textAnchor="end" fontSize="12" fill="#66777f">{data[data.length-1].date}</text>
 </svg><p className="chartnote">{data.length} medições apresentadas · Última: {data[data.length-1].value} {unit}</p></div>;
}
