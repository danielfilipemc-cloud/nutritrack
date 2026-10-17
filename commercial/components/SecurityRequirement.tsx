'use client';
import {useEffect,useState} from 'react';
import {db} from '../lib/supabase';
export default function SecurityRequirement({org}:{org:string}){
 const [blocked,setBlocked]=useState(false);
 useEffect(()=>{let alive=true,version=0;setBlocked(false);async function load(){const current=++version;try{if(!db||!org)return;const r=await db.rpc('aura_security_requirement',{p_org:org});if(alive&&current===version)setBlocked(!r.error&&r.data?.required===true&&r.data?.satisfied!==true);}catch{if(alive&&current===version)setBlocked(false);}}void load();
 const sub=db?.auth.onAuthStateChange(()=>{setTimeout(()=>{if(alive)void load();},0);});return()=>{alive=false;version++;sub?.data.subscription.unsubscribe();};},[org]);
 return blocked?<p role="alert">Este estabelecimento exige segundo fator recente para aceder aos dados dos alunos. <a href={'/seguranca?org='+encodeURIComponent(org)}>Confirmar em Segurança</a></p>:null;
}
