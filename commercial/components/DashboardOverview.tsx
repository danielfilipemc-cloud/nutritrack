"use client";
import {useEffect,useState} from "react";
import DailyPriorities from "./DailyPriorities";
import {db} from "../lib/supabase";
import {clientProfileUrl,type Dashboard} from "../lib/dashboard";
import AuraIcon from './AuraIcon';
import DashboardEvolution from './DashboardEvolution';
import StudentIdentity from './StudentIdentity';
export default function DashboardOverview({org,userId,role}:{org:string;userId:string;role:'owner'|'admin'|'coach'}){
 const [loaded,setLoaded]=useState<{org:string;userId:string;data:Dashboard}|null>(null);
 const [error,setError]=useState(""),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setLoaded(null);setError("");
 void(async()=>{try{if(!db)throw Error();const r=await db.rpc("aura_care_dashboard",{p_org:org});if(!active)return;
 if(r.error||!r.data)throw Error();setLoaded({org,userId,data:r.data as Dashboard});
 }catch{if(active)setError("Não foi possível carregar o painel. Tenta novamente.");}})();return()=>{active=false;};},[org,userId,revision]);
 const data=loaded?.org===org&&loaded.userId===userId?loaded.data:null;
 const target=(path:string)=>`${path}?org=${encodeURIComponent(org)}`;
 const candidates=data?Array.from(new Map([...data.recent.filter(c=>!c.archived_at).map(c=>({id:c.client_id,full_name:c.full_name})),...data.pending].map(c=>[c.id,{id:c.id,full_name:c.full_name}])).values()):[];
 return <div className="aura-dashboard">

 {error?<section className="panel" role="alert"><p>{error}</p><button onClick={()=>setRevision(v=>v+1)}>Tentar novamente</button></section>:!data?<section className="panel" aria-busy="true"><p role="status">A carregar indicadores...</p></section>:<>
 <div className="stat" aria-label="Indicadores do estabelecimento">
 <div><AuraIcon name="students" className="aura-kpi-icon"/><span>Alunos ativos</span><strong>{data.active_clients}</strong><small>{data.archived_clients} arquivados</small></div>
 {typeof data.appointments_today==='number'&&<div><AuraIcon name="calendar" className="aura-kpi-icon"/><span>Marcações hoje</span><strong>{data.appointments_today}</strong><small>Marcações agendadas para hoje</small></div>}
 <div><AuraIcon name="assessment" className="aura-kpi-icon"/><span>Avaliações nos últimos 30 dias</span><strong>{data.assessments_30_days}</strong><small>Até {data.as_of}</small></div>
 <div><AuraIcon name="calendar" className="aura-kpi-icon"/><span>Alunos a acompanhar</span><strong>{data.pending_clients}</strong><small>Sem avaliação ou última há mais de 30 dias</small></div>
 </div>
 </>}
 <div className="aura-home-grid">
 {data&&<DashboardEvolution key={`evolution:${userId}:${org}`} org={org} userId={userId} candidates={candidates}/>}<aside className="aura-home-day" aria-label="Operação do dia"><DailyPriorities key={`schedule:${userId}:${org}`} org={org} userId={userId} mode="schedule"/>
 <section className="panel aura-home-shortcuts"><h2>Ações rápidas</h2><nav className="aura-quick-actions aura-dashboard-actions" aria-label="Operações frequentes"><a href={target('/alunos')}><AuraIcon name="students"/>Registar ou gerir aluno</a><a href={target('/avaliacoes')}><AuraIcon name="assessment"/>Registar avaliação</a><a href={target('/agenda')}><AuraIcon name="calendar"/>Abrir agenda</a>{role!=='coach'&&<><a href={target('/equipa')}><AuraIcon name="team"/>Gerir equipa</a><a href={target('/marca')}><AuraIcon name="brand"/>Personalizar marca</a></>}</nav></section>
 </aside>{data&&
 <section className="panel aura-home-attention" aria-label="Alunos que precisam de atenção"><div className="aura-section-title"><div><span className="eyebrow">ACOMPANHAMENTO</span><h2>Alunos que precisam de atenção</h2></div><a href={target('/alunos')}>Ver alunos →</a></div><p className="aura-caption">Sem avaliação recente · até 10 alunos autorizados. Sem interpretação clínica.</p>
 {!data.pending.length?<div className="aura-empty-state"><strong>Sem acompanhamento pendente</strong><p>Os alunos ativos têm avaliações recentes, ou ainda não existem alunos.</p></div>:<ul className="aura-home-students">{data.pending.map(c=><li key={c.id}><StudentIdentity name={c.full_name}><strong>{c.full_name}</strong><p>{c.assessed_on?`Última avaliação: ${c.assessed_on}`:'Sem avaliação registada'}</p></StudentIdentity><a className="outline link" href={clientProfileUrl(org,c.id)}>Abrir ficha de {c.full_name}</a></li>)}</ul>}</section>}
 <details className="aura-home-priorities panel"><summary>Prioridades de hoje · pesquisar e consultar</summary><div className="aura-dashboard-main"><DailyPriorities key={`${userId}:${org}`} org={org} userId={userId}/></div></details>
 {data&&<div className="aura-dashboard-columns">
 <details className="panel aura-dashboard-secondary aura-disclosure-panel"><summary><h2>Avaliações recentes</h2><span className="aura-caption">Últimos 30 dias · até 10</span></summary>
 {!data.recent.length?<div className="aura-empty-state"><strong>Sem avaliações recentes</strong><p>Regista uma avaliação para acompanhar a evolução dos teus alunos.</p></div>:<div className="tablewrap"><table><thead><tr><th>Aluno</th><th>Data</th><th>Estado</th></tr></thead><tbody>{data.recent.map(a=><tr key={a.id}><td><a href={clientProfileUrl(org,a.client_id)}>{a.full_name}</a></td><td>{a.assessed_on}</td><td>{a.archived_at?"Arquivado":"Ativo"}</td></tr>)}</tbody></table></div>}</details>
 </div>}

 </div></div>;
}
