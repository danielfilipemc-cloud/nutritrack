"use client";
import {useEffect,useState} from "react";
import type {User} from "@supabase/supabase-js";
import {db} from "./supabase";
export type Organization={id:string;name:string;role:"owner"|"admin"|"coach"};
export function useProfessional(){
 const [user,setUser]=useState<User|null>(null),[orgs,setOrgs]=useState<Organization[]>([]),[org,setOrg]=useState(""),[status,setStatus]=useState("A verificar sessão...");
 useEffect(()=>{if(!db){setStatus("Serviço não configurado.");return;}let alive=true,version=0,identity="";
 const sub=db.auth.onAuthStateChange((_event,session)=>{version++;if(!alive)return;if(identity!==(session?.user.id||"")){setOrg("");setOrgs([]);identity=session?.user.id||"";}setUser(session?.user||null);setStatus(session?"":"Inicia sessão para continuar.");});
 const current=version;void db.auth.getUser().then(({data,error})=>{if(!alive||version!==current)return;identity=error?"":data.user?.id||"";setUser(error?null:data.user);setStatus(data.user?"":"Inicia sessão para continuar.");});
 return()=>{alive=false;sub.data.subscription.unsubscribe();};},[]);
 useEffect(()=>{if(!db||!user){setOrgs([]);setOrg("");return;}let alive=true;setStatus("A carregar estabelecimentos...");
 void db.from("organization_members").select("role,organizations(id,name)").then(({data,error})=>{if(!alive)return;if(error){setStatus("Não foi possível carregar estabelecimentos.");return;}
 const list:Organization[]=(data||[]).flatMap(row=>{const item=Array.isArray(row.organizations)?row.organizations[0]:row.organizations;return item?[{...item,role:row.role}]:[];});setOrgs(list);setOrg(list[0]?.id||"");setStatus(list.length?"":"Sem estabelecimento associado. Podes aceitar um convite válido.");});return()=>{alive=false;};},[user?.id]);
 return {user,orgs,org,setOrg,status};
}
