import {useEffect,useRef} from 'react';

/** Focus only after an explicit navigation action, within this demo's content. */
export default function useDemoNavigationFocus(view:string,externalRequest=0) {
 const container=useRef<HTMLDivElement>(null);
 const requested=useRef(false);
 const previousExternal=useRef(externalRequest);
 useEffect(()=>{
  const external=previousExternal.current!==externalRequest;
  previousExternal.current=externalRequest;
  if(!requested.current&&!external)return;
  requested.current=false;
  // The student hub remains mounted while hidden to preserve local drafts.
  const heading=Array.from(container.current?.querySelectorAll<HTMLElement>('h1,h2')||[])
   .find(element=>!element.closest('[hidden]'));
  if(!heading)return;
  heading.tabIndex=-1;
  heading.focus({preventScroll:true});
  heading.scrollIntoView({block:'start',behavior:'instant'});
 },[view,externalRequest]);
 return {container,requestFocus:()=>{requested.current=true;}};
}
