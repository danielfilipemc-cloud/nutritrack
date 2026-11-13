'use client';
import {useEffect,useRef,useState} from 'react';
import {nutrientKeys,nutritionTotals,type CompositionV1,type PortionV1} from '../lib/nutrition-contract';
import {gramsForNutrient,parseManualTargets,productSnapshot,targetBalance,type ProductLabelV1} from '../lib/nutrition-planning';
import type {NutritionItemV1} from '../lib/nutrition-command';

const labels={calories:'Energia',protein:'Proteína',carbs:'Hidratos',fat:'Gordura'};
const blank=()=>({calories:'',protein:'',carbs:'',fat:''});
const format=(value:number)=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:2}).format(value);
/** Planning drafts stay in memory and participate in the existing profile guard.
 * They never silently create targets, consumption, personal accounts or sharing. */
export default function NutritionPlanningTools({disabled,portions,complete,onAdd,onDirtyChange}:{disabled:boolean;portions:PortionV1[];complete:boolean;onAdd:(item:NutritionItemV1)=>void;onDirtyChange:(dirty:boolean)=>void}){
 const [targets,setTargets]=useState(blank),[composition,setComposition]=useState(blank),[name,setName]=useState(''),[brand,setBrand]=useState(''),[preparation,setPreparation]=useState<ProductLabelV1['preparation']>('as-sold');
 const [grams,setGrams]=useState('100'),[macro,setMacro]=useState<typeof nutrientKeys[number]>('protein'),[amount,setAmount]=useState(''),[message,setMessage]=useState('');
 const dirty=Object.values(targets).some(Boolean)||Object.values(composition).some(Boolean)||!!name||!!brand||grams!=='100'||preparation!=='as-sold'||!!amount||macro!=='protein';
 const notify=useRef(onDirtyChange);notify.current=onDirtyChange;
 useEffect(()=>{notify.current(dirty);},[dirty]);useEffect(()=>()=>notify.current(false),[]);
 const per100g:CompositionV1={contractVersion:1,basis:{amount:100,unit:'g'},nutrients:Object.fromEntries(nutrientKeys.map(k=>[k,composition[k].trim()===''?null:Number(composition[k])])) as CompositionV1['nutrients']};
 let remaining:CompositionV1['nutrients']|null=null,preview:ReturnType<typeof nutritionTotals>|null=null,targetError='';
 try{remaining=targetBalance(portions,parseManualTargets({contractVersion:1,source:'manual',nutrients:Object.fromEntries(nutrientKeys.map(k=>[k,targets[k].trim()===''?null:Number(targets[k])]))}),complete);}catch{targetError='Revê as metas: usa valores positivos ou deixa os campos vazios.';}
 try{preview=nutritionTotals([{composition:per100g,quantity:{amount:grams.trim()===''?NaN:Number(grams),unit:'g'}}]);}catch{/* Do not retain a previous valid calculation. */}
 function reset(){setTargets(blank());setComposition(blank());setName('');setBrand('');setPreparation('as-sold');setGrams('100');setMacro('protein');setAmount('');setMessage('Rascunho de planeamento limpo.');}
 return <section className="panel aura-nutrition-tools" aria-label="Planeamento e rótulos">
  <details><summary>Planear quantidades e preparar um produto</summary>
   <p>Prepara porções a partir de um rótulo. As metas abaixo são um <strong>rascunho desta ficha, sem gravação ou sincronização</strong>. Não são calculadas automaticamente nem constituem uma prescrição.</p>
   <fieldset disabled={disabled}><legend>Referências individuais do dia</legend><p>Indica valores previamente definidos para este aluno. Não copies automaticamente as metas de outra pessoa; a amamentação exige adaptação individual.</p>
    <div className="aura-nutrition-tools-grid">{nutrientKeys.map(k=><label key={k}>Meta de {labels[k].toLocaleLowerCase('pt')} ({k==='calories'?'kcal':'g'})<input type="number" min="0.001" max={k==='calories'?10000:k==='carbs'?2000:1000} step="0.001" value={targets[k]} onChange={e=>setTargets(old=>({...old,[k]:e.target.value}))}/></label>)}</div>
    {targetError&&<p role="alert">{targetError}</p>}
    <div className="aura-nutrition-tools-metrics" role="group" aria-label="Diferença para as referências">{nutrientKeys.map(k=><article key={k}><span>{labels[k]}</span><strong>{remaining?.[k]===null||remaining===null?'—':format(remaining[k]!)}</strong><small>{remaining?.[k]===null||remaining===null?'Sem balanço completo':remaining[k]!<0?'Acima da referência':'Falta registar'} {remaining?.[k]!==null&&remaining!==null?(k==='calories'?'kcal':'g'):''}</small></article>)}</div>
    <p>O balanço exige todos os registos do dia numa única leitura e composição conhecida. Com várias páginas, não é possível confirmar o total do dia nesta vista. Um diário vazio não prova consumo zero.</p>
   </fieldset>
   <form onSubmit={e=>{e.preventDefault();try{const item=productSnapshot({name,brand,preparation,composition:per100g},Number(grams));onAdd(item);setMessage('Produto adicionado ao rascunho da refeição. Confirma e guarda a refeição para registar consumo.');}catch(e){setMessage(e instanceof Error?e.message:'Revê o rótulo.');}}}>
    <fieldset disabled={disabled}><legend>Produto e porção</legend><div className="columns"><label>Nome do produto<input required maxLength={90} value={name} onChange={e=>setName(e.target.value)}/></label><label>Marca do produto (opcional)<input maxLength={60} value={brand} onChange={e=>setBrand(e.target.value)}/></label></div>
     <label>Estado a que se refere o rótulo<select value={preparation} onChange={e=>setPreparation(e.target.value as typeof preparation)}><option value="as-sold">Como vendido</option><option value="raw">Cru</option><option value="cooked">Cozinhado</option></select></label>
     <p>Transcreve a composição <strong>por 100 g</strong>. Não uses valores por 100 ml como se fossem por 100 g. Campo vazio significa desconhecido; zero deve ser explícito. Nome, marca e estado juntos têm um limite de 120 caracteres.</p>
     <div className="aura-nutrition-tools-grid">{nutrientKeys.map(k=><label key={k}>Rótulo: {labels[k].toLocaleLowerCase('pt')} por 100 g ({k==='calories'?'kcal':'g'})<input type="number" min="0" max={k==='calories'?1000:100} step="0.001" value={composition[k]} onChange={e=>setComposition(old=>({...old,[k]:e.target.value}))}/></label>)}</div>
     <div className="columns"><label>Porção do produto (g)<input required type="number" min="0.001" max="5000" step="0.001" value={grams} onChange={e=>setGrams(e.target.value)}/></label><div><label>Calcular por<select value={macro} onChange={e=>setMacro(e.target.value as typeof macro)}>{nutrientKeys.map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label><label>Quantidade pretendida de {labels[macro].toLocaleLowerCase('pt')} ({macro==='calories'?'kcal':'g'})<input type="number" min="0.001" step="0.001" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className="outline" type="button" onClick={()=>{try{setGrams(String(gramsForNutrient(per100g,macro,Number(amount))));setMessage('Porção calculada para o nutriente escolhido. Confere os restantes valores.');}catch(e){setMessage(e instanceof Error?e.message:'Revê os valores.');}}}>Calcular quantidade</button></div></div>
     <div className="aura-nutrition-tools-metrics" role="group" aria-label="Composição da porção">{nutrientKeys.map(k=><article key={k}><span>{labels[k]}</span><strong>{preview?.nutrients[k]===null||!preview?'—':format(preview.nutrients[k]!)}</strong><small>{k==='calories'?'kcal':'g'}</small></article>)}</div>
     {!preview&&<p role="alert">Revê a porção e os valores do rótulo.</p>}
     <button disabled={!preview} type="submit">Adicionar produto à refeição</button>
    </fieldset>
   </form>
   <p role="status">{message}</p><button className="outline" type="button" disabled={disabled||!dirty} onClick={()=>{if(window.confirm('Limpar as metas e o produto deste rascunho?'))reset();}}>Limpar planeamento</button>
  </details>
 </section>;
}
