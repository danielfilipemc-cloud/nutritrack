import {useRef} from 'react';
import StudentIdentity from '../../../components/StudentIdentity';
import {demoDirectoryLabels,type DemoDirectoryFilter,type DemoDirectoryRow} from './directory';

/** Presentation and interaction callbacks only. Source records stay in the demo page. */
export default function DemoStudentDirectory({rows,total,query,status,onQuery,onStatus,onOpen}:{rows:DemoDirectoryRow[];total:number;query:string;status:DemoDirectoryFilter;onQuery:(query:string)=>void;onStatus:(status:DemoDirectoryFilter)=>void;onOpen:(id:number)=>void}){
 const search=useRef<HTMLInputElement>(null);
 const filtered=!!query.trim()||status!=='all';
 const clear=()=>{onQuery('');onStatus('all');search.current?.focus();};
 return <section className="aura-preview-panel aura-preview-directory" aria-labelledby="demo-directory-title">
  <div className="aura-preview-panelhead"><h2 id="demo-directory-title">Diretório</h2><span role="status" aria-live="polite" aria-atomic="true">{rows.length} de {total} {total===1?'aluno':'alunos'}</span></div>
  <div className="aura-preview-directory-filters">
   <label>Pesquisar alunos<input ref={search} type="search" maxLength={100} value={query} onChange={e=>onQuery(e.target.value)} aria-describedby="demo-directory-hint" placeholder="Nome do aluno"/></label>
   <label>Estado do acompanhamento<select value={status} onChange={e=>onStatus(e.target.value as DemoDirectoryFilter)}><option value="all">Todos os estados</option>{Object.entries(demoDirectoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  </div>
  <p id="demo-directory-hint" className="aura-preview-note">Pesquisa por nome, com ou sem acentos. O estado reflete o acompanhamento guardado nesta sessão.</p>
  {filtered&&<button className="quiet" type="button" onClick={clear}>Limpar pesquisa e filtros</button>}
  {rows.length?<ul className="aura-preview-directory-list">{rows.map(s=><li key={s.id}><button type="button" onClick={()=>onOpen(s.id)}><StudentIdentity name={s.name}><strong>{s.name}</strong><span id={`demo-directory-status-${s.id}`}>{demoDirectoryLabels[s.status]}</span></StudentIdentity><span className="aura-preview-directory-action">Ficha 360.º →</span></button></li>)}</ul>:<div className="aura-preview-empty"><h3>Sem alunos encontrados</h3><p>Experimenta outro nome ou limpa os filtros para voltar a ver os alunos de exemplo.</p></div>}
 </section>;
}
