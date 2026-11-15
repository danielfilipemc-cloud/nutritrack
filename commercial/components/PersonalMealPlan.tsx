'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '../lib/supabase';
import {createPersonalPlanReader,type PersonalPlanState,type PersonalPlanScope} from '../lib/nutrition-personal-plan';
import {NutritionPersistenceError} from '../lib/nutrition-persistence';
import {nutritionTotals,nutrientKeys} from '../lib/nutrition-contract';
import type {FrozenDish} from '../lib/nutrition-document-command';
import type {NutritionItemV1} from '../lib/nutrition-command';
const labels={calories:'Energia',protein:'Proteína',carbs:'Hidratos',fat:'Gordura'};
const format=(n:number|null)=>n===null?'—':new Intl.NumberFormat('pt-PT',{maximumFractionDigits:0}).format(n);
const foods=(dish:FrozenDish):NutritionItemV1[]=>dish.source==='manual'?dish.items:dish.snapshot.items;
export default function PersonalMealPlan({org,clientId,userId,active}:{org:string;clientId:string;userId:string;active:boolean}){
 const [state,setState]=useState<PersonalPlanState|null>(null),[loading,setLoading]=useState(false),[message,setMessage]=useState(''),[attempt,setAttempt]=useState(0),[choices,setChoices]=useState<Record<string,string>>({});
 const generation=useRef(0),reader=useRef<ReturnType<typeof createPersonalPlanReader>|null>(null),identity=`${userId}:${org}:${clientId}`,shown=state&&state.scope.userId===userId&&state.scope.organizationId===org&&state.scope.clientId===clientId?state:null;
 const [exporting,setExporting]=useState(false);
 useEffect(()=>{
  const version=++generation.current;setState(null);setMessage('');setChoices({});if(!active||!db){setLoading(false);return;}
  const context:PersonalPlanScope={organizationId:org,clientId,userId},repo=createPersonalPlanReader(db,context);reader.current=repo;let alive=true;
  async function load(){const current=++generation.current;setLoading(true);setState(null);setMessage('');try{const next=await repo.read();if(alive&&current===generation.current)setState(next);}catch(e){if(alive&&current===generation.current)setMessage(e instanceof NutritionPersistenceError&&e.kind==='denied'?'Sem acesso ao plano. Confirma o segundo fator e o vínculo da conta.':e instanceof NutritionPersistenceError&&e.kind==='invalid-response'?'O plano recebido não pôde ser validado. Nenhum conteúdo foi apresentado.':'Não foi possível carregar o plano. O serviço pode ainda não estar ativado.');}finally{if(alive&&current===generation.current)setLoading(false);}}
  void load();const refresh=()=>void load();window.addEventListener('focus',refresh);const sub=db.auth.onAuthStateChange(()=>{setState(null);setTimeout(()=>{if(alive)void load();},0);});
  return()=>{alive=false;generation.current=Math.max(generation.current,version)+1;repo.dispose();if(reader.current===repo)reader.current=null;window.removeEventListener('focus',refresh);sub.data.subscription.unsubscribe();};
 },[identity,active,attempt,org,clientId,userId]);
 const body=active?shown?.body:null;
 const selected=body?.meals.map(m=>({meal:m,dish:m.alternatives.find(a=>a.id===choices[m.id])?.dish||m.primary}));
 const total=selected?nutritionTotals(selected.flatMap(m=>foods(m.dish)).map(({composition,quantity})=>({composition,quantity}))):null;
 async function download(){const repo=reader.current;if(!repo||exporting)return;const version=generation.current;setExporting(true);try{const data=await repo.exportVersions();if(version!==generation.current)return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='aura-plano-privado.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Plano e versões exportados. Este ficheiro é separado do diário de refeições.');}catch{if(version===generation.current)setMessage('Não foi possível exportar o histórico completo do plano. Nenhum ficheiro parcial foi criado.');}finally{setExporting(false);}}
 return <section className="panel aura-personal-plan" aria-label="O meu plano alimentar" aria-busy={loading}>
  <div className="heading"><div><span className="eyebrow">PARA CONSULTAR NO DIA A DIA</span><h2>O meu plano</h2><p>Refeições, quantidades e alternativas, organizadas para ti.</p></div><button className="outline" disabled={loading} onClick={()=>setAttempt(v=>v+1)}>Atualizar plano</button></div>
  {loading&&<p role="status">A carregar o teu plano…</p>}{message&&<p role="alert">{message}</p>}
  {!loading&&shown?.status==='none'&&<p>Ainda não tens um plano disponibilizado neste acompanhamento. O diário continua separado.</p>}
  {!loading&&shown?.status==='withdrawn'&&<p>Este plano foi retirado. As versões anteriores são preservadas; não foi apresentado um plano substituto.</p>}
  {shown&&shown.revision>0&&<button className="outline" disabled={loading||exporting} onClick={()=>void download()}>Exportar plano e versões</button>}
  {body&&<>
   <header className="aura-personal-plan-intro"><h3>{body.title}</h3><p>{shown?.sourceLabel} · versão {shown?.revision}</p>{body.notes&&<details><summary>Como pesar e consultar este plano</summary><p>{body.notes}</p></details>}</header>
   <div className="aura-personal-plan-macros" role="group" aria-label="Composição estimada do plano consultado">{nutrientKeys.map(k=><article key={k}><span>{labels[k]}</span><strong>{format(total?.nutrients[k]??null)} <small>{k==='calories'?'kcal':'g'}</small></strong></article>)}</div>
   <p>Totais calculados apenas com as opções selecionadas. As alternativas não são somadas. — significa composição desconhecida. Estes valores representam o plano, não consumo registado.</p>
   <div className="aura-personal-plan-meals">{selected?.map(({meal,dish},index)=>{
    const portions=foods(dish),macros=nutritionTotals(portions.map(({composition,quantity})=>({composition,quantity}))).nutrients;
    return <article className="aura-personal-plan-meal" key={meal.id}><header><span className="aura-personal-plan-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div><h3>{meal.label}</h3>{meal.time&&<p>{meal.time}</p>}</div><strong>≈ {format(macros.calories)} kcal</strong></header>
     {meal.alternatives.length>0&&<label>Opção para {meal.label.toLocaleLowerCase('pt-PT')}<select value={choices[meal.id]||''} onChange={e=>setChoices(old=>({...old,[meal.id]:e.target.value}))}><option value="">Opção principal</option>{meal.alternatives.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></label>}
     <ul>{portions.map((food,i)=><li key={i}><span>{food.label}</span><strong>{format(food.quantity.amount)} g</strong></li>)}</ul>
     <p>Proteína {format(macros.protein)} g · hidratos {format(macros.carbs)} g · gordura {format(macros.fat)} g</p>
    </article>;
   })}</div>
   <p>Consultar ou mudar de opção não cria registos no diário. As quantidades referem-se ao estado indicado em cada alimento; não equivalem automaticamente ao mesmo peso em cru.</p>
  </>}
 </section>;
}
