"use client";
import {useEffect,useState} from 'react';
import {db} from '../lib/supabase';
import {parsePermissions} from '../lib/foundations';
import {businessToday} from '../lib/care';
import {evolutionStart,evolutionSeries,loadEvolutionWindow,type EvolutionRecord,type EvolutionMetric} from '../lib/evolution';
import ProgressChart from './ProgressChart';
import {clientProfileUrl} from '../lib/dashboard';

type Candidate={id:string;full_name:string};
/** Individual measurements only; no aggregate clinical or business trend is inferred. */
export default function DashboardEvolution({org,userId,candidates}:{org:string;userId:string;candidates:Candidate[]}){
 const [chosen,setChosen]=useState(''),[metric,setMetric]=useState<EvolutionMetric>('weight_kg'),[days,setDays]=useState(90),[revision,setRevision]=useState(0);
 const selected=candidates.find(c=>c.id===chosen)||candidates[0];
 const key=`${org}:${userId}:${selected?.id}:${days}:${revision}`;
 const [result,setResult]=useState<{key:string;rows:EvolutionRecord[];more:boolean;error:string}|null>(null);
 const today=businessToday();
 useEffect(()=>{
  let active=true;const client=db;setResult(null);
  if(!client||!selected)return;
  const id=selected.id,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  void(async()=>{try{
   const permission=await client.rpc('aura_client_permissions',{p_org:org,p_client:id}).abortSignal(controller.signal);if(!active)return;
   if(permission.error||!parsePermissions(permission.data).assessments_read)throw Error('permission');
   const start=evolutionStart(today,days);
   const window=await loadEvolutionWindow<EvolutionRecord>(async(offset,size)=>{
    const {data,error}=await client.from('assessments').select('id,assessed_on,weight_kg,height_cm,waist_cm,superseded_at').eq('organization_id',org).eq('client_id',id).is('superseded_at',null).lte('assessed_on',today).gte('assessed_on',start!).order('assessed_on',{ascending:false}).order('id',{ascending:false}).range(offset,offset+size-1).abortSignal(controller.signal);
    if(error)throw error;return data||[];
   },200,()=>active);
   if(!active||!window)return;
   const check=await client.rpc('aura_client_permissions',{p_org:org,p_client:id}).abortSignal(controller.signal);if(!active)return;
   if(check.error||!parsePermissions(check.data).assessments_read)throw Error('permission');
   setResult({key,rows:window.rows,more:window.more,error:''});
  }catch{if(active)setResult({key,rows:[],more:false,error:'Evolução indisponível ou sem permissão de consulta. Nenhuma medição é apresentada.'});}finally{clearTimeout(timeout);}})();
  return()=>{active=false;clearTimeout(timeout);controller.abort();};
 },[org,userId,selected?.id,days,revision,key,today]);
 useEffect(()=>{const refresh=()=>{setResult(null);setRevision(n=>n+1);};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
 const current=result?.key===key?result:null;
 const points=current?evolutionSeries(current.rows,metric,today,days):[];
 return <section className="panel aura-home-evolution" aria-label="Evolução individual na dashboard" aria-busy={!!selected&&!current}>
  <div className="aura-section-title"><div><span className="eyebrow">ACOMPANHAR A EVOLUÇÃO</span><h2>Evolução individual</h2></div><a href={`/evolucao?org=${encodeURIComponent(org)}`}>Ver evolução →</a></div>
  {!selected?<div className="aura-empty-state"><strong>Começa pelo acompanhamento</strong><p>Quando existirem alunos nas listas autorizadas do painel, podes consultar aqui a evolução individual.</p><a href={`/alunos?org=${encodeURIComponent(org)}`}>Abrir diretório</a></div>:<>
   <div className="aura-home-chart-controls"><label>Aluno da evolução<select value={selected.id} onChange={e=>{setResult(null);setChosen(e.target.value);}}>{candidates.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label><label>Indicador da dashboard<select value={metric} onChange={e=>setMetric(e.target.value as EvolutionMetric)}><option value="weight_kg">Peso (kg)</option><option value="height_cm">Altura (cm)</option><option value="waist_cm">Cintura (cm)</option></select></label><label>Período da dashboard<select value={days} onChange={e=>{setResult(null);setDays(Number(e.target.value));}}><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>365 dias</option></select></label></div>
   {!current?<p role="status">A verificar acesso e carregar evolução...</p>:current.error?<p role="status">{current.error}</p>:<><ProgressChart responsive records={points} unit={metric==='weight_kg'?'kg':'cm'} maxPoints={points.length||1}/><p className="aura-caption">{current.more?'Pré-visualização limitada a 200 avaliações; consulta a ficha para continuar.':'Avaliações atuais do período carregadas.'} Valores individuais, sem interpretação clínica.</p></>}
   <div className="aura-quick-actions"><a href={`${clientProfileUrl(org,selected.id)}&section=evolution`}>Abrir evolução na ficha</a><button className="outline" onClick={()=>{setResult(null);setRevision(n=>n+1);}}>Atualizar gráfico</button></div>
  </>}
 </section>;
}
