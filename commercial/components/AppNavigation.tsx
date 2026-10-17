"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useRef} from "react";
const groups = [
 {name:"Operação",links:[["/","Visão geral"],["/alunos","Alunos"],["/agenda","Agenda"]]},
 {name:"Acompanhamento",links:[["/avaliacoes","Avaliações"],["/evolucao","Evolução"]]},
 {name:"Estabelecimento",links:[["/equipa","Equipa e convites"],["/marca","A tua marca"],["/definicoes","Definições"]]},
];
export default function AppNavigation(){
 const path=usePathname();
 const disclosure=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const media=window.matchMedia('(min-width: 901px)');const update=()=>{if(disclosure.current)disclosure.current.open=media.matches;};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[path]);
 return <aside className="aura-sidebar"><div className="aura-app-nav__brand"><span className="aura-app-nav__mark" aria-hidden="true">A</span><span>AURA <strong>Business</strong></span></div>
 <details ref={disclosure} className="aura-nav-disclosure"><summary>Menu principal</summary><nav className="aura-app-nav" aria-label="Navegação principal"><div className="aura-app-nav__links">
 {groups.map(group=><div className="aura-nav-group" key={group.name}><p>{group.name}</p>{group.links.map(([href,label])=>{
 const active=path===href||(href!=="/"&&path.startsWith(href+"/"));
 return <Link key={href} href={href} aria-current={active?"page":undefined} className={active?"is-active":undefined}><span className="aura-nav-indicator" aria-hidden="true"/><span className="aura-nav-label-desktop">{label}</span></Link>;
 })}</div>)}
 </div></nav></details><div className="aura-app-nav__foot">O teu negócio.<br/>Mais próximo dos teus alunos.<small>Ambiente de demonstração</small></div></aside>;
}
