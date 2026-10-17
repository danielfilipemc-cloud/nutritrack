"use client";
import {useCallback,useEffect,useState} from "react";
import type {User} from "@supabase/supabase-js";
import {db} from "./supabase";
import {organizationPreference} from "./organization-preference";
export type Organization={id:string;name:string;role:"owner"|"admin"|"coach"};
export function useProfessional(){
 const [user,setUser]=useState<User|null>(null),[orgs,setOrgs]=useState<Organization[]>([]),[org,setOrg]=useState(""),[status,setStatus]=useState("A verificar sessão...");
 const [authLoading,setAuthLoading]=useState(true),[loadedFor,setLoadedFor]=useState(""),[revision,setRevision]=useState(0);
 const refreshOrganizations=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{if(!db){setStatus("Serviço indisponível.");setAuthLoading(false);return;}let alive=true,version=0,identity="";
 const sub=db.auth.onAuthStateChange((_event,session)=>{version++;if(!alive)return;if(identity!==(session?.user.id||"")){setOrg("");setOrgs([]);setLoadedFor("");identity=session?.user.id||"";}setUser(session?.user||null);setAuthLoading(false);setStatus(session?"":"Inicia sessão para continuar.");});
 const current=version;void db.auth.getUser().then(({data,error})=>{if(!alive||version!==current)return;identity=error?"":data.user?.id||"";setUser(error?null:data.user);setAuthLoading(false);setStatus(data.user&&!error?"":"Inicia sessão para continuar.");}).catch(()=>{if(alive&&version===current){setAuthLoading(false);setStatus("Não foi possível validar a sessão. Tenta novamente.");}});
 return()=>{alive=false;sub.data.subscription.unsubscribe();};},[]);
 useEffect(()=>{if(!db||!user){setOrgs([]);setOrg("");setLoadedFor("");return;}let alive=true;setLoadedFor("");setStatus("A carregar estabelecimentos...");
 void Promise.resolve(db.from("organization_members").select("role,organizations(id,name)")).then(({data,error})=>{if(!alive)return;if(error){setOrgs([]);setOrg("");setStatus("Não foi possível carregar estabelecimentos.");return;}
 const list:Organization[]=(data||[]).flatMap(row=>{const item=Array.isArray(row.organizations)?row.organizations[0]:row.organizations;return item?[{...item,role:row.role}]:[];});setOrgs(list);let stored:string|null=null;try{stored=sessionStorage.getItem(`aura.active-org:${user.id}`);}catch{}
 const requested=new URLSearchParams(window.location.search).get("org");
 setOrg(previous=>{const chosen=organizationPreference(list.map(o=>o.id),requested,stored,previous);try{sessionStorage.setItem(`aura.active-org:${user.id}`,chosen);}catch{}return chosen;});setLoadedFor(user.id);setStatus(list.length?"":"Sem estabelecimento associado. Podes aceitar um convite válido.");}).catch(()=>{if(alive){setOrgs([]);setOrg("");setLoadedFor("");setStatus("Não foi possível carregar estabelecimentos. Tenta novamente.");}});return()=>{alive=false;};},[user?.id,revision]);
 const selectOrg=useCallback((id:string)=>{if(!user||!orgs.some(o=>o.id===id))return;setOrg(id);try{sessionStorage.setItem(`aura.active-org:${user.id}`,id);}catch{}},[user?.id,orgs]);
 const current=!!user&&loadedFor===user.id;
 return {user,orgs:current?orgs:[],org:current?org:"",setOrg:selectOrg,status,authLoading,refreshOrganizations};
}
