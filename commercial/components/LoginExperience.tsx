import type {ReactNode} from 'react';
import AuraBrand from './AuraBrand';
import AuraIcon from './AuraIcon';

/** Presentation only: callers own authentication and recovery state. */
export default function LoginExperience({children,status,title,description}: {children:ReactNode;status:string;title?:string;description?:string}) {
 const personal=process.env.NEXT_PUBLIC_AURA_PRIVATE_PORTAL==='1';
 return <main className="aura-entry" id="main-content" tabIndex={-1}>
  <picture className="aura-entry-environment" aria-hidden="true"><source media="(min-width:801px)" srcSet="/visual/aura-professional-environment.webp"/><img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" width={1600} height={900} alt="" decoding="async"/></picture>
  <header className="aura-entry-header"><AuraBrand/><span className="aura-entry-context">{personal?'Acesso privado':'Plataforma profissional'}</span></header>
  <div className="aura-entry-layout">
   <section className="aura-entry-story" aria-labelledby="aura-entry-title">
    <h1 id="aura-entry-title">{personal?<>O teu espaço de <em>acompanhamento</em> pessoal</>:<>A tua plataforma de <em>acompanhamento</em> profissional</>}</h1>
    <p className="aura-entry-lead">{personal?<>Regista refeições e consulta as tuas referências.<br/>Uma conta própria, um acompanhamento organizado.</>:<>Gere alunos, avaliações e marcações.<br/>O teu acompanhamento, num só lugar.</>}</p>
    {!personal&&<ul className="aura-entry-features">
     <li><AuraIcon name="students"/><span><strong>Gestão de alunos</strong><small>Fichas completas e acompanhamento contínuo</small></span></li>
     <li><AuraIcon name="evolution"/><span><strong>Avaliações e evolução</strong><small>Dados organizados e gráficos intuitivos</small></span></li>
     <li><AuraIcon name="calendar"/><span><strong>Agenda e marcações</strong><small>Sessões e revisões num só calendário</small></span></li>
     <li><AuraIcon name="team"/><span><strong>Equipa e permissões</strong><small>Profissionais e acessos por estabelecimento</small></span></li>
     <li><AuraIcon name="settings"/><span><strong>Personalizado para o teu espaço</strong><small>A tua marca e as tuas cores</small></span></li>
    </ul>}
   </section>
   <section className="aura-entry-access" aria-labelledby="aura-entry-access-title">
    <div className="aura-entry-form-card"><div className="aura-entry-form-heading"><img className="aura-login-icon" src="/brand/aura-app-icon.svg" width={48} height={48} alt="" aria-hidden="true"/><span className="eyebrow">{personal?'ACESSO PRIVADO':'ACESSO PROFISSIONAL'}</span></div>
     <h2 id="aura-entry-access-title">{title||<>Bem-vindo à<br/><em>AURA</em> Business</>}</h2><p>{description||<>Entra com a tua conta e continua a gerir<br/>o teu acompanhamento.</>}</p>
     {children}
     <p role="status" className="aura-entry-status">{status}</p>
     {!personal&&<><div className="aura-entry-divider"><span>Conhece a plataforma</span></div><a href="/demo/experiencia" className="outline link aura-entry-demo-link">Explorar demonstração <AuraIcon name="arrow"/></a></>}
     <p className="aura-entry-student-link">És aluno? <a href="/aluno">Acede à tua área</a> · <a href="/instalar">Instalar no telemóvel</a></p>
    </div>
    <p className="aura-entry-access-note">A tua marca. O teu acompanhamento.<br/>Uma experiência AURA Business.</p>
   </section>
  </div>
  <footer className="aura-entry-footer"><span>AURA Business</span><span>Gestão de acompanhamento profissional</span></footer>
 </main>;
}
