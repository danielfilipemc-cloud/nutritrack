"use client";
import {useState} from 'react';
import ClientProgressSummary from './ClientProgressSummary';
import ProgressChart from './ProgressChart';
import type {EvolutionMetric} from '../lib/evolution';

type Record={assessed_on:string;weight_kg:number|null;height_cm:number|null;waist_cm:number|null};
export default function StudentOverview({records,onHistory,onEvolution}:{records:Record[];onHistory:()=>void;onEvolution:()=>void}){
 const [metric,setMetric]=useState<EvolutionMetric>('weight_kg');
 return <div className="aura-student-overview"><ClientProgressSummary records={records}/>
  <section className="panel aura-student-chart"><div className="aura-section-title"><div><span className="eyebrow">ACOMPANHAR COM CONTEXTO</span><h2>Evolução recente</h2></div><button className="outline" onClick={onEvolution}>Consultar evolução</button></div>
   <label>Indicador do resumo<select aria-label="Indicador do resumo" value={metric} onChange={e=>setMetric(e.target.value as EvolutionMetric)}><option value="weight_kg">Peso (kg)</option><option value="height_cm">Altura (cm)</option><option value="waist_cm">Cintura (cm)</option></select></label>
   <ProgressChart responsive records={records.map(r=>({date:r.assessed_on,value:r[metric]}))} unit={metric==='weight_kg'?'kg':'cm'}/>
   <div className="aura-student-chart-foot"><p>Últimas 30 avaliações carregadas. Sem interpretação clínica. Consulta o histórico para confirmar origem, versões e partilha.</p><button className="outline" onClick={onHistory}>Consultar avaliações</button></div>
  </section>
 </div>;
}
