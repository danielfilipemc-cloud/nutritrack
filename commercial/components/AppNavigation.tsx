"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";

const links=[
 {href:"/",label:"Visão geral",glyph:"▦"},
 {href:"/avaliacoes",label:"Alunos e avaliações",glyph:"◎"},
 {href:"/equipa",label:"Equipa e convites",glyph:"♧"},
 {href:"/marca",label:"A tua marca",glyph:"◈"},
] as const;

export default function AppNavigation(){
 const path=usePathname();
 return <nav className="aura-app-nav" aria-label="Navegação principal">
  <div className="aura-app-nav__brand"><span className="aura-app-nav__mark" aria-hidden="true">◉</span><span>AURA <strong>Business</strong></span></div>
  <div className="aura-app-nav__links">
   {links.map(link=><Link key={link.href} href={link.href} aria-current={path===link.href?"page":undefined} className={path===link.href?"is-active":undefined}><span aria-hidden="true">{link.glyph}</span>{link.label}</Link>)}
  </div>
  <div className="aura-app-nav__foot">Gestão profissional · Versão de desenvolvimento</div>
 </nav>;
}
