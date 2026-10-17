import type {ReactNode} from "react";
import AppNavigation from "./AppNavigation";
import SessionActions from "./SessionActions";

export default function ProfessionalShell({title, children}: {title: string; children: ReactNode}) {
  return <div className="aura-workspace"><AppNavigation/><main className="shell" id="main-content" tabIndex={-1}>
    <header><div><strong>AURA <span>Business</span></strong><p>{title}</p></div>
      <a className="outline link" href="/">Painel principal</a><SessionActions/></header>
    {children}
    <footer>AURA Business · Demonstração com dados fictícios.</footer>
  </main></div>;
}
