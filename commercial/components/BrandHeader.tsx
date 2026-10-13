"use client";
import type { CSSProperties } from "react";
export type Branding={display_name:string;primary_color:string;logo_url:string|null};
const defaultBrand:Branding={display_name:"AURA",primary_color:"#137F79",logo_url:null};
export default function BrandHeader({branding,subtitle="Acompanhamento profissional"}:{branding?:Branding|null;subtitle?:string}){
 const brand=branding||defaultBrand;
 const color=/^#[0-9a-fA-F]{6}$/.test(brand.primary_color)?brand.primary_color:defaultBrand.primary_color;
 const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4));
 const luminance=channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
 const foreground=(luminance+0.05)/0.05>=4.5?"#FFFFFF":"#102C2A";
 return <div className="brandhead" style={{"--brand-accent":color,"--brand-foreground":foreground} as CSSProperties}>
 <div className="brandmark" aria-hidden="true">{brand.display_name.trim().slice(0,1).toUpperCase()}</div>
 <div><strong>{brand.display_name}</strong><p>{subtitle}</p></div>
 <span className="brand-powered">Powered by AURA Business</span>
 </div>;
}
