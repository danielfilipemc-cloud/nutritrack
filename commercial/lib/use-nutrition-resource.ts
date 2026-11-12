'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from './supabase';
import {NutritionPersistenceError,type NutritionRpcClient} from './nutrition-persistence';
import {nutritionRequest} from './nutrition-request';
export type NutritionContext={org:string;clientId:string;userId:string;archived?:boolean};
export function useNutritionResource<R extends {dispose:()=>void},D>(context:NutritionContext,key:string,factory:(db:NutritionRpcClient)=>R,load:(repo:R)=>Promise<D>){
 const [revision,setRevision]=useState(0),[busy,setBusy]=useState(false);
 const [result,setResult]=useState<{key:string;data:D|null;write:boolean;message:string}|null>(null);
 const currentKey=`${context.org}:${context.clientId}:${context.userId}:${key}:${revision}`;
 const current=useRef({factory,load});current.current={factory,load};
 const ref=useRef<{repo:R;key:string;epoch:number}|null>(null),epoch=useRef(0),pending=useRef(false);
 useEffect(()=>{
  const client=db;if(!client){setResult({key:currentKey,data:null,write:false,message:'Serviço indisponível.'});return;}
  const e=++epoch.current,{factory,load}=current.current,repo=factory(client),controller=new AbortController();ref.current={repo,key:currentKey,epoch:e};pending.current=false;setBusy(false);setResult(null);
  void(async()=>{try{
   const cap=await nutritionRequest(controller.signal,signal=>client.from('nutrition_capabilities').select('can_write').eq('organization_id',context.org).eq('user_id',context.userId).abortSignal(signal).maybeSingle()).catch(()=>{throw new NutritionPersistenceError('unavailable');});
   if(epoch.current!==e)return;if(cap.error||!cap.data)throw new NutritionPersistenceError(!cap.error||['42501','PT403'].includes(cap.error.code)?'denied':'unavailable');
   const data=await load(repo);if(epoch.current===e)setResult({key:currentKey,data,write:cap.data.can_write===true,message:''});
  }catch(error){if(epoch.current===e)setResult({key:currentKey,data:null,write:false,message:nutritionError(error)});}})();
  return()=>{epoch.current++;controller.abort();repo.dispose();if(ref.current?.repo===repo)ref.current=null;};
 },[context.org,context.clientId,context.userId,currentKey]);
 useEffect(()=>{const focus=()=>{if(!pending.current)setRevision(n=>n+1);};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[]);
 async function run<T>(operation:(repo:R)=>Promise<T>,write=false){
  const item=ref.current;if(!item||item.key!==currentKey||pending.current)throw new NutritionPersistenceError('stale');
  if(write&&(!result?.write||result.key!==currentKey||context.archived))throw new NutritionPersistenceError('denied');
  pending.current=true;setBusy(true);
  try{const value=await operation(item.repo);if(epoch.current!==item.epoch)throw new NutritionPersistenceError('stale');return value;}
  catch(error){if(epoch.current!==item.epoch)throw new NutritionPersistenceError('stale');if(error instanceof NutritionPersistenceError&&['denied','invalid-response'].includes(error.kind))setResult({key:currentKey,data:null,write:false,message:nutritionError(error)});throw error;}
  finally{if(epoch.current===item.epoch){pending.current=false;setBusy(false);}}
 }
 const visible=result?.key===currentKey?result:null;
 return {data:visible?.data||null,ready:!!visible?.data,loading:!visible,busy,canWrite:!!visible?.data&&visible.write&&!context.archived,message:visible?.message||'',run,refresh:()=>setRevision(n=>n+1)};
}
export function nutritionError(error:unknown){return error instanceof NutritionPersistenceError?error.message:'Não foi possível concluir. Confirma os dados e os limites indicados.';}
export function staleNutrition(error:unknown){return error instanceof NutritionPersistenceError&&error.kind==='stale';}
