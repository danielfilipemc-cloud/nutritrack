"use client";
import {useEffect,useRef,useState} from 'react';
import {db} from '../lib/supabase';
import {RequestScope} from '../lib/request-scope';
import {businessToday} from '../lib/care';
import {evolutionStart,evolutionSeries,evolutionChange,loadEvolutionWindow,type EvolutionRecord,type EvolutionMetric} from '../lib/evolution';
import ProgressChart from './ProgressChart';
export default function StudentEvolution({org,clientId,period,onPeriodChange}:{org:string;clientId:string;period?:number;onPeriodChange?:(days:number)=>void}){
 const scope=useRef(new RequestScope());
 const [localDays,setDays]=useState(90),[metric,setMetric]=useState<EvolutionMetric>('weight_kg');const days=period??localDays;
 const [records,setRecords]=useState<EvolutionRecord[]>([]),[limit,setLimit]=useState(200),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const today=businessToday();
 useEffect(()=>{setLimit(200);},[days]);
 useEffect(()=>{if(!db)return;const valid=scope.current.begin();setLoading(true);setError('');setRecords([]);setMore(false);
  const client=db,start=evolutionStart(today,days);
  void (async()=>{try{const window=await loadEvolutionWindow<EvolutionRecord>(async(offset,size)=>{
   let q=client.from('assessments').select('id,assessed_on,weight_kg,height_cm,waist_cm,superseded_at').eq('organization_id',org).eq('client_id',clientId).is('superseded_at',null).lte('assessed_on',today);
   if(start)q=q.gte('assessed_on',start);
   const {data,error}=await q.order('assessed_on',{ascending:false}).order('id',{ascending:false}).range(offset,offset+size-1);
   if(error)throw error;return data||[];
  },limit,valid);if(!window||!valid())return;setRecords(window.rows);setMore(window.more);}catch{if(valid())setError('Não foi possível carregar a evolução.');}finally{if(valid())setLoading(false);}})();
  return()=>scope.current.invalidate();
 },[org,clientId,days,limit,reload,today]);
 const points=evolutionSeries(records,metric,today,days),change=evolutionChange(points),unit=metric==='weight_kg'?'kg':'cm';
 return <section className="panel" aria-busy={loading}><h2>Evolução do aluno</h2><div className="columns"><label>Período da evolução<select aria-label="Período da evolução" value={days} onChange={e=>{(onPeriodChange||setDays)(Number(e.target.value));setLimit(200);}}><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>365 dias</option><option value={0}>Todo o histórico</option></select></label><label>Indicador<select aria-label="Indicador" value={metric} onChange={e=>setMetric(e.target.value as EvolutionMetric)}><option value="weight_kg">Peso (kg)</option><option value="height_cm">Altura (cm)</option><option value="waist_cm">Cintura (cm)</option></select></label></div>
 {loading?<p role="status">A carregar evolução...</p>:error?<p role="alert">{error}</p>:<><p>{records.length} avaliações carregadas. {more?'O período contém mais avaliações; os resultados abaixo cobrem apenas as carregadas.':'Todas as avaliações atuais do período foram carregadas.'}</p>{points.length>0&&<p>De {points[0].date} a {points.at(-1)!.date} · Variação: {change===null?'São necessárias duas medições':`${change>0?'+':''}${change} ${unit}`}</p>}<ProgressChart responsive records={points} unit={unit} maxPoints={points.length}/><p>Valores registados, sem interpretação clínica. Versões corrigidas e datas futuras não entram nesta evolução.</p>{more&&limit<2000&&<button className="outline" onClick={()=>setLimit(n=>n+200)}>Carregar mais avaliações</button>}{more&&limit>=2000&&<p>Limite de 2000 avaliações atingido. Escolhe um período menor.</p>}</>}
 <button className="outline" disabled={loading} onClick={()=>setReload(n=>n+1)}>Atualizar evolução</button></section>;
}
