"use client";
import type { CSSProperties } from "react";
import {brandForeground} from "../lib/branding";
export type Branding={display_name:string;primary_color:string;logo_url:string|null};
const defaultBrand:Branding={display_name:"AURA",primary_color:"#137F79",logo_url:null};
export default function BrandHeader({branding,subtitle="Acompanhamento profissional"}:{branding?:Branding|null;subtitle?:string}){
 const brand=branding||defaultBrand;
 const color=/^#[0-9a-fA-F]{6}$/.test(brand.primary_color)?brand.primary_color:defaultBrand.primary_color;
 const foreground=brandForeground(color);
 return <div className="brandhead" style={{"--brand-accent":color,"--brand-foreground":foreground} as CSSProperties}>
 <div className="brandmark" aria-hidden="true">{brand.display_name.trim().slice(0,1).toUpperCase()}</div>
 <div><strong>{brand.display_name}</strong><p>{subtitle}</p></div>
 <span className="brand-powered">Powered by AURA Business</span>
 </div>;
}
