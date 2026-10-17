'use client';
import {useEffect,useRef} from 'react';
// Draft contents remain in component memory; never persist personal data in browser storage.
export function useDraftNavigation(state:()=>{dirty:boolean;pending:boolean},blocked:()=>void){
 const current=useRef(state),notify=useRef(blocked);current.current=state;notify.current=blocked;
 useEffect(()=>{
  let approved=false;
  function permit(){const s=current.current();if(s.pending){notify.current();return false;}return !s.dirty||window.confirm('Descartar as alterações da ficha antes de sair?');}
  function click(event:MouseEvent){
   const anchor=(event.target instanceof Element?event.target.closest('a[href]'):null) as HTMLAnchorElement|null;
   if(!anchor||anchor.download||anchor.target==='_blank'||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const target=new URL(anchor.href,window.location.href),here=new URL(window.location.href);
   if(target.pathname===here.pathname&&target.search===here.search&&target.origin===here.origin)return;
   const s=current.current();if(!s.dirty&&!s.pending)return;
   if(!permit()){event.preventDefault();event.stopImmediatePropagation();return;}
   // Force a document navigation after approval, so client routers cannot unmount early.
   approved=true;event.stopImmediatePropagation();
  }
  function unload(event:BeforeUnloadEvent){if(approved){approved=false;event.stopImmediatePropagation();return;}const s=current.current();if(s.dirty||s.pending){event.preventDefault();event.returnValue='';}}
  const navigation=(window as unknown as {navigation?:EventTarget}).navigation;
  function traverse(raw:Event){const event=raw as Event&{navigationType?:string;hashChange?:boolean;destination?:{sameDocument:boolean}};if(event.navigationType!=='traverse'||event.hashChange||!event.cancelable)return;if(!permit())event.preventDefault();else approved=event.destination?.sameDocument===false;}
  document.addEventListener('click',click,true);window.addEventListener('beforeunload',unload,true);navigation?.addEventListener('navigate',traverse);
  return()=>{document.removeEventListener('click',click,true);window.removeEventListener('beforeunload',unload,true);navigation?.removeEventListener('navigate',traverse);};
 },[]);
}
