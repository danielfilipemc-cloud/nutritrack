'use client';
import {useEffect,useState} from 'react';
const examples=[{id:'studio',name:'Estúdio Aurora',color:'#137F79'},{id:'pt',name:'PT Horizonte',color:'#6747B5'},{id:'light',name:'Estúdio Claro',color:'#FFFFFF'}];
export default function DemoBrandControls({name,color,onChange}:{name:string;color:string;onChange:(name:string,color:string)=>void}){
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 const preset=examples.find(p=>p.name===name&&p.color.toLowerCase()===color.toLowerCase());
 return <section id="marca" className="panel demo-section" aria-busy={!ready}><h2>A tua identidade</h2><p>Personalização fictícia em memória. Não altera nenhum estabelecimento.</p>
 <label>Identidade de exemplo<select disabled={!ready} value={preset?.id||'custom'} onChange={e=>{const p=examples.find(p=>p.id===e.target.value);if(p)onChange(p.name,p.color);}}><option value="custom">Personalizada</option>{examples.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>Nome da marca<input disabled={!ready} required minLength={2} maxLength={100} value={name} onChange={e=>onChange(e.target.value,color)}/></label><label>Cor principal<input disabled={!ready} type="color" value={color} onChange={e=>onChange(name,e.target.value)}/></label>
 <p>A marca é apresentada com texto preto ou branco para manter contraste acessível. O tema AURA Dark Premium mantém-se.</p></section>;
}
