export const defaultDemoBrand='Estúdio Aurora',defaultDemoAccent='#137F79';
export const demoPalettes=[{name:'Aurora',color:defaultDemoAccent},{name:'Oceano',color:'#215E86'},{name:'Dourado',color:'#F1C65F'}];
export function accentAppearance(value:string){
 if(!/^#[0-9a-f]{6}$/i.test(value))throw Error('Escolhe uma cor hexadecimal válida.');
 const rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2],light=1.05/(luminance+.05),dark=(luminance+.05)/.05;
 return {color:value.toUpperCase(),ink:light>=dark?'#FFFFFF':'#000000',ratio:Math.max(light,dark)};
}
