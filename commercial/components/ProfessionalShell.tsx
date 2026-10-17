"use client";
import type {ReactNode} from "react";
import {usePathname} from "next/navigation";
import AppNavigation from "./AppNavigation";
import SessionActions from "./SessionActions";

export default function ProfessionalShell({title, children, context}: {title: string; children: ReactNode; context?:ReactNode}) {
  const path=usePathname();
  return <div className="aura-workspace"><AppNavigation/><main className="shell" id="main-content" tabIndex={-1}>
    <header className="aura-workspace-header"><nav aria-label="Localização"><ol className="aura-breadcrumbs"><li><a href="/">AURA Business</a></li>{path.startsWith('/alunos/')&&<li><a href="/alunos">Alunos</a></li>}<li aria-current="page">{title}</li></ol></nav><SessionActions/></header>
    {context&&<div className="aura-workspace-context">{context}</div>}
    {children}
    <footer>AURA Business · Demonstração com dados fictícios.</footer>
  </main></div>;
}
