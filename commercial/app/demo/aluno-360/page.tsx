"use client";
import AuraBrand from '../../../components/AuraBrand';
import {useState,type FormEvent} from 'react';
import ProgressChart from '../../../components/ProgressChart';
import BrandHeader from '../../../components/BrandHeader';
import DemoBrandControls from '../../../components/DemoBrandControls';
import DemoCare from '../../../components/DemoCare';
import {addDays,businessToday} from '../../../lib/care';
import {evolutionSeries,evolutionChange,type EvolutionRecord,type EvolutionMetric} from '../../../lib/evolution';
import {measurement} from '../../../lib/validation';

type Student={id:number;name:string;records:EvolutionRecord[]};
type Section='overview'|'assessments'|'evolution'|'care'|'next';
function exampleStudents(today:string):Student[]{
 return [{id:1,name:'Sofia · Exemplo',records:[80,50,20,0].map((ago,i)=>({id:`sofia-${i}`,assessed_on:addDays(today,-ago),weight_kg:72-i*.5,height_cm:168,waist_cm:80-i,superseded_at:null}))},
 {id:2,name:'Miguel · Exemplo',records:[45,15].map((ago,i)=>({id:`miguel-${i}`,assessed_on:addDays(today,-ago),weight_kg:81-i*.4,height_cm:178,waist_cm:null,superseded_at:null}))}];
}
export default function Student360Preview(){
 const [today]=useState(businessToday),[students,setStudents]=useState(()=>exampleStudents(businessToday()));
 const [selected,setSelected]=useState(1),[section,setSection]=useState<Section>('overview'),[readOnly,setReadOnly]=useState(false);
 const [days,setDays]=useState(90),[metric,setMetric]=useState<EvolutionMetric>('weight_kg'),[weight,setWeight]=useState(''),[message,setMessage]=useState('');
 const [brand,setBrand]=useState('Estúdio Aurora'),[color,setColor]=useState('#137F79');
 const student=students.find(s=>s.id===selected)!;
 const points=evolutionSeries(student.records,metric,today,days),change=evolutionChange(points),unit=metric==='weight_kg'?'kg':'cm';
 function assess(e:FormEvent){e.preventDefault();if(readOnly)return;try{const value=measurement(weight,500,2);if(value===null)throw new Error();
  const record:EvolutionRecord={id:crypto.randomUUID(),assessed_on:today,weight_kg:value,height_cm:null,waist_cm:null,superseded_at:null};
  setStudents(current=>current.map(s=>s.id===selected?{...s,records:[...s.records,record]}:s));setWeight('');setMessage('Avaliação fictícia adicionada.');
 }catch{setMessage('Indica um peso entre 0,01 e 500 kg, com até duas casas decimais.');}}
 const tabs:[Section,string][]=[['overview','Resumo'],['assessments','Avaliações'],['evolution','Evolução'],['care','Objetivos e agenda'],['next','Próximas áreas']];
 return <main className="shell" id="main-content" tabIndex={-1}><header><div><AuraBrand/><p>Pré-visualização · Dados fictícios</p></div><a className="outline link" href="/demo">Demonstração geral</a></header>
 <div className="heading"><div><span className="eyebrow">ALUNO 360º</span><h1>Todo o acompanhamento, numa ficha.</h1><p>Explora o exemplo sem conta. As alterações são temporárias; recarregar repõe os dados.</p></div></div>
 <BrandHeader branding={{display_name:brand,primary_color:color,logo_url:null}} subtitle="Pré-visualização Aluno 360º"/><DemoBrandControls name={brand} color={color} onChange={(name,color)=>{setBrand(name);setColor(color);}}/><section className="panel"><div className="columns"><label>Aluno de exemplo<select aria-label="Aluno de exemplo" value={selected} onChange={e=>{setSelected(Number(e.target.value));setWeight('');setMessage('');}}>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Modo de demonstração<select aria-label="Modo de demonstração" value={readOnly?'read':'write'} onChange={e=>{setReadOnly(e.target.value==='read');setMessage('');}}><option value="write">Profissional com escrita</option><option value="read">Profissional só de consulta</option></select></label></div><h2>{student.name}</h2><p>Ativo · {brand} · Acompanhamento fictício</p><nav className="aura-profile-tabs" aria-label="Secções da pré-visualização">{tabs.map(([key,label])=><button key={key} className={section===key?'':'outline'} aria-pressed={section===key} onClick={()=>{setSection(key);setMessage('');}}>{label}</button>)}</nav></section>
 {section==='overview'&&<><section className="panel"><h2>O acompanhamento de hoje</h2><div className="columns"><article><h3>Avaliações</h3><p>{student.records.length} registos fictícios nesta ficha.</p><button className="outline" onClick={()=>setSection('assessments')}>Consultar avaliações</button></article><article><h3>Evolução</h3><p>Compara os registos por período e indicador.</p><button className="outline" onClick={()=>setSection('evolution')}>Explorar evolução</button></article><article><h3>Objetivos e agenda</h3><p>Experimenta o objetivo, a revisão e uma marcação.</p><button className="outline" onClick={()=>setSection('care')}>Abrir acompanhamento</button></article></div></section><section className="panel"><h2>Últimas medições de peso</h2><ProgressChart records={student.records.map(r=>({date:r.assessed_on,value:r.weight_kg}))} unit="kg"/></section></>}
 {section==='assessments'&&<section className="panel"><h2>Avaliações do exemplo</h2>{readOnly?<p>Modo de consulta: o registo está desativado nesta demonstração.</p>:<form onSubmit={assess}><label>Peso fictício (kg)<input type="number" required min="0.01" max="500" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)}/></label><button>Adicionar avaliação fictícia</button></form>}<div className="tablewrap"><table><caption>Histórico de {student.name}</caption><thead><tr><th>Data</th><th>Peso (kg)</th><th>Altura (cm)</th><th>Cintura (cm)</th></tr></thead><tbody>{[...student.records].reverse().map(r=><tr key={r.id}><td>{r.assessed_on}</td><td>{r.weight_kg??'—'}</td><td>{r.height_cm??'—'}</td><td>{r.waist_cm??'—'}</td></tr>)}</tbody></table></div></section>}
 {section==='evolution'&&<section className="panel"><h2>Evolução do aluno</h2><div className="columns"><label>Período da evolução<select aria-label="Período da evolução" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>365 dias</option><option value={0}>Todo o histórico</option></select></label><label>Indicador<select aria-label="Indicador" value={metric} onChange={e=>setMetric(e.target.value as EvolutionMetric)}><option value="weight_kg">Peso (kg)</option><option value="height_cm">Altura (cm)</option><option value="waist_cm">Cintura (cm)</option></select></label></div><p>Variação no período: {change===null?'São necessárias duas medições':`${change>0?'+':''}${change} ${unit}`}</p><ProgressChart records={points} unit={unit} maxPoints={points.length}/><p>Exemplo ilustrativo, sem interpretação clínica.</p></section>}
 <div hidden={section!=='care'}><DemoCare studentId={selected} name={student.name} onStatus={setMessage} writable={!readOnly}/></div>
 {section==='next'&&<section className="panel"><h2>O que vamos acrescentar</h2><div className="columns"><article><h3>Treino</h3><p>Planos, exercícios e execução. Ainda não disponível.</p></article><article><h3>Nutrição</h3><p>Integração progressiva com funcionalidades NutriTrack. Ainda não disponível.</p></article><article><h3>Comunicação</h3><p>Mensagens e notificações. Ainda não disponível.</p></article></div></section>}
 <p className="status" role="status">{message}</p><footer>Pré-visualização sem ligação a bases de dados. Utiliza apenas dados fictícios. O modo de consulta é uma simulação da interface.</footer></main>;
}
