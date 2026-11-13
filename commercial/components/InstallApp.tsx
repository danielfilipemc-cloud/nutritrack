'use client';
import {useEffect,useState} from 'react';

type InstallPrompt = Event & {
 prompt: () => Promise<void>;
 userChoice: Promise<{outcome: 'accepted'|'dismissed'}>;
};

/** Online PWA only. No worker, API cache, token storage or notification permission. */
export default function InstallApp() {
 const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[installed,setInstalled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  const media=window.matchMedia('(display-mode: standalone)');
  const update=()=>setInstalled(media.matches);
  const available=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt);};
  const done=()=>{setInstalled(true);setPrompt(null);setMessage('A instalação foi confirmada pelo navegador.');};
  update();media.addEventListener('change',update);
  window.addEventListener('beforeinstallprompt',available);window.addEventListener('appinstalled',done);
  return()=>{media.removeEventListener('change',update);window.removeEventListener('beforeinstallprompt',available);window.removeEventListener('appinstalled',done);};
 },[]);
 async function install(){
  if(!prompt||busy)return;setBusy(true);setMessage('');
  try{await prompt.prompt();const result=await prompt.userChoice;setMessage(result.outcome==='accepted'?'Pedido aceite. Confirma a instalação no Android.':'Instalação cancelada. Podes tentar novamente pelo menu do navegador.');}
  catch{setMessage('O navegador não conseguiu abrir a instalação. Usa o menu do Chrome.');}
  finally{setPrompt(null);setBusy(false);}
 }
 return <section className="panel aura-install-card" aria-label="Instalação no telemóvel">
  <span className="eyebrow">AURA · ANDROID</span><h2>{installed?'AURA em janela própria':'O teu acompanhamento, mais próximo'}</h2>
  <p>Abre a AURA pelo ecrã inicial, com o mesmo acesso e permissões da versão web.</p>
  {installed?<p>A aplicação está aberta em modo instalado.</p>:<>{prompt&&<button disabled={busy} onClick={()=>void install()}>{busy?'A abrir instalação…':'Instalar AURA'}</button>}
   <ol><li>Abre esta página no Chrome do Android.</li><li>No menu ⋮, escolhe <strong>Instalar aplicação</strong> ou <strong>Adicionar ao ecrã principal</strong>.</li><li>Confirma e abre o ícone AURA.</li></ol>
   <p>A opção depende do navegador e de uma ligação HTTPS. Se já estiver instalada, abre-a pelo respetivo ícone.</p></>}
  <p><strong>É necessária ligação à internet.</strong> A instalação não ativa módulos em preparação, não cria uma conta e não autoriza a introdução de dados reais neste ambiente de demonstração.</p>
  <p role="status">{message}</p>
 </section>;
}
