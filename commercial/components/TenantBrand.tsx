"use client";
import {useEffect,useState} from "react";
import {db} from "../lib/supabase";
import BrandHeader,{type Branding} from "./BrandHeader";
export default function TenantBrand({org,name,subtitle}:{org:string;name:string;subtitle:string}){
 const [loaded,setLoaded]=useState<{org:string;brand:Branding}|null>(null);
 const [failed,setFailed]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{setLoaded(null);setFailed(false);if(!db||!org)return;let active=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
 void(async()=>{try{if(!db)throw Error();const r=await db.from("organization_branding").select("display_name,primary_color,logo_url").eq("organization_id",org).abortSignal(controller.signal).maybeSingle();if(!active)return;if(r.error)throw Error();setLoaded(r.data?{org,brand:r.data}:null);}catch{if(active)setFailed(true);}finally{clearTimeout(timeout);}})();
 return()=>{active=false;clearTimeout(timeout);controller.abort();};},[org,revision]);
 return <><BrandHeader branding={loaded?.org===org?loaded.brand:{display_name:name,primary_color:"#137F79",logo_url:null}} subtitle={subtitle}/>{failed&&<p role="status">Não foi possível carregar a identidade visual. A identificação do estabelecimento mantém-se. <button className="outline" onClick={()=>setRevision(n=>n+1)}>Tentar carregar marca</button></p>}</>;
}
