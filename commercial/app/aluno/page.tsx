'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '../../lib/supabase';
import {useProfessional} from '../../lib/use-professional';
import {RequestScope} from '../../lib/request-scope';
import {foundationError} from '../../lib/foundations';
import PrivacyPanel from '../../components/PrivacyPanel';
import SecurityRequirement from '../../components/SecurityRequirement';
type Link={organization_id:string;client_id:string;clients:{full_name:string}|null};
type Record={id:string;assessed_on:string;weight_kg:number|null;height_cm:number|null;waist_cm:number|null};
export default function Student(){
 const {user,authLoading}=useProfessional();const [links,setLinks]=useState<Link[]>([]),[choice,setChoice]=useState(''),[rows,setRows]=useState<Record[]>([]),[page,setPage]=useState(0),[message,setMessage]=useState(''),[loading,setLoading]=useState(true);const scope=useRef(new RequestScope()),read=useRef(new RequestScope());const [linkedFor,setLinkedFor]=useState('');
 useEffect(()=>{setLinkedFor('');setLinks([]);setChoice('');setRows([]);if(!db||!user){setLoading(false);return;}const valid=scope.current.begin();setLoading(true);
 void Promise.resolve(db.from('client_users').select('organization_id,client_id,clients(full_name)').is('revoked_at',null)).then(r=>{if(!valid())return;setLoading(false);if(r.error){setMessage(foundationError(r.error));return;}const found=(r.data||[]) as unknown as Link[];setLinks(found);setLinkedFor(user.id);setChoice(found[0]?.client_id||'');}).catch(()=>{if(valid()){setLoading(false);setMessage('Não foi possível carregar os acompanhamentos. Atualiza a página.');}});return()=>scope.current.invalidate();},[user?.id]);
 const currentLinks=linkedFor===user?.id?links:[];const selected=currentLinks.find(l=>l.client_id===choice);
 useEffect(()=>{setRows([]);setMessage('');if(!db||!selected)return;const valid=read.current.begin();setLoading(true);void Promise.resolve(db.rpc('aura_student_assessments',{p_org:selected.organization_id,p_client:selected.client_id,p_offset:page*25})).then(r=>{if(!valid())return;setLoading(false);if(r.error)setMessage(foundationError(r.error));else setRows(r.data||[]);}).catch(()=>{if(valid()){setLoading(false);setMessage('Não foi possível carregar as medições. Atualiza a página.');}});return()=>read.current.invalidate();},[choice,user?.id,page,selected?.organization_id]);
 return <main className="shell" id="main-content" tabIndex={-1}><header><strong>AURA · Aluno</strong><a className="outline link" href="/">Conta</a></header><h1>O teu espaço</h1>
 {authLoading?<p role="status">A verificar sessão...</p>:!user?<a href="/" className="outline link">Iniciar sessão</a>:<>{loading&&<p role="status">A carregar registos...</p>}{!loading&&!currentLinks.length&&<p>A tua conta ainda não está ligada a um acompanhamento. Aceita o convite pessoal enviado pelo teu profissional.</p>}
 {currentLinks.length>1&&<label>Acompanhamento<select value={choice} onChange={e=>{read.current.invalidate();setRows([]);setPage(0);setChoice(e.target.value);}}>{currentLinks.map(l=><option key={l.client_id} value={l.client_id}>{l.clients?.full_name||'Acompanhamento'}</option>)}</select></label>}
 {selected&&<><SecurityRequirement key={selected.organization_id} org={selected.organization_id}/><h2>{selected.clients?.full_name||'O teu acompanhamento'}</h2><section className="panel"><h3>Medições partilhadas</h3><p>Apenas medições partilhadas pelo profissional. Notas internas não são apresentadas.</p><div className="tablewrap"><table><thead><tr><th>Data</th><th>Peso</th><th>Altura</th><th>Cintura</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.assessed_on}</td><td>{r.weight_kg??'—'}</td><td>{r.height_cm??'—'}</td><td>{r.waist_cm??'—'}</td></tr>)}</tbody></table></div>{!loading&&!rows.length&&<p>Sem medições partilhadas nesta página.</p>}<button className="outline" disabled={loading||page===0} onClick={()=>setPage(p=>p-1)}>Anterior</button><button className="outline" disabled={loading||rows.length<25} onClick={()=>setPage(p=>p+1)}>Seguinte</button></section><PrivacyPanel key={`${user.id}:${selected.client_id}`} org={selected.organization_id} clientId={selected.client_id} student/></>}
 </>}<p role="status">{message}</p></main>;
}
