"use client";
import ProfessionalShell from "../../components/ProfessionalShell";
import OrganizationSelect from "../../components/OrganizationSelect";
import {useProfessional} from "../../lib/use-professional";
export default function Settings(){
 const {user,org,orgs,setOrg,status}=useProfessional();
 const manager=orgs.some(o=>o.id===org&&(o.role==='owner'||o.role==='admin'));
 return <ProfessionalShell title="Definições" context={user&&<OrganizationSelect organizations={orgs} value={org} onChange={setOrg}/>}>
 <div className="heading"><div><span className="eyebrow">ESTABELECIMENTO E CONTA</span><h1>Definições</h1><p>Segurança e gestão de acesso, num só lugar.</p></div></div>
 {!user?<p role="status">{status} <a href="/">Iniciar sessão</a></p>:<div className="aura-module-grid"><section className="panel"><span className="eyebrow">PESSOAL</span><h2>Segurança da conta</h2><p>Configura o segundo fator e consulta as opções de sessão.</p><a className="outline link" href={`/seguranca?org=${org}`}>Gerir segurança</a></section>{manager&&<section className="panel"><span className="eyebrow">ORGANIZAÇÃO</span><h2>Competências e atribuições</h2><p>Define os profissionais autorizados a acompanhar cada aluno.</p><a className="outline link" href={`/acessos?org=${org}`}>Gerir competências</a></section>}</div>}
 </ProfessionalShell>;
}
