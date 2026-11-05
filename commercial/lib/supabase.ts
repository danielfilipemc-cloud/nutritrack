import {createClient} from "@supabase/supabase-js";
import {createRecoveryState,isRecoveryCallback} from './password-recovery';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// One auth client shared by every commercial route. Never use a privileged key here.
export const passwordRecovery=createRecoveryState(typeof window!=='undefined'&&isRecoveryCallback(window.location.href));
// A historical callback must never be exchanged again, including a non-BFCache restore.
if(typeof window!=='undefined'&&passwordRecovery.getSnapshot().phase==='checking'&&
 (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type==='back_forward'){
 window.history.replaceState(null,'','/?recuperacao=1');passwordRecovery.invalidate();
}
export const db=url&&key?createClient(url,key):null;
if(db&&typeof window!=='undefined'&&passwordRecovery.getSnapshot().phase==='checking'){
 // The pinned SDK captures callback parameters synchronously during initialize.
 // Replace the original history entry before its later hash cleanup can add one.
 const initialization=db.auth.initialize();
 window.history.replaceState(null,'','/?recuperacao=1');
 // Subscribe before SDK initialization completes; React mounting must not miss the event.
 db.auth.onAuthStateChange((event,session)=>{
  passwordRecovery.observe(event,session?.user.id);
  if(event==='PASSWORD_RECOVERY')window.history.replaceState(null,'','/?recuperacao=1');
 });
 void initialization.then(()=>{setTimeout(()=>{
  passwordRecovery.settle();
  // Remove invalid callback details too, without ever displaying provider payloads.
  if(passwordRecovery.getSnapshot().phase==='invalid')window.history.replaceState(null,'','/?recuperacao=1');
 },0);}).catch(()=>passwordRecovery.invalidate());
}
if(!db&&typeof window!=='undefined')passwordRecovery.settle();
if(db&&typeof window!=='undefined')window.addEventListener('hashchange',()=>{
 // A link pasted into an already open homepage may be same-document navigation.
 // Let a fresh SDK instance validate it instead of falling back to the old session.
 if(passwordRecovery.getSnapshot().phase==='none'&&window.location.hash&&isRecoveryCallback(window.location.href))window.location.reload();
});
if(db&&typeof window!=='undefined'){
 const discardHistoricalCallback=()=>{
  if(window.location.hash&&isRecoveryCallback(window.location.href)){
   window.history.replaceState(null,'','/?recuperacao=1');passwordRecovery.invalidate();
  }
 };
 window.addEventListener('pageshow',event=>{if(event.persisted)discardHistoricalCallback();});
 window.addEventListener('popstate',()=>{if(passwordRecovery.getSnapshot().phase!=='none')discardHistoricalCallback();});
}
