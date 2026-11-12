'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {createNutritionDocumentPersistence,type DocumentVersion} from '../lib/nutrition-document-persistence';
import {type DocumentKind,type DocumentCommand,type RecipeBody,type PlanBody} from '../lib/nutrition-document-command';
import {foodDraft,foodItems,editableDocument,type FoodDraft} from '../lib/nutrition-editor';
import {mealDraft,planBody,type MealDraft} from '../lib/nutrition-plan-editor';
import {NutritionPersistenceError} from '../lib/nutrition-persistence';
import {useNutritionResource,nutritionError,staleNutrition,type NutritionContext} from '../lib/use-nutrition-resource';
import NutritionFoodEditor from './NutritionFoodEditor';
import NutritionPlanEditor from './NutritionPlanEditor';
import NutritionUncertain from './NutritionUncertain';
import NutritionDocumentPreview from './NutritionDocumentPreview';
type Draft={id:string|null;revision:number;operation:DocumentCommand['operation'];title:string;notes:string;foods:FoodDraft[];meals:MealDraft[];reason:string;dirty:boolean};
const fresh=():Draft=>({id:null,revision:0,operation:'save',title:'',notes:'',foods:[foodDraft()],meals:[mealDraft()],reason:'',dirty:false});
type Row=Awaited<ReturnType<ReturnType<typeof createNutritionDocumentPersistence>['list']>>['documents'][number];
export default function NutritionDocumentsWorkspace(props:NutritionContext&{onDirtyChange:(dirty:boolean,pending?:boolean)=>void}){
 const [kind,setKind]=useState<DocumentKind>('recipe'),[drafts,setDrafts]=useState(()=>({recipe:fresh(),plan:fresh()}));
 const [extra,setExtra]=useState<Row[]>([]),[cursor,setCursor]=useState<string|null>(null),[paged,setPaged]=useState(false);
 const [recipes,setRecipes]=useState<DocumentVersion[]>([]),[recipeCursor,setRecipeCursor]=useState<string|null>(null);
 const [history,setHistory]=useState<DocumentVersion[]>([]),[historyId,setHistoryId]=useState(''),[historyCursor,setHistoryCursor]=useState<number|null>(null);
 const [message,setMessage]=useState(''),[uncertain,setUncertain]=useState<DocumentCommand|null>(null),[abandoned,setAbandoned]=useState(false);
 const resource=useNutritionResource(props,kind,client=>createNutritionDocumentPersistence(client,{organizationId:props.org,clientId:props.clientId}),async repo=>({list:await repo.list(kind),recipes:kind==='plan'?await repo.list('recipe'):null}));
 const notify=useRef(props.onDirtyChange);notify.current=props.onDirtyChange;
 const dirty=Object.values(drafts).some(d=>d.dirty)||!!uncertain,draft=drafts[kind];
 useEffect(()=>{notify.current(dirty,resource.busy||(!!uncertain&&!abandoned));},[dirty,resource.busy,uncertain,abandoned]);useEffect(()=>()=>notify.current(false,false),[]);
 useEffect(()=>{setExtra([]);setCursor(null);setPaged(false);setHistory([]);setHistoryId('');setHistoryCursor(null);setRecipes(resource.data?.recipes?.documents.flatMap(r=>r.published?[r.published]:[])||[]);setRecipeCursor(resource.data?.recipes?.nextCursor||null);},[resource.data]);
 const update=(value:Partial<Draft>)=>setDrafts(old=>({...old,[kind]:{...old[kind],...value,dirty:true}}));
 const reset=(target:DocumentKind=kind)=>setDrafts(old=>({...old,[target]:fresh()}));
 const leave=()=>!resource.busy&&!uncertain&&(!draft.dirty||window.confirm('Descartar o rascunho deste documento?'));
 function edit(version:DocumentVersion,operation:DocumentCommand['operation']){
  if(!leave())return;const body=editableDocument(version);
  setDrafts(old=>({...old,[kind]:{...fresh(),id:version.documentId,revision:version.revision,operation,title:body.title,notes:body.notes||'',foods:kind==='recipe'?(body as RecipeBody).items.map(foodDraft):[foodDraft()],meals:kind==='plan'?(body as PlanBody).meals.map(mealDraft):[mealDraft()],dirty:true}}));
 }
 async function save(event:FormEvent){
  event.preventDefault();if(!resource.canWrite||uncertain)return;
  if(draft.operation!=='save'&&!window.confirm(draft.operation==='publish'?'Publicar exatamente o rascunho guardado?':'Retirar a publicação atual, preservando o histórico?'))return;
  let command:DocumentCommand;
  try{
   command={contractVersion:1,requestId:crypto.randomUUID(),documentId:draft.id,kind,expectedRevision:draft.revision,operation:draft.operation,body:draft.operation!=='save'?null:kind==='recipe'?{title:draft.title,notes:draft.notes||null,items:foodItems(draft.foods)}:planBody(draft.title,draft.notes,draft.meals),reason:draft.id?draft.reason:null};
  }catch(e){setMessage(nutritionError(e));return;}
  try{await resource.run(repo=>repo.save(command),true);reset();setMessage(draft.operation==='save'?'Rascunho guardado. A publicação é uma operação separada.':'Operação confirmada.');resource.refresh();}
  catch(e){if(staleNutrition(e))return;if(e instanceof NutritionPersistenceError&&e.kind==='uncertain'){setUncertain(command);setAbandoned(false);}setMessage(nutritionError(e));}
 }
 async function check(){if(!uncertain)return;try{const receipt=await resource.run(repo=>repo.requestStatus(uncertain.requestId));if(!receipt){setMessage('Ainda sem recibo. Não repitas o pedido.');return;}reset(uncertain.kind);setUncertain(null);setAbandoned(false);resource.refresh();}catch(e){if(!staleNutrition(e))setMessage(nutritionError(e));}}
 const rows=[...(resource.data?.list.documents||[]),...extra],next=paged?cursor:resource.data?.list.nextCursor;
 async function more(){if(!next)return;try{const r=await resource.run(repo=>repo.list(kind,next));setExtra(old=>[...old,...r.documents]);setCursor(r.nextCursor);setPaged(true);}catch(e){if(!staleNutrition(e))setMessage(nutritionError(e));}}
 async function moreRecipes(){if(!recipeCursor)return;try{const r=await resource.run(repo=>repo.list('recipe',recipeCursor));setRecipes(old=>[...old,...r.documents.flatMap(d=>d.published?[d.published]:[])]);setRecipeCursor(r.nextCursor);}catch(e){if(!staleNutrition(e))setMessage(nutritionError(e));}}
 async function versions(version?:DocumentVersion){const target=version?.documentId||historyId;try{const r=await resource.run(repo=>repo.history(target,version?null:historyCursor));setHistory(old=>version?r.versions:[...old,...r.versions]);setHistoryId(target);setHistoryCursor(r.nextCursor);}catch(e){if(!staleNutrition(e))setMessage(nutritionError(e));}}
 return <section className="panel" aria-label="Documentos nutricionais" aria-busy={resource.loading||resource.busy}>
  <h2>Receitas e planos</h2><p>Documentos manuais por aluno. Sem prescrição automática. Guardar rascunho, publicar e declarar consumo são ações distintas.</p>
  <nav aria-label="Tipo de documento nutricional">{(['recipe','plan'] as const).map(k=><button key={k} className="outline" aria-pressed={kind===k} disabled={resource.busy||(!!uncertain&&!abandoned)} onClick={()=>setKind(k)}>{k==='recipe'?'Receitas':'Planos'}</button>)}</nav>
  <button className="outline" disabled={resource.busy} onClick={resource.refresh}>Atualizar documentos</button><p role="status">{resource.loading?'A carregar documentos…':resource.message||message}</p>
  {uncertain&&<NutritionUncertain requestId={uncertain.requestId} busy={resource.busy} abandoned={abandoned} onCheck={()=>void check()} onAbandon={()=>setAbandoned(true)}/>}
  {resource.ready&&<>
   <p>{rows.length} documentos carregados{next?' · há mais páginas':''}. Uma nova publicação pode exigir retirar primeiro o plano anterior.</p>
   {rows.map(({current,published})=><article key={current.documentId} className="panel"><h3>{current.body.title}</h3><p>Versão atual {current.revision} · {current.status==='draft'?'Rascunho':current.status==='published'?'Publicado':'Retirado'}</p><p>{published?`Disponível: ${published.body.title}, versão ${published.revision}.`:'Sem publicação disponível.'}</p>
    <NutritionDocumentPreview version={current}/>{published&&published.revision!==current.revision&&<NutritionDocumentPreview version={published}/>}
    <button className="outline" disabled={resource.busy} onClick={()=>void versions(current)}>Histórico do documento</button>{resource.canWrite&&<><button className="outline" disabled={resource.busy||!!uncertain} onClick={()=>edit(current,'save')}>Editar documento</button>{current.status==='draft'&&<button disabled={resource.busy||!!uncertain} onClick={()=>edit(current,'publish')}>Preparar publicação</button>}{published&&<button className="outline" disabled={resource.busy||!!uncertain} onClick={()=>edit(current,'withdraw')}>Preparar retirada</button>}</>}
   </article>)}{!rows.length&&<p>Sem documentos nesta página.</p>}{next&&<button disabled={resource.busy} onClick={()=>void more()}>Carregar mais documentos</button>}
   {history.length>0&&<details open><summary>Histórico do documento até à versão {history[0].revision}</summary><ul>{history.map(v=><li key={v.revision}>Versão {v.revision}: {v.body.title} · {v.status} · {v.reason||'Criação'}</li>)}</ul>{historyCursor&&<button disabled={resource.busy} onClick={()=>void versions()}>Versões anteriores do documento</button>}</details>}
   {resource.canWrite&&!uncertain&&<details open={draft.dirty||undefined}><summary>{draft.id?draft.operation==='save'?'Editar rascunho':draft.operation==='publish'?'Confirmar publicação':'Confirmar retirada':kind==='recipe'?'Preparar receita':'Preparar plano'}</summary><form onSubmit={save}><fieldset disabled={resource.busy}>
    {draft.operation==='save'?<><label>Título do documento<input required maxLength={120} value={draft.title} onChange={e=>update({title:e.target.value})}/></label><label>Nota do documento (opcional)<input maxLength={2000} value={draft.notes} onChange={e=>update({notes:e.target.value})}/></label>{kind==='recipe'?<NutritionFoodEditor value={draft.foods} disabled={resource.busy} onChange={foods=>update({foods})}/>:<><p>Receitas publicadas carregadas: {recipes.length}{recipeCursor?' · listagem incompleta':''}.</p>{recipeCursor&&<button type="button" className="outline" onClick={()=>void moreRecipes()}>Carregar mais receitas publicadas</button>}<NutritionPlanEditor value={draft.meals} recipes={recipes} disabled={resource.busy} onChange={meals=>update({meals})}/></>}</>:<p>A operação usa o estado guardado, não alterações no formulário. Retirar mantém o histórico e não publica um rascunho pendente.</p>}
    {draft.id&&<label>Motivo da versão<input required minLength={3} maxLength={300} value={draft.reason} onChange={e=>update({reason:e.target.value})}/></label>}
    <button>{draft.operation==='save'?'Guardar documento':draft.operation==='publish'?'Confirmar publicação':'Confirmar retirada'}</button><button type="button" className="outline" onClick={()=>{if(leave())reset();}}>Descartar rascunho do documento</button>
   </fieldset></form></details>}
  </>}
 </section>;
}
