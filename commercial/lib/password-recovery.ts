export type RecoveryState={phase:'none'|'checking'|'ready'|'invalid'|'complete';userId?:string};
export const recoveryChecking:RecoveryState={phase:'checking'};
export function isRecoveryCallback(href:string){
 const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
 return fragment.get('type')==='recovery'||fragment.has('error')||fragment.has('error_code')||url.searchParams.has('error')||url.searchParams.has('error_code')||url.searchParams.get('recuperacao')==='1';
}
// Holds only state/identity, never callback tokens, passwords or a persisted grant.
export function createRecoveryState(callback:boolean){
 let state:RecoveryState={phase:callback?'checking':'none'};
 const listeners=new Set<()=>void>();
 const set=(next:RecoveryState)=>{state=next;listeners.forEach(fn=>fn());};
 return {
  getSnapshot:()=>state,
  subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
  observe(event:string,userId?:string){
   if(state.phase==='checking'&&event==='PASSWORD_RECOVERY'&&userId)set({phase:'ready',userId});
   else if(state.phase==='ready'&&(event==='SIGNED_OUT'||(userId&&state.userId!==userId)))set({phase:'invalid'});
  },
  settle(){if(state.phase==='checking')set({phase:'invalid'});},
  invalidate(){set({phase:'invalid'});},
  complete(){set({phase:'complete'});},
 };
}
export function recoveryPasswordError(password:string,confirmation:string){
 if(password.length<12)return 'Usa pelo menos 12 caracteres.';
 if(password!==confirmation)return 'As palavras-passe não coincidem.';
 return '';
}
export const recoveryRequestMessage='Se existir uma conta associada a esse email e o envio for permitido, receberás uma ligação para recuperar a palavra-passe. Verifica também o spam.';
