import AppNavigation from "../components/AppNavigation";
"use client";
import { useEffect, useState, useRef } from "react";
import {db} from "../lib/supabase";
import {RequestScope} from "../lib/request-scope";
import BrandHeader, {type Branding} from "../components/BrandHeader";

type Client = { id:string; full_name:string; created_at:string };
type Organization = { id:string; name:string; role:string };
const supabase = db;
export default function Home(){
 const identity=useRef("");
 const scope=useRef(new RequestScope());
 const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
 const [signedIn,setSignedIn]=useState(""); const [organizations,setOrganizations]=useState<Organization[]>([]);
 const [org,setOrg]=useState(""); const [branding,setBranding]=useState<Branding|null>(null); const [clients,setClients]=useState<Client[]>([]); const [status,setStatus]=useState("A iniciar...");
 useEffect(()=>{if(!supabase){setStatus("Configura o novo projeto Supabase no ficheiro .env.local");return;}const db=supabase;
 const syncIdentity=(id:string)=>{if(identity.current!==id){scope.current.invalidate();identity.current=id;setBranding(null);setOrg("");setOrganizations([]);setClients([]);}setSignedIn(id);};
 db.auth.getUser().then(({data,error})=>{syncIdentity(!error?data.user?.id||"":"");setStatus(error?"Não foi possível validar a sessão.":"");});
 const {data:{subscription}}=db.auth.onAuthStateChange((_evt,session)=>syncIdentity(session?.user.id||""));return ()=>{scope.current.invalidate();subscription.unsubscribe();};},[]);
 useEffect(()=>{if(!supabase||!signedIn){setOrganizations([]);setOrg("");setClients([]);return;}let active=true;
 (async()=>{const {data,error}=await supabase!.from("organization_members").select("organization_id,role,organizations(id,name)");
 if(!active)return;if(error){setStatus("Erro ao carregar organizações.");return;}
 const items=(data||[]).flatMap((row:any)=>{const o=Array.isArray(row.organizations)?row.organizations[0]:row.organizations;return o?[{id:o.id,name:o.name,role:row.role}]:[];});
 setOrganizations(items);setOrg(prev=>items.some((i:Organization)=>i.id===prev)?prev:(items[0]?.id||""));setStatus(items.length?"":"Ainda não tens uma organização associada.");})();return()=>{active=false};},[signedIn]);
 useEffect(()=>{if(!supabase||!signedIn||!org){setClients([]);setBranding(null);return;}let active=true;const isCurrent=scope.current.begin();setClients([]);setBranding(null);setStatus("A carregar alunos...");
 Promise.all([supabase.from("clients").select("id,full_name,created_at").eq("organization_id",org).order("created_at",{ascending:false}).limit(100),supabase.from("organization_branding").select("display_name,primary_color,logo_url").eq("organization_id",org).maybeSingle()]).then(([c,b])=>{if(!active||!isCurrent())return;setClients(c.data||[]);setBranding(b.error?null:b.data);setStatus(c.error?"Não foi possível carregar alunos.":"");});return()=>{active=false};},[signedIn,org]);
 async function login(e:React.FormEvent){e.preventDefault();if(!supabase)return;setStatus("A autenticar...");const {error}=await supabase.auth.signInWithPassword({email,password});setPassword("");setStatus(error?"Credenciais inválidas ou conta não autorizada.":"");}
 async function logout(){if(!supabase)return;await supabase.auth.signOut();setSignedIn("");setClients([]);}
 return <div className={signedIn?"aura-workspace":undefined}>{signedIn&&<AppNavigation/>}<main className="shell"><header><div><strong>◉ AURA <span>Business</span></strong><p>Gestão de acompanhamento profissional</p></div>{signedIn&&<button className="outline" onClick={logout}>Terminar sessão</button>}</header>
 {!signedIn?<section className="login"><span className="eyebrow">ACESSO PROFISSIONAL</span><h1>O teu espaço de acompanhamento, organizado.</h1><p>Entra com uma conta previamente autorizada pela tua organização.</p><form onSubmit={login}><label>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>Palavra-passe<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><button disabled={!supabase}>Entrar na plataforma</button></form><p><a href="/demo" className="outline link">Explorar demonstração →</a></p></section>:<><div className="heading"><div><span className="eyebrow">PAINEL PROFISSIONAL</span><h1>Visão geral</h1><p>Consulta os clientes atribuídos à organização selecionada.</p></div><label>Organização<select value={org} onChange={e=>{scope.current.invalidate();setClients([]);setBranding(null);setOrg(e.target.value)}}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name} — {o.role}</option>)}</select></label></div><BrandHeader branding={branding || {display_name:organizations.find(o=>o.id===org)?.name||"AURA",primary_color:"#137F79",logo_url:null}} subtitle="Painel do estabelecimento"/><div className="stat"><div><span>Alunos apresentados</span><strong>{clients.length}</strong><small>Máximo de 100 nesta primeira versão</small></div><div><span>Organizações autorizadas</span><strong>{organizations.length}</strong><small>Isolamento por organização</small></div></div><section className="panel"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><h2>Alunos</h2><a href="/avaliacoes" className="outline link">Gerir alunos e avaliações →</a><a href="/marca" className="outline link">Personalizar marca →</a></div>{clients.length?<table><thead><tr><th>Nome</th><th>Registo</th></tr></thead><tbody>{clients.map(c=><tr key={c.id}><td>{c.full_name}</td><td>{new Date(c.created_at).toLocaleDateString("pt-PT")}</td></tr>)}</tbody></table>:<p>Sem alunos para apresentar.</p>}</section></>}
 <p role="status" className="status">{status}</p><footer>AURA Business · Fundação de desenvolvimento — não usar com dados clínicos reais nesta fase.</footer></main></div>;
}
