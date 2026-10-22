"use client";
import {useEffect,useRef,useState} from 'react';
import {actionTemplates,DemoActionError,studentActions,type DemoAction,type DemoActionDraft,type DemoActionFilter,type DemoActionPlan} from './actions';
import {demoDate,type DemoStudent} from './model';

type View={title:string;due:string;editingId:number|null;filter:DemoActionFilter;newDraft?:DemoActionDraft;feedback?:{text:string;error:boolean;field?:'title'|'due'}};
const empty:View={title:'',due:'',editingId:null,filter:'all'};
export default function DemoActions({visible,student,plan,onSave,onToggle}:{visible:boolean;student:DemoStudent;plan:DemoActionPlan;onSave:(studentId:number,draft:DemoActionDraft,editingId:number|null)=>void;onToggle:(studentId:number,id:number)=>void}){
 const [views,setViews]=useState<Record<number,View>>({});
 const [restore,setRestore]=useState<{studentId:number;actionId:number}|null>(null);
 const titleInput=useRef<HTMLInputElement>(null),dueInput=useRef<HTMLInputElement>(null),filterInput=useRef<HTMLSelectElement>(null);
 const editButtons=useRef<Record<number,HTMLButtonElement|null>>({});
 useEffect(()=>{if(restore){(editButtons.current[restore.actionId]||filterInput.current)?.focus();setRestore(null);}},[restore]);
 const view=views[student.id]||empty;
 const update=(patch:Partial<View>)=>setViews(previous=>({...previous,[student.id]:{...(previous[student.id]||empty),...patch}}));
 if(!visible)return null;
 const all=studentActions(plan,student.id),rows=studentActions(plan,student.id,view.filter),pending=all.filter(a=>a.status==='pending').length,done=all.length-pending;
 const invalid=(field:'title'|'due')=>({'aria-invalid':view.feedback?.error&&view.feedback.field===field||undefined,'aria-describedby':view.feedback?.error&&view.feedback.field===field?'demo-action-hint demo-action-feedback':'demo-action-hint'});
 function edit(action:DemoAction){update({newDraft:{title:view.title,due:view.due},title:action.title,due:action.due,editingId:action.id,feedback:undefined});titleInput.current?.focus();}
 function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  try{onSave(student.id,{title:view.title,due:view.due},view.editingId);update({title:view.editingId===null?'':view.newDraft?.title||'',due:view.editingId===null?'':view.newDraft?.due||'',newDraft:undefined,editingId:null,filter:'all',feedback:{error:false,text:view.editingId===null?'Ação fictícia criada apenas nesta sessão.':'Ação fictícia atualizada apenas nesta sessão.'}});}
  catch(error){const field=error instanceof DemoActionError?error.field:'title';update({feedback:{error:true,field,text:error instanceof DemoActionError?error.message:'Não foi possível guardar a ação fictícia.'}});(field==='due'?dueInput:titleInput).current?.focus();}
 }
 function toggle(action:DemoAction){onToggle(student.id,action.id);update({feedback:{error:false,text:action.status==='pending'?'Ação concluída no exemplo. Podes reabri-la.':'Ação reaberta no exemplo.'}});if(view.filter!=='all')filterInput.current?.focus();}
 return <section className="aura-preview-panel aura-demo-actions" aria-labelledby="demo-actions-title">
  <span className="aura-preview-overline">PRÓXIMOS PASSOS</span><h2 id="demo-actions-title">Plano de ações do aluno</h2><p>Ações internas de exemplo para organizar o acompanhamento de {student.name}. Não enviam mensagens nem representam tarefas realizadas pelo aluno.</p>
  <p className="aura-preview-note">Responsável do acompanhamento guardado: {student.care.responsible||'Por atribuir'}. As ações não alteram revisões, marcações ou avaliações.</p>
  <dl className="aura-demo-action-counts"><div><dt>Por concluir</dt><dd>{pending}</dd></div><div><dt>Concluídas</dt><dd>{done}</dd></div></dl>
  <h3>{view.editingId===null?'Criar ação fictícia':'Editar ação fictícia'}</h3>
  <form className="aura-preview-form" onSubmit={save}>
   <label className="aura-preview-full">Descrição da ação<input ref={titleInput} {...invalid('title')} value={view.title} maxLength={120} onChange={e=>update({title:e.target.value,feedback:undefined})}/></label>
   <label>Prazo da ação (opcional)<input ref={dueInput} {...invalid('due')} type="date" min="2000-01-01" max="2100-12-31" value={view.due} onChange={e=>update({due:e.target.value,feedback:undefined})}/></label>
   <button type="submit">{view.editingId===null?'Criar ação de exemplo':'Guardar alterações da ação'}</button>
   {view.editingId!==null&&<button type="button" className="quiet" onClick={()=>{const id=view.editingId!;update({title:view.newDraft?.title||'',due:view.newDraft?.due||'',newDraft:undefined,editingId:null,feedback:undefined});setRestore({studentId:student.id,actionId:id});}}>Cancelar edição da ação</button>}
  </form>
  <p id="demo-action-hint" className="aura-preview-note">Usa apenas exemplos, de 2 a 120 caracteres. O prazo é opcional; “em atraso” usa a referência {demoDate}. Rascunhos e filtros mantidos por aluno nesta sessão.</p>
  {view.editingId===null&&<details className="aura-demo-action-templates"><summary>Usar um modelo de ação</summary><p>Escolher um modelo preenche apenas uma descrição vazia e mantém o prazo.</p>{actionTemplates.map(title=><button type="button" className="quiet" key={title} disabled={!!view.title.trim()} onClick={()=>{update({title,feedback:undefined});titleInput.current?.focus();}}>{title}</button>)}</details>}
  {view.feedback&&<p id="demo-action-feedback" role={view.feedback.error?'alert':'status'} className="aura-preview-message">{view.feedback.text}</p>}
  <label>Mostrar ações<select ref={filterInput} value={view.filter} onChange={e=>update({filter:e.target.value as DemoActionFilter})}><option value="all">Todas</option><option value="pending">Por concluir</option><option value="overdue">Em atraso</option><option value="done">Concluídas</option></select></label>
  {rows.length?<ul className="aura-demo-action-list">{rows.map(action=><li key={action.id} aria-label={`Ação: ${action.title}`}><div><strong>{action.title}</strong><span>{action.status==='done'?<>Concluída no exemplo em <time dateTime={action.completedOn}>{action.completedOn}</time></>:<>Por concluir{action.due&&action.due<demoDate?' · Em atraso no exemplo':''}</>}</span><span>Prazo: {action.due?<time dateTime={action.due}>{action.due}</time>:'Sem prazo'}</span></div><div className="aura-demo-action-buttons"><button type="button" ref={el=>{editButtons.current[action.id]=el;}} className="quiet" disabled={view.editingId!==null} aria-label={`Editar ação ${action.title}`} onClick={()=>edit(action)}>Editar</button><button type="button" className="quiet" disabled={view.editingId===action.id} aria-label={`${action.status==='pending'?'Concluir':'Reabrir'} ação ${action.title}`} onClick={()=>toggle(action)}>{action.status==='pending'?'Concluir':'Reabrir'}</button></div></li>)}</ul>:<div className="aura-demo-action-empty"><h3>{all.length?'Sem ações neste filtro':'Ainda não há ações para este aluno'}</h3><p>{all.length?'As ações guardadas continuam nos outros filtros.':'Cria uma próxima ação ou usa um modelo de exemplo.'}</p><button type="button" className="quiet" onClick={()=>{if(all.length){update({filter:'all'});filterInput.current?.focus();}else titleInput.current?.focus();}}>{all.length?'Mostrar todas as ações':'Criar primeira ação →'}</button></div>}
 </section>;
}
