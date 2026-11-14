'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '../lib/supabase';
import {createPersonalNutritionExport} from '../lib/nutrition-personal-export';
export default function PersonalNutritionExport({org,clientId,userId}:{org:string;clientId:string;userId:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const repo=useRef<ReturnType<typeof createPersonalNutritionExport>|null>(null),epoch=useRef(0);
 useEffect(()=>{if(db)repo.current=createPersonalNutritionExport(db,{organizationId:org,clientId,userId});return()=>{epoch.current++;repo.current?.dispose();repo.current=null;};},[org,clientId,userId]);
 async function download(){if(!repo.current||busy)return;const version=epoch.current;setBusy(true);setMessage('');try{const data=await repo.current.read();if(version!==epoch.current)return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='aura-nutricao-privada.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Ficheiro completo dos registos nutricionais próprios preparado. Guarda-o num local privado.');}catch(e){if(version===epoch.current)setMessage(e instanceof Error?e.message:'Não foi possível exportar.');}finally{if(version===epoch.current)setBusy(false);}}
 return <section className="panel" aria-label="Exportação de nutrição privada" aria-busy={busy}><h2>Os teus registos nutricionais</h2><p>Exporta todas as refeições, correções, anulações, composições e referências diárias deste acompanhamento numa única leitura. Inclui histórico e recibos próprios. Não inclui dados profissionais ou de outra pessoa, nem recupera a tua conta.</p><button className="outline" disabled={busy||!db} onClick={()=>void download()}>Exportar nutrição privada</button><p role="status">{message}</p></section>;
}
