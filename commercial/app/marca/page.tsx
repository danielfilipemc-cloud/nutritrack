"use client";
import {useEffect,useState,useRef,type FormEvent} from "react";
import {db} from "../../lib/supabase";
import {RequestScope} from "../../lib/request-scope";
import {validName} from "../../lib/validation";
import {useProfessional} from "../../lib/use-professional";
import BrandHeader,{type Branding} from "../../components/BrandHeader";
import ProfessionalShell from "../../components/ProfessionalShell";
import OrganizationSelect from "../../components/OrganizationSelect";
const defaults:Branding={display_name:"AURA",primary_color:"#137F79",logo_url:null};
export default function Marca(){
 const {user,orgs,org,setOrg,status:authStatus}=useProfessional();
 const scope=useRef(new RequestScope());
 const [ready,setReady]=useState(false),[brand,setBrand]=useState<Branding>(defaults),[status,setStatus]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const current=orgs.find(o=>o.id===org),canEdit=current?.role==="owner"||current?.role==="admin";
 useEffect(()=>{setReady(false);setBusy(false);setBrand({...defaults,display_name:current?.name||"AURA"});setStatus("");
 if(!db||!org||!user)return;const valid=scope.current.begin();setStatus("A carregar identidade...");
 void db.from("organization_branding").select("display_name,primary_color,logo_url").eq("organization_id",org).maybeSingle().then(({data,error})=>{
 if(!valid())return;if(error){setStatus("Não foi possível carregar a identidade.");return;}
 setReady(true);setBrand(data||{...defaults,display_name:current?.name||"AURA"});setStatus("");});
 return()=>{scope.current.invalidate();};},[org,user?.id,current?.name,revision]);
 async function save(e:FormEvent){e.preventDefault();if(!db||!org||!user||!canEdit||!ready||busy)return;
 if(!/^#[0-9a-fA-F]{6}$/.test(brand.primary_color)||!validName(brand.display_name,100)){setStatus("Nome ou cor inválidos.");return;}
 const valid=scope.current.begin();setBusy(true);setStatus("A guardar...");
 try{const {error}=await db.from("organization_branding").upsert({organization_id:org,display_name:brand.display_name.trim(),primary_color:brand.primary_color,logo_url:brand.logo_url,updated_by:user.id},{onConflict:"organization_id"});
 if(valid())setStatus(error?"Não foi possível guardar. Confirma as tuas permissões.":"Identidade guardada para este estabelecimento.");
 }catch{if(valid())setStatus("Falha de ligação ao guardar identidade.");}finally{if(valid())setBusy(false);}}
 return <ProfessionalShell title="Identidade do estabelecimento">
 <div className="heading"><div><span className="eyebrow">WHITE LABEL</span><h1>A tua marca, a nossa tecnologia.</h1><p>Personaliza a identidade visual do teu estabelecimento.</p></div><OrganizationSelect organizations={orgs} value={org} disabled={busy} onChange={id=>{scope.current.invalidate();setReady(false);setOrg(id);}}/></div>
 {!user&&<a href="/" className="outline link">Iniciar sessão</a>}
 {org&&<div className="columns"><section className="panel"><h2>Configurações</h2><form onSubmit={save}><label>Nome da marca<input value={brand.display_name} minLength={2} maxLength={100} disabled={!canEdit||!ready||busy} onChange={e=>setBrand({...brand,display_name:e.target.value})} required/></label><label>Cor principal<input type="color" value={brand.primary_color} disabled={!canEdit||!ready||busy} onChange={e=>setBrand({...brand,primary_color:e.target.value})}/></label><p>O texto sobre a cor da marca adapta-se automaticamente para garantir contraste. O logótipo aguarda infraestrutura segura de uploads.</p><button disabled={!canEdit||!ready||busy}>Guardar identidade</button>{!canEdit&&<p>Apenas administradores e responsáveis podem editar a marca.</p>}</form>{!ready&&<button className="outline" onClick={()=>setRevision(v=>v+1)}>Tentar novamente</button>}</section><section className="panel"><h2>Pré-visualização</h2><BrandHeader branding={ready?brand:{...defaults,display_name:current?.name||"AURA"}} subtitle="Área de acompanhamento"/><p>Identidade apresentada ao profissional e, futuramente, aos alunos.</p></section></div>}
 <p role="status" className="status">{status||authStatus}</p></ProfessionalShell>;
}
