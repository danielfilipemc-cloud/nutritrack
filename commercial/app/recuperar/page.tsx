'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import LoginExperience from '../../components/LoginExperience';
import {db} from '../../lib/supabase';
import {recoveryRequestMessage} from '../../lib/password-recovery';
export default function RecoveryRequest(){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[cooldown,setCooldown]=useState(false);
 const alive=useRef(false),pending=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(false),30000);return()=>clearTimeout(timer);},[cooldown]);
 async function submit(event:FormEvent){
  event.preventDefault();if(!db||pending.current||cooldown)return;
  pending.current=true;setBusy(true);setMessage('');
  try{
   const r=await db.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/'});
   if(r.error&&(!r.error.status||r.error.status>=500))throw new Error('Unavailable');
   if(alive.current){setMessage(recoveryRequestMessage);setCooldown(true);}
  }catch{if(alive.current)setMessage('Não foi possível concluir o pedido. Tenta novamente.');}
  finally{pending.current=false;if(alive.current)setBusy(false);}
 }
 return <LoginExperience title="Recuperar palavra-passe" description="Enviaremos uma ligação para definires uma nova palavra-passe." status={message}>
  <form onSubmit={submit} aria-busy={busy}><label>Email<input type="email" autoComplete="email" required value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label><button disabled={!db||busy||cooldown}>{busy?'A enviar pedido…':cooldown?'Aguarda antes de repetir':'Pedir ligação de recuperação'}</button></form>
  <p className="aura-entry-student-link"><a href="/">Voltar ao início de sessão</a></p>
 </LoginExperience>;
}
