"use client";
import {useEffect,useState} from "react";
import DailyPriorities from "./DailyPriorities";
import {db} from "../lib/supabase";
import {clientProfileUrl,type Dashboard} from "../lib/dashboard";
export default function DashboardOverview({org,userId}:{org:string;userId:string}){
 const [loaded,setLoaded]=useState<{org:string;userId:string;data:Dashboard}|null>(null);
 const [error,setError]=useState(""),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setLoaded(null);setError("");
 if(!db)return;
 void db.rpc("aura_care_dashboard",{p_org:org}).then(({data,error})=>{if(!active)return;
 if(error||!data){setError("Não foi possível carregar o painel. Tenta novamente.");return;}
 setLoaded({org,userId,data:data as Dashboard});});return()=>{active=false;};},[org,userId,revision]);
 const data=loaded?.org===org&&loaded.userId===userId?loaded.data:null;
 if(error)return <section className="panel" role="alert"><p>{error}</p><button onClick={()=>setRevision(v=>v+1)}>Tentar novamente</button></section>;
 if(!data)return <section className="panel" aria-busy="true"><p role="status">A carregar indicadores...</p></section>;
 return <>
 <div className="stat" aria-label="Indicadores do estabelecimento">
 <div><span>Alunos ativos</span><strong>{data.active_clients}</strong><small>{data.archived_clients} arquivados</small></div>
 <div><span>Avaliações nos últimos 30 dias</span><strong>{data.assessments_30_days}</strong><small>Até {data.as_of}</small></div>
 <div><span>Alunos a acompanhar</span><strong>{data.pending_clients}</strong><small>Sem avaliação ou última há mais de 30 dias</small></div>
 </div>
 <section className="panel"><h2>Operações frequentes</h2><div className="aura-quick-actions"><a className="outline link" href="/alunos">Registar ou gerir aluno</a><a className="outline link" href="/avaliacoes">Registar avaliação</a><a className="outline link" href="/agenda">Abrir agenda</a><a className="outline link" href="/equipa">Gerir equipa</a><a className="outline link" href="/marca">Personalizar marca</a></div></section>
 <DailyPriorities key={`${userId}:${org}`} org={org} userId={userId}/>
 <section className="panel"><h2>Acompanhamento pendente</h2><p>Indicador baseado nas avaliações registadas, sem interpretação clínica. Mostra até 10 alunos ativos, começando pelos que nunca foram avaliados.</p>
 {!data.pending.length?<div className="aura-empty-state"><strong>Sem acompanhamento pendente</strong><p>Os alunos ativos têm avaliações recentes, ou ainda não existem alunos.</p></div>:<div className="tablewrap"><table><thead><tr><th>Aluno</th><th>Última avaliação</th><th>Ação</th></tr></thead><tbody>{data.pending.map(c=><tr key={c.id}><td>{c.full_name}</td><td>{c.assessed_on||"Sem avaliação"}</td><td><a href={clientProfileUrl(org,c.id)}>Abrir ficha de {c.full_name}</a></td></tr>)}</tbody></table></div>}</section>
 <section className="panel"><h2>Avaliações recentes</h2><p>Até 10 avaliações realizadas nos últimos 30 dias.</p>
 {!data.recent.length?<div className="aura-empty-state"><strong>Sem avaliações recentes</strong><p>Regista uma avaliação para acompanhar a evolução dos teus alunos.</p></div>:<div className="tablewrap"><table><thead><tr><th>Aluno</th><th>Data</th><th>Estado</th></tr></thead><tbody>{data.recent.map(a=><tr key={a.id}><td><a href={clientProfileUrl(org,a.client_id)}>{a.full_name}</a></td><td>{a.assessed_on}</td><td>{a.archived_at?"Arquivado":"Ativo"}</td></tr>)}</tbody></table></div>}</section>
 </>;
}
