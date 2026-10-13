"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";

const links=[
 {href:"/",label:"Visão geral",shortLabel:"Início",glyph:"▦"},
 {href:"/alunos",label:"Alunos",shortLabel:"Alunos",glyph:"◎"},
 {href:"/avaliacoes",label:"Avaliações",shortLabel:"Avaliar",glyph:"↗"},
 {href:"/equipa",label:"Equipa e convites",shortLabel:"Equipa",glyph:"♧"},
 {href:"/marca",label:"A tua marca",shortLabel:"Marca",glyph:"◈"},
] as const;

export default function AppNavigation(){
 const path=usePathname();
 return <nav className="aura-app-nav" aria-label="Navegação principal">
  <div className="aura-app-nav__brand"><span className="aura-app-nav__mark" aria-hidden="true">◉</span><span>AURA <strong>Business</strong></span></div>
  <div className="aura-app-nav__links">
   {links.map(link=><Link key={link.href} href={link.href} aria-current={(path===link.href||(link.href!=="/"&&path.startsWith(link.href+"/")))?"page":undefined} className={(path===link.href||(link.href!=="/"&&path.startsWith(link.href+"/")))?"is-active":undefined}><span aria-hidden="true">{link.glyph}</span><span className="aura-nav-label-desktop">{link.label}</span><span className="aura-nav-label-mobile">{link.shortLabel}</span></Link>)}
  </div>
  <div className="aura-app-nav__foot">Gestão profissional · Versão de desenvolvimento</div>
 </nav>;
}
