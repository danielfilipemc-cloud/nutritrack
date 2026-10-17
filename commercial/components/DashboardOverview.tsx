"use client";
import {useEffect,useState} from "react";
import DailyPriorities from "./DailyPriorities";
import {db} from "../lib/supabase";
import {clientProfileUrl,type Dashboard} from "../lib/dashboard";
export default function DashboardOverview({org,userId,role}:{org:string;userId:string;role:'owner'|'admin'|'coach'}){
 const [loaded,setLoaded]=useState<{org:string;userId:string;data:Dashboard}|null>(null);
 const [error,setError]=useState(""),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setLoaded(null);setError("");
 void(async()=>{try{if(!db)throw Error();const r=await db.rpc("aura_care_dashboard",{p_org:org});if(!active)return;
 if(r.error||!r.data)throw Error();setLoaded({org,userId,data:r.data as Dashboard});
 }catch{if(active)setError("Não foi possível carregar o painel. Tenta novamente.");}})();return()=>{active=false;};},[org,userId,revision]);
 const data=loaded?.org===org&&loaded.userId===userId?loaded.data:null;
 const target=(path:string)=>`${path}?org=${encodeURIComponent(org)}`;
 return <>

 {error?<section className="panel" role="alert"><p>{error}</p><button onClick={()=>setRevision(v=>v+1)}>Tentar novamente</button></section>:!data?<section className="panel" aria-busy="true"><p role="status">A carregar indicadores...</p></section>:<>
 <div className="stat" aria-label="Indicadores do estabelecimento">
 <div><span>Alunos ativos</span><strong>{data.active_clients}</strong><small>{data.archived_clients} arquivados</small></div>
 <div><span>Avaliações nos últimos 30 dias</span><strong>{data.assessments_30_days}</strong><small>Até {data.as_of}</small></div>
 <div><span>Alunos a acompanhar</span><strong>{data.pending_clients}</strong><small>Sem avaliação ou última há mais de 30 dias</small></div>
 </div>
 </>}
 <section className="panel aura-shortcuts-panel"><h2>Operações frequentes</h2><nav className="aura-quick-actions" aria-label="Operações frequentes"><a className="outline link" href={target('/alunos')}>Registar ou gerir aluno</a><a className="outline link" href={target('/avaliacoes')}>Registar avaliação</a><a className="outline link" href={target('/agenda')}>Abrir agenda</a>{role!=='coach'&&<><a className="outline link" href={target('/equipa')}>Gerir equipa</a><a className="outline link" href={target('/marca')}>Personalizar marca</a></>}</nav></section>
 <div className="aura-dashboard-main"><DailyPriorities key={`${userId}:${org}`} org={org} userId={userId}/><DailyPriorities key={`schedule:${userId}:${org}`} org={org} userId={userId} mode="schedule"/></div>
 {data&&<div className="aura-dashboard-columns">
 <section className="panel"><h2>Acompanhamento pendente</h2><p>Indicador baseado nas avaliações registadas, sem interpretação clínica. Mostra até 10 alunos ativos, começando pelos que nunca foram avaliados.</p>
 {!data.pending.length?<div className="aura-empty-state"><strong>Sem acompanhamento pendente</strong><p>Os alunos ativos têm avaliações recentes, ou ainda não existem alunos.</p></div>:<div className="tablewrap"><table><thead><tr><th>Aluno</th><th>Última avaliação</th><th>Ação</th></tr></thead><tbody>{data.pending.map(c=><tr key={c.id}><td>{c.full_name}</td><td>{c.assessed_on||"Sem avaliação"}</td><td><a href={clientProfileUrl(org,c.id)}>Abrir ficha de {c.full_name}</a></td></tr>)}</tbody></table></div>}</section>
 <section className="panel"><h2>Avaliações recentes</h2><p>Até 10 avaliações realizadas nos últimos 30 dias.</p>
 {!data.recent.length?<div className="aura-empty-state"><strong>Sem avaliações recentes</strong><p>Regista uma avaliação para acompanhar a evolução dos teus alunos.</p></div>:<div className="tablewrap"><table><thead><tr><th>Aluno</th><th>Data</th><th>Estado</th></tr></thead><tbody>{data.recent.map(a=><tr key={a.id}><td><a href={clientProfileUrl(org,a.client_id)}>{a.full_name}</a></td><td>{a.assessed_on}</td><td>{a.archived_at?"Arquivado":"Ativo"}</td></tr>)}</tbody></table></div>}</section>
 </div>}
 </>;
}
