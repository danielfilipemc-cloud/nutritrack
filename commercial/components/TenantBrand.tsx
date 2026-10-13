"use client";
import {useEffect,useState} from "react";
import {db} from "../lib/supabase";
import BrandHeader,{type Branding} from "./BrandHeader";
export default function TenantBrand({org,name,subtitle}:{org:string;name:string;subtitle:string}){
 const [loaded,setLoaded]=useState<{org:string;brand:Branding}|null>(null);
 useEffect(()=>{if(!db||!org)return;let active=true;void db.from("organization_branding").select("display_name,primary_color,logo_url").eq("organization_id",org).maybeSingle().then(({data,error})=>{if(active)setLoaded(!error&&data?{org,brand:data}:null);});return()=>{active=false;};},[org]);
 return <BrandHeader branding={loaded?.org===org?loaded.brand:{display_name:name,primary_color:"#137F79",logo_url:null}} subtitle={subtitle}/>;
}
