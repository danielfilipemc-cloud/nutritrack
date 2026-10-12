"use client";
import { useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Client = { id:string; full_name:string; created_at:string };
type Organization = { id:string; name:string; role:string };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
function client():SupabaseClient|null { return url && key ? createClient(url,key) : null; }
const supabase = client();
export default function Home(){
 const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
 const [signedIn,setSignedIn]=useState(false); const [organizations,setOrganizations]=useState<Organization[]>([]);
 const [org,setOrg]=useState(""); const [clients,setClients]=useState<Client[]>([]); const [status,setStatus]=useState("A iniciar...");
 useEffect(()=>{if(!supabase){setStatus("Configura o novo projeto Supabase no ficheiro .env.local");return;}const db=supabase;
 db.auth.getUser().then(({data,error})=>{setSignedIn(Boolean(data.user)&&!error);setStatus(error?"Não foi possível validar a sessão.":"");});
 const {data:{subscription}}=db.auth.onAuthStateChange((_evt,session)=>{setSignedIn(Boolean(session));});return ()=>subscription.unsubscribe();},[]);
 useEffect(()=>{if(!supabase||!signedIn){setOrganizations([]);setOrg("");setClients([]);return;}let active=true;
 (async()=>{const {data,error}=await supabase!.from("organization_members").select("organization_id,role,organizations(id,name)");
 if(!active)return;if(error){setStatus("Erro ao carregar organizações.");return;}
 const items=(data||[]).flatMap((row:any)=>{const o=Array.isArray(row.organizations)?row.organizations[0]:row.organizations;return o?[{id:o.id,name:o.name,role:row.role}]:[];});
 setOrganizations(items);setOrg(prev=>items.some((i:Organization)=>i.id===prev)?prev:(items[0]?.id||""));setStatus(items.length?"":"Ainda não tens uma organização associada.");})();return()=>{active=false};},[signedIn]);
 useEffect(()=>{if(!supabase||!signedIn||!org){setClients([]);return;}let active=true;setStatus("A carregar alunos...");
 supabase.from("clients").select("id,full_name,created_at").eq("organization_id",org).order("created_at",{ascending:false}).limit(100).then(({data,error})=>{if(!active)return;setClients(data||[]);setStatus(error?"Não foi possível carregar alunos.":"");});return()=>{active=false};},[signedIn,org]);
 async function login(e:React.FormEvent){e.preventDefault();if(!supabase)return;setStatus("A autenticar...");const {error}=await supabase.auth.signInWithPassword({email,password});setPassword("");setStatus(error?"Credenciais inválidas ou conta não autorizada.":"");}
 async function logout(){if(!supabase)return;await supabase.auth.signOut();setSignedIn(false);setClients([]);}
 return <main className="shell"><header><div><strong>◉ NutriTrack <span>Business</span></strong><p>Gestão de acompanhamento profissional</p></div>{signedIn&&<button className="outline" onClick={logout}>Terminar sessão</button>}</header>
 {!signedIn?<section className="login"><span className="eyebrow">ACESSO PROFISSIONAL</span><h1>O teu espaço de acompanhamento, organizado.</h1><p>Entra com uma conta previamente autorizada pela tua organização.</p><form onSubmit={login}><label>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>Palavra-passe<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><button disabled={!supabase}>Entrar na plataforma</button></form></section>:<><div className="heading"><div><span className="eyebrow">PAINEL PROFISSIONAL</span><h1>Visão geral</h1><p>Consulta os clientes atribuídos à organização selecionada.</p></div><label>Organização<select value={org} onChange={e=>setOrg(e.target.value)}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name} — {o.role}</option>)}</select></label></div><div className="stat"><div><span>Alunos apresentados</span><strong>{clients.length}</strong><small>Máximo de 100 nesta primeira versão</small></div><div><span>Organizações autorizadas</span><strong>{organizations.length}</strong><small>Isolamento por organização</small></div></div><section className="panel"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><h2>Alunos</h2><a href="/avaliacoes" className="outline link">Gerir alunos e avaliações →</a><a href="/marca" className="outline link">Personalizar marca →</a></div>{clients.length?<table><thead><tr><th>Nome</th><th>Registo</th></tr></thead><tbody>{clients.map(c=><tr key={c.id}><td>{c.full_name}</td><td>{new Date(c.created_at).toLocaleDateString("pt-PT")}</td></tr>)}</tbody></table>:<p>Sem alunos para apresentar.</p>}</section></>}
 <p role="status" className="status">{status}</p><footer>NutriTrack Business · Fundação de desenvolvimento — não usar com dados clínicos reais nesta fase.</footer></main>;
}
