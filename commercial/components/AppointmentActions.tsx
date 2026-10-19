"use client";
import {useEffect,useRef,type ReactNode} from 'react';

/** Keep controls mounted: collapsing a row never resets pending work or drafts. */
export default function AppointmentActions({children,name}:{children:ReactNode;name:string}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const media=window.matchMedia('(min-width:901px)');const update=()=>{if(ref.current)ref.current.open=media.matches;};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return <details ref={ref} className="aura-appointment-actions"><summary aria-label={`Mais ações da marcação de ${name}`}>Mais ações</summary><div className="aura-quick-actions">{children}</div></details>;
}
