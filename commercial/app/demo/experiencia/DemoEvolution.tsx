import ProgressChart from '../../../components/ProgressChart';
import {demoMetricSeries,type DemoMetric} from './journey';
import type {DemoAssessment} from './model';
const labels={weight:['Peso','kg'],height:['Altura','cm'],waist:['Cintura','cm']} as const;
export default function DemoEvolution({records,metric,onMetric,onAssessment}:{records:DemoAssessment[];metric:DemoMetric;onMetric:(metric:DemoMetric)=>void;onAssessment:()=>void}){
 const series=demoMetricSeries(records,metric),[label,unit]=labels[metric],last=series.at(-1);
 return <section className="aura-preview-panel aura-preview-evolution"><h2>Evolução do aluno</h2>
  <label>Indicador da evolução<select value={metric} onChange={e=>onMetric(e.target.value as DemoMetric)}>{Object.entries(labels).map(([key,[name,unit]])=><option key={key} value={key}>{name} ({unit})</option>)}</select></label>
  {last?<><dl className="aura-preview-evolution-summary"><div><dt>Último registo de {label.toLowerCase()}</dt><dd>{last.value} {unit}</dd></div><div><dt>Medições apresentadas</dt><dd>{series.length}</dd></div><div><dt>Período apresentado</dt><dd>{series[0].date} a {last.date}</dd></div></dl><ProgressChart responsive records={series} unit={unit}/>{series.length===1&&<p className="aura-preview-note">Uma medição aparece como ponto. Regista outra data para comparar os valores.</p>}</>:<div className="aura-preview-empty"><h3>Ainda sem registos de {label.toLowerCase()}</h3><p>Regista avaliações para visualizar a evolução.</p><button type="button" onClick={onAssessment}>Registar medição de {label.toLowerCase()}</button></div>}
  <p className="aura-preview-note">Até 30 medições fictícias apresentadas, sem interpretação clínica. Todas as avaliações permanecem no histórico.</p>
 </section>;
}
