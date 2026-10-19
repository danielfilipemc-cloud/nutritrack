"use client";
import {useEffect,useRef,useState} from 'react';
import {db} from '../lib/supabase';
import {followupLabels,type Followup,type Professional} from '../lib/care';
import {parsePermissions} from '../lib/foundations';

type Context=Pick<Followup,"status"|"responsible_id"|"next_review">;
/** Read-only context. Mounted only inside the existing followup_read boundary. */
export default function StudentContext({org,userId,clientId}:{org:string;userId:string;clientId:string}){
 const disclosure=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const media=window.matchMedia('(min-width:901px)');const update=()=>{if(disclosure.current)disclosure.current.open=media.matches;};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const [revision,setRevision]=useState(0);
 const [result,setResult]=useState<{key:string;followup:Context|null;responsible:string;error:boolean}|null>(null);
 const key=`${org}:${userId}:${clientId}:${revision}`;
 useEffect(()=>{
  const client=db;let active=true;setResult(null);if(!client)return;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  void(async()=>{try{
   const permission=await client.rpc('aura_client_permissions',{p_org:org,p_client:clientId}).abortSignal(controller.signal);if(!active)return;
   if(permission.error||!parsePermissions(permission.data).followup_read)throw Error();
   const read=await client.from('client_followups').select('status,responsible_id,next_review').eq('organization_id',org).eq('client_id',clientId).abortSignal(controller.signal).maybeSingle();if(!active)return;if(read.error)throw Error();
   const followup=read.data as Context|null;let responsible='Por atribuir';
   if(followup?.responsible_id===userId)responsible='Tu';
   else if(followup?.responsible_id){const roster=await client.rpc('aura_professional_choices',{p_org:org}).abortSignal(controller.signal);if(!active)return;if(roster.error)throw Error();responsible=(roster.data as Professional[]||[]).find(p=>p.user_id===followup.responsible_id)?.display_name||'Profissional indisponível';}
   const check=await client.rpc('aura_client_permissions',{p_org:org,p_client:clientId}).abortSignal(controller.signal);if(!active)return;if(check.error||!parsePermissions(check.data).followup_read)throw Error();
   setResult({key,followup,responsible,error:false});
  }catch{if(active)setResult({key,followup:null,responsible:'',error:true});}finally{clearTimeout(timer);}})();
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[org,userId,clientId,revision,key]);
 const current=result?.key===key?result:null;
 return <details ref={disclosure} className="aura-student-context" aria-label="Contexto guardado do acompanhamento" aria-busy={!current}><summary>Responsável e próxima revisão</summary>
  {!current?<p role="status">A carregar contexto...</p>:current.error?<p role="status">Contexto indisponível ou sem acesso. Os dados não são apresentados.</p>:<dl>
   <div><dt>Acompanhamento</dt><dd>{current.followup?followupLabels[current.followup.status]||'Estado indisponível':'Sem acompanhamento registado'}</dd></div>
   <div><dt>Responsável</dt><dd>{current.responsible}</dd></div>
   <div><dt>Próxima revisão</dt><dd>{current.followup?.next_review?<time dateTime={current.followup.next_review}>{current.followup.next_review}</time>:'Sem revisão marcada'}</dd></div>
  </dl>}
  <button className="outline" onClick={()=>{setResult(null);setRevision(n=>n+1);}}>Atualizar contexto</button>
 </details>;
}
