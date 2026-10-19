import type {ReactNode} from 'react';
import AuraBrand from './AuraBrand';
import AuraIcon from './AuraIcon';

/** Presentation only: the existing Home component owns all authentication state. */
export default function LoginExperience({children,status}: {children:ReactNode;status:string}) {
 return <main className="aura-entry" id="main-content" tabIndex={-1}>
  <header className="aura-entry-header"><AuraBrand/><span className="aura-entry-context">Plataforma profissional</span></header>
  <div className="aura-entry-layout">
   <section className="aura-entry-story" aria-labelledby="aura-entry-title">
    <span className="eyebrow">O TEU NEGÓCIO. MAIS PRÓXIMO.</span>
    <h1 id="aura-entry-title">O teu espaço de acompanhamento, <br/><em>organizado.</em></h1>
    <p className="aura-entry-lead">Mais clareza no teu dia. Mais atenção a cada aluno.</p>
    <div className="aura-entry-art" aria-hidden="true"><div className="aura-entry-orbit"/><div className="aura-entry-orbit aura-entry-orbit--outer"/><img src="/brand/aura-symbol.svg" width={264} height={256} alt="" decoding="async"/><span className="aura-entry-orbit-point"/></div>
    <ul className="aura-entry-features"><li><AuraIcon name="students"/><span>Alunos e avaliações</span></li><li><AuraIcon name="calendar"/><span>Agenda e acompanhamento</span></li><li><AuraIcon name="brand"/><span>A identidade do teu estabelecimento</span></li></ul>
   </section>
   <section className="aura-entry-access" aria-labelledby="aura-entry-access-title">
    <div className="aura-entry-form-card"><div className="aura-entry-form-heading"><img className="aura-login-icon" src="/brand/aura-app-icon.svg" width={48} height={48} alt="" aria-hidden="true"/><span className="eyebrow">ACESSO PROFISSIONAL</span></div>
     <h2 id="aura-entry-access-title">Bem-vindo à AURA.</h2><p>Entra com uma conta autorizada pelo teu estabelecimento.</p>
     {children}
     <p role="status" className="aura-entry-status">{status}</p>
     <div className="aura-entry-divider"><span>Conhece a plataforma</span></div>
     <a href="/demo" className="outline link aura-entry-demo-link">Explorar demonstração <AuraIcon name="arrow"/></a>
     <p className="aura-entry-student-link">És aluno? <a href="/aluno">Acede à tua área</a></p>
    </div>
    <p className="aura-entry-access-note">A tua marca. O teu acompanhamento.<br/>Uma experiência AURA Business.</p>
   </section>
  </div>
  <footer className="aura-entry-footer"><span>AURA Business</span><span>Gestão de acompanhamento profissional</span></footer>
 </main>;
}
