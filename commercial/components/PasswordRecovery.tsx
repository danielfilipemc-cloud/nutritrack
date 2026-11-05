'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {db,passwordRecovery} from '../lib/supabase';
import {recoveryPasswordError,type RecoveryState} from '../lib/password-recovery';
import LoginExperience from './LoginExperience';
export default function PasswordRecovery({state}:{state:RecoveryState}){
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [factors,setFactors]=useState<{id:string;friendly_name?:string}[]>([]),[factor,setFactor]=useState(''),[code,setCode]=useState('');
 const alive=useRef(false),pending=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(busy||password||confirmation){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[busy,password,confirmation]);
 useEffect(()=>{if(state.phase==='invalid'){window.history.replaceState(null,'','/?recuperacao=1');setPassword('');setConfirmation('');setCode('');setFactors([]);}},[state.phase]);
 async function save(event:FormEvent){
  event.preventDefault();if(!db||pending.current||state.phase!=='ready'||uncertain)return;
  const error=recoveryPasswordError(password,confirmation);if(error){setMessage(error);return;}
  pending.current=true;setBusy(true);setMessage('');
  const identity=state.userId;
  const current=()=>alive.current&&passwordRecovery.getSnapshot().phase==='ready'&&passwordRecovery.getSnapshot().userId===identity;
  let submitted=false;
  try{
   const user=await db.auth.getUser();if(!current())return;
   if(user.error||user.data.user?.id!==identity){passwordRecovery.invalidate();return;}
   const [listed,assurance]=await Promise.all([db.auth.mfa.listFactors(),db.auth.mfa.getAuthenticatorAssuranceLevel()]);if(!current())return;
   if(listed.error||assurance.error)throw new Error('Security unavailable');
   const verified=listed.data.totp.filter(f=>f.status==='verified');
   if(verified.length&&assurance.data.currentLevel!=='aal2'){setFactors(verified);setFactor(verified[0].id);setMessage('Confirma o segundo fator antes de alterar a palavra-passe.');return;}
   if(assurance.data.nextLevel==='aal2'&&assurance.data.currentLevel!=='aal2'){setMessage('É necessário confirmar o segundo fator. Contacta o responsável se não tens um autenticador compatível.');return;}
   submitted=true;const result=await db.auth.updateUser({password});if(!current())return;
   if(result.error){
    if(!result.error.status||result.error.status>=500)throw new Error('Uncertain');
    setMessage('A palavra-passe não foi aceite. Tenta outra ou pede uma nova ligação. Esta recuperação não substitui o segundo fator.');return;
   }
   setPassword('');setConfirmation('');passwordRecovery.complete();
   try{const logout=await db.auth.signOut({scope:'global'});if(logout.error)throw logout.error;if(alive.current)setMessage('Palavra-passe alterada. Inicia sessão com a nova palavra-passe.');}
   catch{if(alive.current)setMessage('Palavra-passe alterada. Não foi possível confirmar o fim das restantes sessões. Volta a iniciar sessão e revê a segurança da conta.');}
  }catch{if(current()){setUncertain(submitted);setMessage(submitted?'Não foi possível confirmar a alteração. A nova palavra-passe pode ter sido guardada. Tenta iniciar sessão ou pede uma nova ligação.':'Não foi possível verificar a sessão. Tenta novamente.');}}
  finally{pending.current=false;if(alive.current)setBusy(false);}
 }
 async function confirmFactor(event:FormEvent){
  event.preventDefault();if(!db||pending.current||state.phase!=='ready'||!factors.some(f=>f.id===factor)||!/^\d{6}$/.test(code))return;
  pending.current=true;setBusy(true);const identity=state.userId;
  try{
   const user=await db.auth.getUser();if(user.error||user.data.user?.id!==identity||passwordRecovery.getSnapshot().userId!==identity){passwordRecovery.invalidate();return;}
   const r=await db.auth.mfa.challengeAndVerify({factorId:factor,code});
   if(!alive.current||passwordRecovery.getSnapshot().userId!==identity)return;
   if(r.error)throw new Error('MFA failed');setFactors([]);setMessage('Segundo fator confirmado. Podes guardar a nova palavra-passe.');
  }catch{if(alive.current&&passwordRecovery.getSnapshot().userId===identity)setMessage('Não foi possível confirmar o segundo fator. Verifica o código e tenta novamente.');}
  finally{pending.current=false;if(alive.current){setBusy(false);setCode('');}}
 }
 const leave=(event:React.MouseEvent<HTMLAnchorElement>)=>{if(busy||((password||confirmation)&&!window.confirm('Descartar a nova palavra-passe antes de sair?')))event.preventDefault();};
 const invalid=state.phase==='invalid';
 return <LoginExperience title={state.phase==='complete'?'Palavra-passe alterada':'Definir nova palavra-passe'} description="A recuperação de palavra-passe não remove o segundo fator nem altera as permissões." status={invalid?'Ligação inválida, expirada ou já utilizada. Pede uma nova ligação.':state.phase==='checking'?'A verificar ligação de recuperação…':message}>
  {state.phase==='ready'&&!uncertain&&<form onSubmit={save} aria-busy={busy}><label>Nova palavra-passe<input type="password" autoComplete="new-password" minLength={12} required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirmar nova palavra-passe<input type="password" autoComplete="new-password" required disabled={busy} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><button disabled={busy}>{busy?'A guardar…':'Guardar nova palavra-passe'}</button></form>}
  {state.phase==='ready'&&factors.length>0&&<form onSubmit={confirmFactor} aria-label="Confirmar segundo fator da recuperação" aria-busy={busy}>{factors.length>1&&<label>Aplicação autenticadora<select value={factor} disabled={busy} onChange={e=>setFactor(e.target.value)}>{factors.map((f,i)=><option key={f.id} value={f.id}>{f.friendly_name||`Autenticador ${i+1}`}</option>)}</select></label>}<label>Código da aplicação autenticadora<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={e=>setCode(e.target.value)}/></label><button disabled={busy}>Confirmar segundo fator</button><p>Se perdeste o autenticador, contacta o responsável. Não é possível retirar MFA por esta ligação.</p></form>}
  {(invalid||uncertain)&&<p className="aura-entry-student-link"><a href="/recuperar" onClick={leave}>Pedir nova ligação</a></p>}
  <p className="aura-entry-student-link"><a href="/" onClick={leave}>Voltar ao início de sessão</a></p>
 </LoginExperience>;
}
