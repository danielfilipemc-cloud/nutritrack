"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import {db} from "../../lib/supabase";
import {RequestScope} from "../../lib/request-scope";
import {measurement,validDate,validName} from "../../lib/validation";
import ProgressChart from "../../components/ProgressChart";
import BrandHeader,{type Branding} from "../../components/BrandHeader";
type Org = {id:string;name:string};
type Student = {id:string;full_name:string};
type Assessment = {id:string;client_id:string;assessed_on:string;weight_kg:number|null;height_cm:number|null;waist_cm:number|null};
export default function Avaliacoes(){
 const identity=useRef("");
 const scope=useRef(new RequestScope());
 useEffect(()=>{const sub=db?.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"||(event==="SIGNED_IN"&&identity.current&&session?.user.id!==identity.current)) {scope.current.invalidate();setUserId("");setOrg("");setStudents([]);setAssessments([]);setBranding(null);window.location.assign("/");}});return()=>{scope.current.invalidate();sub?.data.subscription.unsubscribe();};},[]);
 const [userId,setUserId]=useState("");const [orgs,setOrgs]=useState<Org[]>([]);const [org,setOrg]=useState("");
 const [branding,setBranding]=useState<Branding|null>(null);const [students,setStudents]=useState<Student[]>([]);const [assessments,setAssessments]=useState<Assessment[]>([]);
 const [chartStudent,setChartStudent]=useState(""); const [metric,setMetric]=useState<"weight_kg"|"height_cm"|"waist_cm">("weight_kg");
 const [name,setName]=useState("");const [studentId,setStudentId]=useState("");const [date,setDate]=useState(new Date().toISOString().slice(0,10));
 const [weight,setWeight]=useState("");const [height,setHeight]=useState("");const [waist,setWaist]=useState("");
 const [status,setStatus]=useState("A iniciar...");const [loading,setLoading]=useState(false);
 useEffect(()=>{if(!db){setStatus("Falta configurar Supabase.");return;}let active=true;
 db.auth.getUser().then(async ({data,error})=>{if(!active)return;if(error||!data.user){setStatus("Inicia sessão no painel principal.");return;}identity.current=data.user.id;setUserId(data.user.id);
 const res=await db!.from("organization_members").select("organization_id,organizations(id,name)");
 if(!active)return;if(res.error){setStatus("Sem acesso às organizações.");return;}
 const list:Org[]=(res.data||[]).flatMap((row:any)=>{const o=Array.isArray(row.organizations)?row.organizations[0]:row.organizations;return o?[{id:o.id,name:o.name}]:[]});
 setOrgs(list);setOrg(list[0]?.id||"");setStatus(list.length?"":"Sem organizações atribuídas.");});
 return()=>{active=false};},[]);
 async function refresh(organization:string){if(!db||!organization)return;const isCurrent=scope.current.begin();setStatus("A carregar dados...");
 const [s,a,b]=await Promise.all([db.from("clients").select("id,full_name").eq("organization_id",organization).order("full_name"),db.from("assessments").select("id,client_id,assessed_on,weight_kg,height_cm,waist_cm").eq("organization_id",organization).order("assessed_on",{ascending:false}).limit(100),db.from("organization_branding").select("display_name,primary_color,logo_url").eq("organization_id",organization).maybeSingle()]);
 if(!isCurrent())return;
 if(s.error||a.error){setStatus("Não foi possível carregar alunos/avaliações. Confirma que a migração 002 foi aplicada.");return;}
 setStudents(s.data||[]);setAssessments(a.data||[]);setBranding(b.error?null:b.data);setChartStudent(prev=>(s.data||[]).some(x=>x.id===prev)?prev:(s.data?.[0]?.id||""));setStudentId(prev=>(s.data||[]).some(x=>x.id===prev)?prev:(s.data?.[0]?.id||""));setStatus("");
 }
 useEffect(()=>{if(org&&userId)void refresh(org);},[org,userId]);
 async function addStudent(e:FormEvent){e.preventDefault();if(!db||!org||!validName(name)||loading)return;setLoading(true);
 const {error}=await db.from("clients").insert({organization_id:org,full_name:name.trim()});setLoading(false);
 if(error){setStatus("Não foi possível criar o aluno. Verifica permissões e dados.");return;}setName("");await refresh(org);}
 async function addAssessment(e:FormEvent){e.preventDefault();if(!db||!org||!studentId||!userId||loading)return;
 let w:number|null,h:number|null,wa:number|null;
 try {w=measurement(weight,500,2);h=measurement(height,300,1);wa=measurement(waist,300,1);
 if(!validDate(date)||[w,h,wa].every(x=>x===null)||!students.some(s=>s.id===studentId))throw new Error();
 }catch {setStatus("Indica uma data, aluno e medições válidos dentro dos limites.");return;}
 setLoading(true);const {error}=await db.from("assessments").insert({organization_id:org,client_id:studentId,recorded_by:userId,assessed_on:date,weight_kg:w,height_cm:h,waist_cm:wa});
 setLoading(false);if(error){setStatus("Não foi possível guardar a avaliação. Confirma limites e permissões.");return;}setWeight("");setHeight("");setWaist("");await refresh(org);}
 return <main className="shell"><header><div><strong>◉ AURA <span>Business</span></strong><p>Módulo de avaliações · Ambiente de desenvolvimento</p></div><a href="/" className="outline link">Painel principal</a></header>
 <div className="heading"><div><span className="eyebrow">ACOMPANHAMENTO</span><h1>Alunos e avaliações</h1><p>Protótipo destinado apenas a dados fictícios.</p></div><label>Organização<select value={org} disabled={loading} onChange={e=>{scope.current.invalidate();setStudents([]);setAssessments([]);setBranding(null);setStudentId("");setChartStudent("");setName("");setWeight("");setHeight("");setWaist("");setOrg(e.target.value)}}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label></div>
 {userId&&org&&<><BrandHeader branding={branding||{display_name:orgs.find(o=>o.id===org)?.name||"AURA",primary_color:"#137F79",logo_url:null}} subtitle="Avaliações físicas"/><div className="columns"><section className="panel"><h2>Novo aluno</h2><form onSubmit={addStudent}><label>Nome fictício<input value={name} onChange={e=>setName(e.target.value)} maxLength={160} minLength={2} required /></label><button disabled={loading}>Registar aluno</button></form></section>
 <section className="panel"><h2>Nova avaliação</h2><form onSubmit={addAssessment}><label>Aluno<select value={studentId} onChange={e=>setStudentId(e.target.value)} required>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label>Data<input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></label><div className="columns"><label>Peso (kg)<input type="number" min="0.01" max="500" step=".01" value={weight} onChange={e=>setWeight(e.target.value)} /></label><label>Altura (cm)<input type="number" min="0.1" max="300" step=".1" value={height} onChange={e=>setHeight(e.target.value)} /></label><label>Cintura (cm)<input type="number" min="0.1" max="300" step=".1" value={waist} onChange={e=>setWaist(e.target.value)} /></label></div><button disabled={loading||!studentId}>Guardar avaliação</button></form></section></div>
 <section className="panel"><h2>Evolução física</h2><div className="columns"><label>Aluno<select value={chartStudent} onChange={e=>setChartStudent(e.target.value)}>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label>Medição<select value={metric} onChange={e=>setMetric(e.target.value as "weight_kg"|"height_cm"|"waist_cm")}><option value="weight_kg">Peso (kg)</option><option value="height_cm">Altura (cm)</option><option value="waist_cm">Cintura (cm)</option></select></label></div><ProgressChart records={assessments.filter(a=>a.client_id===chartStudent).map(a=>({date:a.assessed_on,value:a[metric]}))} unit={metric==="weight_kg"?"kg":"cm"}/></section>
 <section className="panel"><h2>Histórico recente</h2><div className="tablewrap"><table><thead><tr><th>Aluno</th><th>Data</th><th>Peso</th><th>Altura</th><th>Cintura</th></tr></thead><tbody>{assessments.map(a=><tr key={a.id}><td>{students.find(s=>s.id===a.client_id)?.full_name||"—"}</td><td>{a.assessed_on}</td><td>{a.weight_kg??"—"}</td><td>{a.height_cm??"—"}</td><td>{a.waist_cm??"—"}</td></tr>)}</tbody></table></div>{!assessments.length&&<p>Sem avaliações registadas.</p>}</section></>}
 <p role="status" className="status">{status}</p><footer>Não introduzir dados reais de saúde até à revisão legal, de segurança e proteção de dados.</footer></main>;
}
