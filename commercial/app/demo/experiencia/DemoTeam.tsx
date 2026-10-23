"use client";
import {useState,useRef,useEffect} from 'react';
import {assignedDemoStudents,teamRoleLabels,type DemoTeamMember} from './team';
import {pendingActionCount,type DemoActionPlan} from './actions';
import {demoDirectoryLabels} from './directory';
import type {DemoStudent} from './model';
export default function DemoTeam({visible,team,students,onChange,onStudent,actionPlan}:{visible:boolean;team:DemoTeamMember[];students:DemoStudent[];onChange:(id:number,patch:Pick<DemoTeamMember,'role'|'status'>)=>void;onStudent:(id:number)=>void;actionPlan:DemoActionPlan}){
 const [filter,setFilter]=useState('all'),[message,setMessage]=useState(''),[focusRestore,setFocusRestore]=useState(0);
 const filterInput=useRef<HTMLSelectElement>(null);
 useEffect(()=>{if(focusRestore)filterInput.current?.focus();},[focusRestore]);
 if(!visible)return null;
 const rows=team.filter(m=>filter==='all'||m.status===filter),active=team.filter(m=>m.status==='active').length;
 return <div className="aura-demo-team"><div className="aura-preview-heading"><span className="aura-preview-overline">PESSOAS E ACOMPANHAMENTO</span><h1>A tua equipa de exemplo</h1><p>Organiza profissionais fictícios e consulta os acompanhamentos atribuídos. Não cria contas, altera acessos ou envia mensagens.</p></div>
  <section className="aura-preview-panel"><h2>Equipa nesta sessão</h2><p>{active} de {team.length} profissionais disponíveis para novas atribuições.</p><label>Mostrar profissionais<select ref={filterInput} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos</option><option value="active">Disponíveis</option><option value="paused">Em pausa</option></select></label><p className="aura-preview-note">Pausar impede novas atribuições. As atribuições guardadas e os rascunhos dos alunos ficam preservados. Os papéis abaixo são exemplos de organização, sem efeito em permissões.</p></section>
  {message&&<p role="status" className="aura-preview-message">{message}</p>}
  {rows.length?<div className="aura-demo-team-grid">{rows.map(m=>{const assigned=assignedDemoStudents(students,m.name);return <section className="aura-preview-panel" key={m.id} aria-label={`Membro da equipa: ${m.name}`}><span className="aura-preview-avatar" aria-hidden="true">{m.name.split(' ').map(n=>n[0]).join('')}</span><h2>{m.name}</h2><p>{m.status==='active'?'Disponível para atribuição':'Em pausa no exemplo'} · {assigned.length} {assigned.length===1?'acompanhamento atribuído':'acompanhamentos atribuídos'}</p><label>Papel de {m.name}<select value={m.role} onChange={e=>{onChange(m.id,{status:m.status,role:e.target.value as DemoTeamMember['role']});setMessage(`Papel de ${m.name} atualizado apenas nesta sessão.`);}}>{Object.entries(teamRoleLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
   <button type="button" className="quiet" aria-label={`${m.status==='active'?'Pausar':'Reativar'} no exemplo: ${m.name}`} onClick={()=>{onChange(m.id,{role:m.role,status:m.status==='active'?'paused':'active'});if(filter!=='all')setFocusRestore(n=>n+1);setMessage(`${m.name} ${m.status==='active'?'em pausa':'reativado'} apenas nesta sessão.`);}}>{m.status==='active'?'Pausar no exemplo':'Reativar no exemplo'}</button>
   <h3>Alunos atribuídos</h3><p className="aura-preview-note">Inclui acompanhamentos ativos, em pausa e concluídos; apenas valores guardados.</p>{assigned.length?<ul className="aura-demo-team-students">{assigned.map(s=><li key={s.id}><strong>{s.name}</strong><span>{demoDirectoryLabels[s.status]}</span><span>{pendingActionCount(actionPlan,s.id)} {pendingActionCount(actionPlan,s.id)===1?'ação por concluir':'ações por concluir'}</span><button type="button" className="quiet" onClick={()=>onStudent(s.id)} aria-label={`Consultar acompanhamento de ${s.name} pela equipa`}>Consultar acompanhamento →</button></li>)}</ul>:<p>Sem alunos atribuídos a este profissional de exemplo.</p>}
  </section>;})}</div>:<section className="aura-preview-panel"><h2>Sem profissionais neste filtro</h2><button type="button" onClick={()=>{setFilter('all');setFocusRestore(n=>n+1);}}>Mostrar toda a equipa →</button></section>}
 </div>;
}
