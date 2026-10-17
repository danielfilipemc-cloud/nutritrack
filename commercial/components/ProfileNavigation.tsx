"use client";
export default function ProfileNavigation<T extends string>({items,value,onChange,disabled}:{items:ReadonlyArray<readonly [T,string]>;value:T;onChange:(value:T)=>void;disabled:boolean}){
 return <><nav className="aura-profile-tabs" aria-label="Secções da ficha">{items.map(([key,label])=><button key={key} className={value===key?"":"outline"} aria-pressed={value===key} disabled={disabled} onClick={()=>onChange(key)}>{label}</button>)}</nav>
 <label className="aura-profile-area">Área da ficha<select value={value} disabled={disabled} onChange={event=>onChange(event.target.value as T)}>{items.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></>;
}
