'use client';
import AuraBrand from '../../components/AuraBrand';
import {useEffect,useRef,useState} from 'react';
import {db} from '../../lib/supabase';
import {useProfessional} from '../../lib/use-professional';
import {RequestScope} from '../../lib/request-scope';
import {foundationError} from '../../lib/foundations';
import PrivacyPanel from '../../components/PrivacyPanel';
import SecurityRequirement from '../../components/SecurityRequirement';
import NutritionWorkspace from '../../components/NutritionWorkspace';
import PersonalNutritionExport from '../../components/PersonalNutritionExport';
import SessionActions from '../../components/SessionActions';
import {useDraftNavigation} from '../../lib/use-draft-navigation';
type Link={organization_id:string;client_id:string;clients:{full_name:string}|null};
type Record={id:string;assessed_on:string;weight_kg:number|null;height_cm:number|null;waist_cm:number|null};
export default function Student(){
 const {user,authLoading}=useProfessional(),personal=process.env.NEXT_PUBLIC_AURA_PERSONAL_NUTRITION==='1';
 const [links,setLinks]=useState<Link[]>([]),[choice,setChoice]=useState(''),[rows,setRows]=useState<Record[]>([]),[page,setPage]=useState(0),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[linkedFor,setLinkedFor]=useState(''),[area,setArea]=useState('nutrition');
 const scope=useRef(new RequestScope()),read=useRef(new RequestScope());
 const drafts=useRef({nutrition:{dirty:false,pending:false},privacy:{dirty:false,pending:false}});
 const draftState=()=>({dirty:Object.values(drafts.current).some(v=>v.dirty),pending:Object.values(drafts.current).some(v=>v.pending)});
 const blocked=()=>setMessage('Aguarda a confirmação da operação antes de sair.');useDraftNavigation(draftState,blocked);
 const leave=()=>{const state=draftState();if(state.pending){blocked();return false;}return !state.dirty||window.confirm('Descartar os rascunhos antes de mudar de acompanhamento?');};
 useEffect(()=>{
  setLinkedFor('');setLinks([]);setChoice('');setRows([]);if(!db||!user){setLoading(false);return;}const valid=scope.current.begin();setLoading(true);
  void Promise.resolve(db.from('client_users').select('organization_id,client_id,clients(full_name)').eq('user_id',user.id).is('revoked_at',null)).then(r=>{if(!valid())return;setLoading(false);if(r.error){setMessage(foundationError(r.error));return;}const found=(r.data||[]) as unknown as Link[];setLinks(found);setLinkedFor(user.id);setChoice(found[0]?.client_id||'');}).catch(()=>{if(valid()){setLoading(false);setMessage('Não foi possível carregar os acompanhamentos. Atualiza a página.');}});
  return()=>scope.current.invalidate();
 },[user?.id]);
 const currentLinks=linkedFor===user?.id?links:[],selected=currentLinks.find(l=>l.client_id===choice);
 useEffect(()=>{
  setRows([]);setMessage('');if(!db||!selected)return;if(personal&&area!=='measurements'){setLoading(false);return;}const valid=read.current.begin();setLoading(true);
  void Promise.resolve(db.rpc('aura_student_assessments',{p_org:selected.organization_id,p_client:selected.client_id,p_offset:page*25})).then(r=>{if(!valid())return;setLoading(false);if(r.error)setMessage(foundationError(r.error));else setRows(r.data||[]);}).catch(()=>{if(valid()){setLoading(false);setMessage('Não foi possível carregar as medições. Atualiza a página.');}});
  return()=>read.current.invalidate();
 },[choice,user?.id,page,selected?.organization_id,area,personal]);
 return <main className={'shell'+(personal?' aura-personal-workspace':'')} id="main-content" tabIndex={-1}>
  <header><div><AuraBrand/><p>Área do aluno</p></div><a className="outline link" href={process.env.NEXT_PUBLIC_AURA_PRIVATE_PORTAL==='1'?'/recuperar':'/'}>{process.env.NEXT_PUBLIC_AURA_PRIVATE_PORTAL==='1'?'Palavra-passe':'Conta'}</a>{personal&&<a className="outline link" href="/instalar">Instalar no telemóvel</a>}{personal&&user&&<SessionActions/>}</header>
  <h1>O teu espaço</h1>
  {authLoading?<p role="status">A verificar sessão...</p>:!user?<a href="/" className="outline link">Iniciar sessão</a>:<>
   {loading&&<p role="status">A carregar registos...</p>}{!loading&&!currentLinks.length&&<p>A tua conta ainda não está ligada a um acompanhamento. Aceita o convite pessoal enviado pelo teu profissional.</p>}
   {currentLinks.length>1&&<label>Acompanhamento<select value={choice} onChange={e=>{if(!leave())return;read.current.invalidate();setRows([]);setPage(0);setChoice(e.target.value);}}>{currentLinks.map(l=><option key={l.client_id} value={l.client_id}>{l.clients?.full_name||'Acompanhamento'}</option>)}</select></label>}
   {selected&&<>
    <SecurityRequirement key={selected.organization_id} org={selected.organization_id}/><h2>{selected.clients?.full_name||'O teu acompanhamento'}</h2>
    {personal&&<nav className="aura-nutrition-tabs" aria-label="Áreas do teu acompanhamento">{[['nutrition','Nutrição privada'],['measurements','Medições'],['privacy','Privacidade']].map(([value,label])=><button key={value} className="outline" aria-pressed={area===value} onClick={()=>{if(draftState().pending){blocked();return;}setArea(value);}}>{label}</button>)}</nav>}
    {personal&&<div hidden={area!=='nutrition'}><NutritionWorkspace key={`self:${user.id}:${selected.organization_id}:${selected.client_id}`} access="student" org={selected.organization_id} clientId={selected.client_id} userId={user.id} onDirtyChange={(dirty,pending=false)=>{drafts.current.nutrition={dirty,pending};}}/></div>}
    <div hidden={personal&&area!=='measurements'}><section className="panel"><h3>Medições partilhadas</h3><p>Apenas medições partilhadas pelo profissional. Notas internas não são apresentadas.</p><div className="tablewrap"><table><thead><tr><th>Data</th><th>Peso</th><th>Altura</th><th>Cintura</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.assessed_on}</td><td>{r.weight_kg??'—'}</td><td>{r.height_cm??'—'}</td><td>{r.waist_cm??'—'}</td></tr>)}</tbody></table></div>{!loading&&!rows.length&&<p>Sem medições partilhadas nesta página.</p>}<button className="outline" disabled={loading||page===0} onClick={()=>setPage(p=>p-1)}>Anterior</button><button className="outline" disabled={loading||rows.length<25} onClick={()=>setPage(p=>p+1)}>Seguinte</button></section></div>
    <div hidden={personal&&area!=='privacy'}>{personal&&<PersonalNutritionExport key={`export:${user.id}:${selected.organization_id}:${selected.client_id}`} org={selected.organization_id} clientId={selected.client_id} userId={user.id}/>}<PrivacyPanel key={`${user.id}:${selected.organization_id}:${selected.client_id}`} org={selected.organization_id} clientId={selected.client_id} student onDirtyChange={(dirty,pending=false)=>{drafts.current.privacy={dirty,pending};}}/>{personal&&<p>A exportação nutricional é separada da exportação de medições partilhadas. Retenção e pedidos de eliminação continuam sujeitos a análise.</p>}</div>
   </>}
  </>}
  <p role="status">{message}</p>
 </main>;
}
