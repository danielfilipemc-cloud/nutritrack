'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '../lib/supabase';
import {RequestScope} from '../lib/request-scope';
import {downloadVisibleExport,foundationError} from '../lib/foundations';
type Props={org:string;clientId:string;student?:boolean;onDirtyChange?:(dirty:boolean)=>void};
type Context={can_review:boolean;consents:{purpose:string;accepted:boolean;document_version:string}[];requests:{id:string;kind:string;status:string;revision:number}[]};
type Review={status:string;reference:string;revision:number;created_at:string};
const labels:Record<string,string>={requested:'Pedido registado',in_review:'Em análise',blocked:'Aguarda decisão',withdrawn:'Retirado'};
export default function PrivacyPanel(props:Props){return <PrivacyWorkspace key={`${props.org}:${props.clientId}:${!!props.student}`} {...props}/>;}
function PrivacyWorkspace({org,clientId,student=false,onDirtyChange}:Props){
 const reads=useRef(new RequestScope()),writes=useRef(new RequestScope()),historyReads=useRef(new RequestScope()),pending=useRef(false);
 const [data,setData]=useState<Context|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0),[reference,setReference]=useState(''),[loading,setLoading]=useState(true),[uncertain,setUncertain]=useState(false),[history,setHistory]=useState<Review[]|null>(null),[historyBusy,setHistoryBusy]=useState(false);
 useEffect(()=>{const dirty=!!reference.trim()||busy;onDirtyChange?.(dirty);const leave=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',leave);return()=>{onDirtyChange?.(false);window.removeEventListener('beforeunload',leave);};},[reference,busy,onDirtyChange]);
 useEffect(()=>{const valid=reads.current.begin();setData(null);setLoading(true);setHistory(null);historyReads.current.invalidate();setHistoryBusy(false);
 void(async()=>{try{if(!db)throw Error();const r=await db.rpc('aura_privacy_context',{p_org:org,p_client:clientId});if(!valid())return;if(r.error||!r.data){setMessage(foundationError(r.error));return;}setData(r.data);setUncertain(false);}catch{if(valid())setMessage('Não foi possível carregar os pedidos. Tenta atualizar.');}finally{if(valid())setLoading(false);}})();
 return()=>{reads.current.invalidate();writes.current.invalidate();historyReads.current.invalidate();};},[org,clientId,reload]);
 async function action(name:string,params:Record<string,unknown>,download=false){
  if(!db||pending.current||!data||loading||uncertain)return;pending.current=true;const valid=writes.current.begin();setBusy(true);setMessage('');
  try{const r=await db.rpc(name,params);if(!valid())return;
   if(r.error){if(r.error.code==='PT409'||r.status===0||r.status>=500){setUncertain(true);setMessage('O resultado mudou ou não foi confirmado. Atualiza os pedidos antes de repetir; a referência foi preservada.');}else{setMessage(foundationError(r.error));if(r.error.code==='42501'||r.status===401||r.status===403)setData(null);}return;}
   if(download)downloadVisibleExport(r.data,clientId);else{setReference('');setReload(v=>v+1);}setMessage(download?'Ficheiro preparado com os registos a que tens acesso.':'Registo guardado.');
  }catch{if(valid()){setUncertain(true);setMessage('Gravação não confirmada. Atualiza os pedidos antes de repetir; a referência foi preservada.');}}
  finally{pending.current=false;if(valid())setBusy(false);}
 }
 async function loadHistory(id:string){if(!db||historyBusy||!data?.can_review)return;const valid=historyReads.current.begin();setHistoryBusy(true);setHistory(null);
  try{const r=await db.rpc('aura_privacy_review_history',{p_org:org,p_client:clientId,p_request:id});if(!valid())return;if(r.error)throw Error();setHistory(r.data||[]);}catch{if(valid())setMessage('Não foi possível carregar o histórico de revisão.');}finally{if(valid())setHistoryBusy(false);}
 }
 const disabled=busy||loading||!data||uncertain,manager=!student&&data?.can_review===true;
 return <section className="panel" aria-label="Privacidade e dados" aria-busy={busy||loading}><h2>Privacidade e dados</h2><p>A exportação contém apenas registos acessíveis nesta área. Pedidos completos ou de eliminação ficam sujeitos a análise; não apagam dados automaticamente.</p>
 <button className="outline" disabled={disabled} onClick={()=>void action('aura_visible_export',{p_org:org,p_client:clientId},true)}>Exportar registos acessíveis</button>
 <div className="aura-quick-actions"><button className="outline" disabled={disabled} onClick={()=>void action('aura_privacy_request_create',{p_org:org,p_client:clientId,p_kind:'export'})}>Pedir exportação completa</button><button className="outline" disabled={disabled} onClick={()=>{if(window.confirm('Registar pedido de eliminação para análise? Os dados não serão apagados agora.'))void action('aura_privacy_request_create',{p_org:org,p_client:clientId,p_kind:'erasure'});}}>Pedir eliminação</button></div>
 <button className="outline" disabled={busy||loading} onClick={()=>{setMessage('');setReload(v=>v+1);}}>Atualizar pedidos</button>
 {!data?<><p role={loading?'status':undefined}>{loading?'A carregar preferências e pedidos...':'Dados indisponíveis.'}</p>{!loading&&<button className="outline" onClick={()=>setReload(v=>v+1)}>Tentar novamente</button>}</>:<>
 {student&&<><h3>Preferências opcionais</h3><p>Preferências para fotografias de evolução e notificações opcionais. Ainda não são enviados ficheiros ou notificações por esta área.</p>{(['progress_photos','optional_notifications'] as const).map(p=>{const enabled=data.consents.find(c=>c.purpose===p)?.accepted===true;return <div key={p}><span>{p==='progress_photos'?'Fotografias de evolução':'Notificações opcionais'}: {enabled?'autorizado':'sem autorização'}</span><button className="outline" disabled={disabled} onClick={()=>void action('aura_consent_set',{p_org:org,p_client:clientId,p_purpose:p,p_version:'preferences-v1',p_accepted:!enabled})}>{enabled?'Retirar autorização':'Autorizar'}</button></div>;})}</>}
 <h3>Pedidos</h3><p>Até 50 pedidos mais recentes {student?'criados pela tua conta':'deste aluno'}. A decisão jurídica e a execução ficam fora desta área.</p>
 {!data.requests.length?<p>Sem pedidos registados.</p>:<ul>{data.requests.map(r=><li key={r.id}>{r.kind==='erasure'?'Eliminação':'Exportação completa'} · {labels[r.status]||r.status}{manager&&<div className="aura-quick-actions"><button className="outline" disabled={disabled||r.status==='withdrawn'||reference.trim().length<5} onClick={()=>void action('aura_privacy_review',{p_org:org,p_request:r.id,p_status:'in_review',p_reference:reference,p_revision:r.revision})}>Marcar em análise</button><button className="outline" disabled={disabled||r.status==='withdrawn'||reference.trim().length<5} onClick={()=>{if(window.confirm('Registar bloqueio para análise? Este pedido fica pendente e nenhum dado será eliminado.'))void action('aura_privacy_review',{p_org:org,p_request:r.id,p_status:'blocked',p_reference:reference,p_revision:r.revision});}}>Registar bloqueio</button><button className="outline" disabled={busy||historyBusy} onClick={()=>void loadHistory(r.id)}>Histórico de revisão</button></div>}</li>)}</ul>}
 {manager&&<label>Referência da revisão (sem dados sensíveis)<input minLength={5} maxLength={200} value={reference} disabled={busy} onChange={e=>setReference(e.target.value)}/></label>}
 {history&&<div><h3>Revisões registadas nesta versão</h3><p>Até 50 revisões. As referências anteriores à introdução deste histórico não são reconstruídas.</p>{!history.length?<p>Sem revisões neste histórico.</p>:<ol>{history.map(r=><li key={r.revision}>{labels[r.status]||r.status} · revisão {r.revision} · {r.reference}</li>)}</ol>}</div>}
 </>}
 <p role="status">{message}</p></section>;
}
