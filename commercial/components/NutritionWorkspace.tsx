'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {db} from '../lib/supabase';
import {businessToday} from '../lib/care';
import {createNutritionPersistence,NutritionPersistenceError,type PersistedNutritionMeal} from '../lib/nutrition-persistence';
import {type NutritionCommandV1} from '../lib/nutrition-command';
import {nutritionTotals,nutrientKeys} from '../lib/nutrition-contract';
import NutritionUncertain from './NutritionUncertain';
import {nutritionRequest} from '../lib/nutrition-request';
type Item={label:string;grams:string;calories:string;protein:string;carbs:string;fat:string};
const empty=():Item=>({label:'',grams:'100',calories:'',protein:'',carbs:'',fat:''});
const kinds={breakfast:'Pequeno-almoço',lunch:'Almoço',dinner:'Jantar',snack:'Lanche',other:'Outra refeição'};
export default function NutritionWorkspace({org,clientId,userId,archived=false,onDirtyChange}:{org:string;clientId:string;userId:string;archived?:boolean;onDirtyChange:(dirty:boolean,pending?:boolean)=>void}){
 const [day,setDay]=useState(businessToday),[kind,setKind]=useState<NutritionCommandV1['mealKind']>('other'),[items,setItems]=useState<Item[]>([empty()]);
 const [rows,setRows]=useState<PersistedNutritionMeal[]>([]),[cursor,setCursor]=useState<string|null>(null),[history,setHistory]=useState<PersistedNutritionMeal[]>([]);
 const [editing,setEditing]=useState<PersistedNutritionMeal|null>(null),[ready,setReady]=useState(false),[writable,setWritable]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState(''),[revision,setRevision]=useState(0);
 const [uncertain,setUncertain]=useState<NutritionCommandV1|null>(null),[abandoned,setAbandoned]=useState(false);
 const [historyId,setHistoryId]=useState(''),[historyCursor,setHistoryCursor]=useState<number|null>(null);
 const canWrite=writable&&!archived;
 const repo=useRef<ReturnType<typeof createNutritionPersistence>|null>(null),epoch=useRef(0),pending=useRef(false),notify=useRef(onDirtyChange);notify.current=onDirtyChange;
 useEffect(()=>()=>notify.current(false,false),[]);
 useEffect(()=>{notify.current(dirty||!!uncertain,busy||(!!uncertain&&!abandoned));},[dirty,busy,uncertain,abandoned]);

 const error=(e:unknown)=>e instanceof NutritionPersistenceError?e.message:'Não foi possível concluir. Confirma os dados e tenta novamente.';
 useEffect(()=>{
  if(!db)return;const transport=db,version=++epoch.current,adapter=createNutritionPersistence(transport,{organizationId:org,clientId},businessToday),controller=new AbortController();repo.current=adapter;
  setReady(false);setWritable(false);setRows([]);setHistory([]);setHistoryId('');setHistoryCursor(null);setCursor(null);setLoading(true);
  void(async()=>{try{
   const result=await adapter.diary(day);
   const permission=await nutritionRequest(controller.signal,signal=>transport.from('nutrition_capabilities').select('can_write').eq('organization_id',org).eq('user_id',userId).abortSignal(signal).maybeSingle()).catch(()=>{throw new NutritionPersistenceError('unavailable');});
   if(epoch.current!==version)return;if(permission.error||!permission.data)throw new NutritionPersistenceError(!permission.error||['42501','PT403'].includes(permission.error.code)?'denied':'unavailable');
   setRows(result.meals);setCursor(result.nextCursor);setWritable(permission.data.can_write===true);setReady(true);setMessage('');
  }catch(e){if(epoch.current===version)setMessage(error(e));}finally{if(epoch.current===version)setLoading(false);}})();
  return()=>{epoch.current++;controller.abort();adapter.dispose();if(repo.current===adapter)repo.current=null;};
 },[org,clientId,userId,day,revision]);
 useEffect(()=>{const refresh=()=>{if(!pending.current)setRevision(n=>n+1);};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
 const reset=()=>{setItems([empty()]);setEditing(null);setDirty(false);};
 const leave=()=>!pending.current&&!uncertain&&(!dirty||window.confirm('Descartar o rascunho nutricional?'));
 const change=(i:number,field:keyof Item,value:string)=>{setDirty(true);setItems(old=>old.map((r,index)=>index===i?{...r,[field]:value}:r));};
 async function mutate(operation:'save'|'void',meal:PersistedNutritionMeal|null=editing){
  const adapter=repo.current;if(!adapter||pending.current||!ready||!canWrite||uncertain)return;
  if(operation==='void'&&!window.confirm('Anular este registo, preservando o histórico?'))return;
  const command={contractVersion:1 as const,requestId:crypto.randomUUID(),mealId:meal?.mealId||null,expectedRevision:meal?.revision||0,consumedOn:day,mealKind:operation==='void'?meal!.mealKind:kind,operation,items:operation==='void'?[]:items.map(item=>({label:item.label,source:'manual' as const,quantity:{amount:Number(item.grams),unit:'g' as const},composition:{contractVersion:1 as const,basis:{amount:100 as const,unit:'g' as const},nutrients:Object.fromEntries(nutrientKeys.map(k=>[k,item[k]===''?null:Number(item[k])])) as Record<typeof nutrientKeys[number],number|null>}}))};
  pending.current=true;setBusy(true);const version=epoch.current;
  try{await adapter.save(command);if(epoch.current!==version)return;reset();setRevision(n=>n+1);}
  catch(e){if(epoch.current!==version)return;if(e instanceof NutritionPersistenceError&&e.kind==='uncertain'){setUncertain(command);setAbandoned(false);}if(e instanceof NutritionPersistenceError&&['conflict','denied'].includes(e.kind)){setReady(false);setWritable(false);setRows([]);setHistory([]);}setMessage(error(e));}
  finally{pending.current=false;if(epoch.current===version)setBusy(false);}
 }
 async function receipt(){const adapter=repo.current;if(!adapter||!uncertain||pending.current)return;pending.current=true;setBusy(true);const version=epoch.current;try{const r=await adapter.requestStatus(uncertain.requestId);if(epoch.current!==version)return;if(!r){setMessage('Ainda sem recibo. Isto não prova que o pedido falhou; não o repitas.');return;}setUncertain(null);setAbandoned(false);reset();setRevision(n=>n+1);}catch(e){if(epoch.current===version)setMessage(error(e));}finally{pending.current=false;if(epoch.current===version)setBusy(false);}}
 async function readMore(meal?:PersistedNutritionMeal,older=false){const adapter=repo.current;if(!adapter||pending.current||!ready)return;pending.current=true;setBusy(true);const version=epoch.current;try{if(meal||older){const target=meal?.mealId||historyId;const r=await adapter.history(target,older?historyCursor:null);if(epoch.current===version){setHistory(old=>older?[...old,...r.versions]:r.versions);setHistoryId(target);setHistoryCursor(r.nextCursor);}}else if(cursor){const r=await adapter.diary(day,cursor);if(epoch.current===version){setRows(old=>[...old,...r.meals]);setCursor(r.nextCursor);}}}catch(e){if(epoch.current===version){setRows([]);setHistory([]);setReady(false);setWritable(false);setMessage(error(e));}}finally{pending.current=false;if(epoch.current===version)setBusy(false);}}
 const labels={calories:'Energia (kcal)',protein:'Proteína (g)',carbs:'Hidratos (g)',fat:'Gordura (g)'};
 return <section className="panel" aria-label="Nutrição persistente" aria-busy={loading||busy}><h2>Diário nutricional</h2><p>Registos do aluno neste estabelecimento. Sem metas automáticas ou interpretação clínica. A composição manual é preservada em cada versão.</p>
  <label>Dia do diário<input type="date" max={businessToday()} value={day} disabled={busy||!!uncertain} onChange={e=>{if(leave()){reset();setDay(e.target.value);}}}/></label>
  <button className="outline" disabled={busy} onClick={()=>setRevision(n=>n+1)}>Atualizar registos</button>
  <p role="status">{loading?'A carregar registos…':message}</p>
  {!ready&&!loading&&<p>Não foram apresentados exemplos em substituição dos dados. O acesso e a disponibilidade dependem das competências e RPCs instaladas.</p>}
  {uncertain&&<NutritionUncertain requestId={uncertain.requestId} busy={busy} abandoned={abandoned} onCheck={()=>void receipt()} onAbandon={()=>setAbandoned(true)}/> }
  {ready&&<><p>{rows.length} registos carregados{cursor?' · listagem incompleta':''}. Ausência de registos não significa consumo zero.</p><div className="tablewrap"><table><thead><tr><th>Refeição</th><th>Estado</th><th>Composição registada</th><th>Ações</th></tr></thead><tbody>{rows.map(meal=>{const total=nutritionTotals(meal.items.map(({composition,quantity})=>({composition,quantity}))).nutrients;return <tr key={meal.mealId}><td>{kinds[meal.mealKind]} · versão {meal.revision}</td><td>{meal.status==='voided'?'Anulado':'Registado'}</td><td>{meal.items.map(i=>`${i.label} (${i.quantity.amount} g)`).join(', ')} · {total.calories??'—'} kcal</td><td><button className="outline" disabled={busy} onClick={()=>void readMore(meal)}>Histórico</button>{canWrite&&meal.status==='recorded'&&<><button className="outline" disabled={busy||!!uncertain} onClick={()=>{if(leave()){setEditing(meal);setKind(meal.mealKind);setItems(meal.items.map(i=>({label:i.label,grams:String(i.quantity.amount),...Object.fromEntries(nutrientKeys.map(k=>[k,i.composition.nutrients[k]===null?'':String(i.composition.nutrients[k])]))} as Item)));setDirty(true);}}}>Editar</button><button className="outline" disabled={busy||dirty||!!uncertain} onClick={()=>void mutate('void',meal)}>Anular</button></>}</td></tr>;})}</tbody></table></div>{cursor&&<button disabled={busy} onClick={()=>void readMore()}>Carregar mais registos</button>}
  {history.length>0&&<details open><summary>Histórico carregado do registo</summary><p>Histórico até à versão {history[0].revision}. {historyCursor?"Existem versões anteriores por carregar.":"Versões carregadas até ao registo original; novas alterações exigem reabrir o histórico."}</p>{historyCursor&&<button disabled={busy} onClick={()=>void readMore(undefined,true)}>Carregar versões anteriores</button>}<ul>{history.map(v=><li key={v.revision}>Versão {v.revision} · {v.consumedOn} · {v.status==='voided'?'Anulado':v.items.map(i=>`${i.label}: ${i.quantity.amount} g`).join(', ')}</li>)}</ul></details>}
  {canWrite&&!uncertain?<form onSubmit={(e:FormEvent)=>{e.preventDefault();void mutate('save');}}><h3>{editing?'Corrigir registo':'Registar refeição'}</h3><label>Tipo de refeição<select value={kind} disabled={busy} onChange={e=>{setKind(e.target.value as typeof kind);setDirty(true);}}>{Object.entries(kinds).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><p>Composição por 100 g. Campo vazio significa desconhecido; zero deve ser indicado explicitamente.</p>{items.map((item,i)=><fieldset key={i} disabled={busy}><legend>Alimento {i+1}</legend><label>Nome do alimento<input required maxLength={120} value={item.label} onChange={e=>change(i,'label',e.target.value)}/></label><label>Quantidade (g)<input required type="number" min="0.001" max="5000" step="0.001" value={item.grams} onChange={e=>change(i,'grams',e.target.value)}/></label><div className="columns">{nutrientKeys.map(k=><label key={k}>{labels[k]} por 100 g<input type="number" min="0" max={k==='calories'?1000:100} step="0.001" value={item[k]} onChange={e=>change(i,k,e.target.value)}/></label>)}</div>{items.length>1&&<button type="button" className="outline" onClick={()=>{setItems(old=>old.filter((_,n)=>n!==i));setDirty(true);}}>Remover alimento {i+1}</button>}</fieldset>)}<button type="button" className="outline" disabled={busy||items.length>=50} onClick={()=>{setItems(old=>[...old,empty()]);setDirty(true);}}>Adicionar alimento</button><button disabled={busy}>Guardar refeição</button><button type="button" className="outline" disabled={busy} onClick={()=>{if(leave())reset();}}>Descartar rascunho</button></form>:<p>Sem edição disponível neste contexto.</p>}</>}
 </section>;
}
