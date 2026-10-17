"use client";
import {useEffect,useRef,useState} from 'react';
import {db} from '../lib/supabase';

export default function SessionActions(){
 const [active,setActive]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const alive=useRef(false);
 useEffect(()=>{
  alive.current=true;if(!db)return()=>{alive.current=false;};
  const {data}=db.auth.onAuthStateChange((_event,session)=>{if(alive.current)setActive(!!session?.user);});
  return()=>{alive.current=false;data.subscription.unsubscribe();};
 },[]);
 async function logout(){
  if(!db||busy)return;setBusy(true);setError('');
  try{
   // Revoke refresh sessions globally; already-issued JWTs retain their normal TTL.
   const result=await db.auth.signOut({scope:'global'});
   if(result.error)throw result.error;
   window.location.assign('/');
  }catch{
   // auth-js can remove the local session even when global revocation fails.
   // Do not retain tokens or restore a session merely to retry logout.
   const session=await db.auth.getSession().catch(()=>null);
   if(session&&!session.data.session){window.location.assign('/?sessao=revogacao-pendente');return;}
   if(alive.current)setError('Não foi possível terminar a sessão. Tenta novamente.');
  }
  finally{if(alive.current)setBusy(false);}
 }
 if(!active)return null;
 return <div className="aura-quick-actions"><a className="outline link" href="/seguranca">Segurança</a><button className="outline" disabled={busy} onClick={()=>void logout()}>{busy?'A terminar sessão...':'Terminar sessão'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
