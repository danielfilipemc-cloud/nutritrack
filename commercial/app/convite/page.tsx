"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {db} from "../../lib/supabase";
import {useProfessional} from "../../lib/use-professional";
export default function Invitation(){
 const {user}=useProfessional();const [student,setStudent]=useState(false);const [token,setToken]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(""),[accepted,setAccepted]=useState(false);const alive=useRef(true);
 useEffect(()=>{alive.current=true;setStudent(new URLSearchParams(window.location.search).get("aluno")==="1");const candidate=window.location.hash.slice(1);if(/^[0-9a-f]{64}$/.test(candidate)){setToken(candidate);window.history.replaceState(null,"",window.location.pathname+window.location.search);}return()=>{alive.current=false;};},[]);
 async function authenticate(e:FormEvent){e.preventDefault();if(!db||busy)return;setBusy(true);setStatus("");try{
 const result=signup?await db.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+"/convite"+(student?"?aluno=1":"")}}):await db.auth.signInWithPassword({email:email.trim(),password});
 if(!alive.current)return;setPassword("");setStatus(result.error?"Não foi possível concluir. Confirma os dados e tenta novamente.":signup?"Confirma o teu email e volta a abrir o link original do convite para aceitar.":"Sessão iniciada. Confirma a aceitação abaixo.");
 }catch{if(alive.current)setStatus("Falha de ligação. Tenta novamente.");}finally{if(alive.current)setBusy(false);}}
 async function accept(e:FormEvent){e.preventDefault();if(!db||busy||!user)return;const actor=user.id;setBusy(true);setStatus("");try{
 const {error}=await db.rpc(student?"aura_student_invite_accept":"aura_invitation_accept",{p_token:token.trim()});if(!alive.current)return;
 const current=await db.auth.getUser();if(current.data.user?.id!==actor)return;
 if(error){setStatus("Não foi possível aceitar. O convite pode estar expirado, revogado ou ser para outro email. Confirma também o teu email.");return;}
 setToken("");setAccepted(true);setStatus("Convite aceite. O teu acesso ficou associado.");
 }catch{if(alive.current)setStatus("Não foi possível concluir a aceitação.");}finally{if(alive.current)setBusy(false);}}
 return <main className="shell" id="main-content" tabIndex={-1}><header><strong>AURA <span>Business</span></strong><a className="outline link" href="/">Painel principal</a></header><section className="login"><span className="eyebrow">{student?"CONVITE DO ALUNO":"CONVITE PROFISSIONAL"}</span><h1>{student?"Liga a tua conta ao acompanhamento.":"Junta-te à equipa."}</h1><p>O convite é pessoal e requer uma conta com o email do destinatário confirmado.</p>
 {!user?<><div className="columns"><button className="outline" disabled={busy} onClick={()=>setSignup(false)}>Já tenho conta</button><button className="outline" disabled={busy} onClick={()=>setSignup(true)}>Criar conta</button></div><form onSubmit={authenticate}><label>Email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Palavra-passe<input required type="password" minLength={signup?12:1} autoComplete={signup?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy||!db}>{signup?"Criar conta e confirmar email":"Iniciar sessão"}</button></form>{signup&&<p>Usa pelo menos 12 caracteres. A criação da conta não concede acesso até aceitares um convite válido.</p>}</>:<p>Sessão iniciada: {user.email}</p>}
 {!accepted?<form onSubmit={accept}><label>Código do convite<input value={token} autoComplete="off" spellCheck={false} maxLength={64} onChange={e=>setToken(e.target.value)} placeholder="Preenchido pelo link ou colado aqui"/></label><button disabled={!user||busy||!/^[0-9a-f]{64}$/.test(token)}>Aceitar convite</button></form>:<a href={student?"/aluno":"/"} className="outline link">Abrir a minha área →</a>}
 <p role="status" className="status">{status}</p></section></main>;
}
