"use client";
import {useEffect,useState,type FormEvent} from "react";
import {createClient} from "@supabase/supabase-js";
import BrandHeader,{type Branding} from "../../components/BrandHeader";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db=url&&key?createClient(url,key):null;
type Organization={id:string;name:string;role:string};
const defaults:Branding={display_name:"AURA",primary_color:"#137F79",logo_url:null};
export default function Marca(){
 const [user,setUser]=useState(""),[orgs,setOrgs]=useState<Organization[]>([]),[org,setOrg]=useState("");
 const [brand,setBrand]=useState<Branding>(defaults),[status,setStatus]=useState("A verificar sessão..."),[busy,setBusy]=useState(false);
 const current=orgs.find(o=>o.id===org),canEdit=current?.role==="owner"||current?.role==="admin";
 useEffect(()=>{if(!db){setStatus("Supabase não configurado.");return;}let alive=true;
 db.auth.getUser().then(async ({data,error})=>{if(!alive)return;if(error||!data.user){setStatus("É necessário iniciar sessão.");return;}
 setUser(data.user.id);const result=await db!.from("organization_members").select("organization_id,role,organizations(id,name)");
 if(!alive)return;if(result.error){setStatus("Não foi possível carregar organizações.");return;}
 const list=(result.data||[]).flatMap((x:any)=>{const o=Array.isArray(x.organizations)?x.organizations[0]:x.organizations;return o?[{id:o.id,name:o.name,role:x.role}]:[]});
 setOrgs(list);setOrg(list[0]?.id||"");setStatus(list.length?"":"Nenhum estabelecimento associado.");});
 return()=>{alive=false};},[]);
 useEffect(()=>{if(!db||!org)return;let alive=true;setBrand({...defaults,display_name:current?.name||"AURA"});setStatus("A carregar identidade...");
 db.from("organization_branding").select("display_name,primary_color,logo_url").eq("organization_id",org).maybeSingle().then(({data,error})=>{
 if(!alive)return;if(error){setStatus("Não foi possível carregar a identidade. Aplica a migração 003.");return;}
 setBrand(data||{...defaults,display_name:current?.name||"AURA"});setStatus("");});
 return()=>{alive=false};},[org,current?.name]);
 async function save(e:FormEvent){e.preventDefault();if(!db||!org||!user||!canEdit||busy)return;
 if(!/^#[0-9a-fA-F]{6}$/.test(brand.primary_color)||brand.display_name.trim().length<2){setStatus("Nome ou cor inválidos.");return;}
 setBusy(true);setStatus("A guardar...");
 const {error}=await db.from("organization_branding").upsert({organization_id:org,display_name:brand.display_name.trim(),primary_color:brand.primary_color,logo_url:null,updated_by:user,updated_at:new Date().toISOString()},{onConflict:"organization_id"});
 setBusy(false);setStatus(error?"Não foi possível guardar. Confirma as tuas permissões.":"Identidade guardada para este estabelecimento.");}
 return <main className="shell"><header><div><strong>AURA <span style={{color:"#137F79"}}>Business</span></strong><p>Identidade do estabelecimento</p></div><a href="/" className="outline link">Voltar ao painel</a></header>
 <div className="heading"><div><span className="eyebrow">WHITE LABEL</span><h1>A tua marca, a nossa tecnologia.</h1><p>Personaliza a identidade visual. Os dados continuam isolados por organização.</p></div><label>Estabelecimento<select value={org} onChange={e=>setOrg(e.target.value)}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label></div>
 {org&&<div className="columns"><section className="panel"><h2>Configurações</h2><form onSubmit={save}><label>Nome da marca<input value={brand.display_name} minLength={2} maxLength={100} disabled={!canEdit} onChange={e=>setBrand({...brand,display_name:e.target.value})} required/></label><label>Cor principal<input type="color" value={brand.primary_color} disabled={!canEdit} onChange={e=>setBrand({...brand,primary_color:e.target.value})}/></label><p>Logótipo, domínio próprio e PWA com a marca serão adicionados numa fase posterior.</p><button disabled={!canEdit||busy}>Guardar identidade</button>{!canEdit&&<p>Apenas administradores e responsáveis podem editar a marca.</p>}</form></section><section className="panel"><h2>Pré-visualização</h2><BrandHeader branding={brand} subtitle="Área de acompanhamento"/><p>Identidade apresentada ao profissional e, futuramente, aos alunos.</p></section></div>}
 <p role="status" className="status">{status}</p><footer>Protótipo em desenvolvimento. Não inserir dados de saúde reais.</footer></main>;
}
