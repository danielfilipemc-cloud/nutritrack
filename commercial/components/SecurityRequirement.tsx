'use client';
import {useEffect,useState} from 'react';
import {db} from '../lib/supabase';
type State='loading'|'error'|'blocked'|'clear';
export default function SecurityRequirement({org}:{org:string}){
 const [result,setResult]=useState<{org:string;state:State}>({org,state:'loading'});
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let alive=true,version=0;
  async function load(){
   const current=++version;setResult({org,state:'loading'});
   try{
    if(!db||!org)throw new Error('Security context unavailable');
    const r=await db.rpc('aura_security_requirement',{p_org:org});
    if(r.error||typeof r.data?.required!=='boolean'||typeof r.data?.satisfied!=='boolean')throw new Error('Invalid security response');
    if(alive&&current===version)setResult({org,state:r.data.required&&!r.data.satisfied?'blocked':'clear'});
   }catch{if(alive&&current===version)setResult({org,state:'error'});}
  }
  void load();
  const sub=db?.auth.onAuthStateChange(()=>{setTimeout(()=>{if(alive)void load();},0);});
  return()=>{alive=false;version++;sub?.data.subscription.unsubscribe();};
 },[org,attempt]);
 const state=result.org===org?result.state:'loading';
 if(state==='clear')return null;
 if(state==='loading')return <p role="status">A verificar os requisitos de segurança…</p>;
 if(state==='error')return <p role="alert">Não foi possível verificar a obrigação de segundo fator. O acesso continua sujeito às verificações do servidor. <button type="button" onClick={()=>setAttempt(n=>n+1)}>Tentar verificar novamente</button></p>;
 return <p role="alert">Este estabelecimento exige segundo fator recente para aceder aos dados dos alunos. <a href={'/seguranca?org='+encodeURIComponent(org)}>Confirmar em Segurança</a></p>;
}
