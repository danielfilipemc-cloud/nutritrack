"use client";
import {useEffect,useState,type FormEvent} from "react";
import {db} from "../lib/supabase";
import {useProfessional} from "../lib/use-professional";
import ProfessionalShell from "../components/ProfessionalShell";
import OrganizationSelect from "../components/OrganizationSelect";
import TenantBrand from "../components/TenantBrand";
import DashboardOverview from "../components/DashboardOverview";
export default function Home(){
 const {user,org,orgs,setOrg,status,authLoading,refreshOrganizations}=useProfessional();
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('sessao')==='revogacao-pendente'){
  setMessage('Não foi possível confirmar o fim das restantes sessões. A sessão local foi removida. Volta a entrar para tentar novamente.');
  window.history.replaceState(null,'',window.location.pathname);
 }},[]);
 async function login(event:FormEvent){event.preventDefault();if(!db||busy)return;setBusy(true);setMessage("A autenticar...");
 try{const {error}=await db.auth.signInWithPassword({email:email.trim(),password});setPassword("");setMessage(error?"Credenciais inválidas ou acesso indisponível.":"");}catch{setMessage("Não foi possível iniciar sessão.");}finally{setBusy(false);}}
 if(authLoading)return <main className="shell"><p role="status">A verificar sessão...</p></main>;
 if(!user)return <main className="shell" id="main-content"><header><strong>AURA <span>Business</span></strong><p>Gestão de acompanhamento profissional</p></header><section className="login"><span className="eyebrow">ACESSO PROFISSIONAL</span><h1>O teu espaço de acompanhamento, organizado.</h1><p>Entra com uma conta autorizada pelo teu estabelecimento.</p><form onSubmit={login}><label>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Palavra-passe<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button disabled={!db||busy}>Entrar na plataforma</button></form><p role="status">{message||status}</p><a href="/demo" className="outline link">Explorar demonstração →</a><p><a href="/aluno">Área do aluno</a></p></section></main>;
 return <ProfessionalShell title="Gestão de acompanhamento profissional"><div className="heading"><div><span className="eyebrow">PAINEL PROFISSIONAL</span><h1>Visão geral</h1><p>O acompanhamento diário do teu estabelecimento.</p></div><OrganizationSelect organizations={orgs} value={org} onChange={setOrg}/></div>
 {org?<><TenantBrand key={`brand:${user.id}:${org}`} org={org} name={orgs.find(o=>o.id===org)?.name||"AURA"} subtitle="Painel do estabelecimento"/><DashboardOverview key={`dashboard:${user.id}:${org}`} org={org} userId={user.id}/></>:<section className="panel"><p role="status">{status}</p><button className="outline" onClick={refreshOrganizations}>Atualizar estabelecimentos</button><p><a href="/convite">Aceitar convite</a> · <a href="/aluno">Área do aluno</a></p></section>}
 <p role="status" className="status">{message}</p></ProfessionalShell>;
}
