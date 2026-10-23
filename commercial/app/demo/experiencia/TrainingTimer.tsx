"use client";
import {useEffect,useState} from 'react';
type Timer={duration:number;remaining:number;deadline:number|null};
const initial:Timer={duration:60,remaining:60,deadline:null};
export default function TrainingTimer({studentId}:{studentId:number}){
 const [timers,setTimers]=useState<Record<number,Timer>>({});const timer=timers[studentId]||initial;
 const running=Object.values(timers).some(t=>t.deadline!==null);
 useEffect(()=>{if(!running)return;const interval=setInterval(()=>setTimers(current=>Object.fromEntries(Object.entries(current).map(([id,t])=>{if(t.deadline===null)return [id,t];const remaining=Math.max(0,Math.ceil((t.deadline-Date.now())/1000));return [id,{...t,remaining,deadline:remaining?t.deadline:null}];}))),250);return()=>clearInterval(interval);},[running]);
 const update=(next:Timer)=>setTimers(v=>({...v,[studentId]:next}));
 return <section className="aura-training-timer" aria-label="Temporizador de descanso"><h3>Descanso de exemplo</h3><label>Duração do temporizador<select value={timer.duration} onChange={e=>{const n=Number(e.target.value);update({duration:n,remaining:n,deadline:null});}}>{[30,60,90,120].map(n=><option key={n} value={n}>{n} segundos</option>)}</select></label><output role="timer" aria-label="Tempo de descanso restante">{Math.floor(timer.remaining/60)}:{String(timer.remaining%60).padStart(2,'0')}</output><div className="aura-training-buttons"><button type="button" disabled={timer.deadline!==null||timer.remaining===0} onClick={()=>update({...timer,deadline:Date.now()+timer.remaining*1000})}>Iniciar descanso</button><button type="button" disabled={timer.deadline===null} onClick={()=>update({...timer,remaining:Math.max(0,Math.ceil((timer.deadline!-Date.now())/1000)),deadline:null})}>Pausar descanso</button><button type="button" onClick={()=>update({...timer,remaining:timer.duration,deadline:null})}>Repor descanso</button></div>{timer.remaining===0&&<p role="status">Tempo de exemplo terminado.</p>}<p className="aura-preview-note">Temporizador local, separado por aluno. Mantém o prazo ao navegar; sem som ou notificações.</p></section>;
}
