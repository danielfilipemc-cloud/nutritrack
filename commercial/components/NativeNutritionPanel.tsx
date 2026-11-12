'use client';
import {useId,useRef,useState} from 'react';
import NutritionWorkspace from './NutritionWorkspace';
import NutritionWaterWorkspace from './NutritionWaterWorkspace';
import NutritionDocumentsWorkspace from './NutritionDocumentsWorkspace';
import type {NutritionContext} from '../lib/use-nutrition-resource';
export default function NativeNutritionPanel(props:NutritionContext&{onDirtyChange:(dirty:boolean,pending?:boolean)=>void}){
 const [area,setArea]=useState('meals'),[visited,setVisited]=useState(['meals']),[pending,setPending]=useState(false),id=useId();
 const states=useRef<Record<string,{dirty:boolean;pending:boolean}>>({});
 const report=(key:string,dirty:boolean,busy=false)=>{states.current[key]={dirty,pending:busy};const values=Object.values(states.current);setPending(values.some(v=>v.pending));props.onDirtyChange(values.some(v=>v.dirty),values.some(v=>v.pending));};
 return <div className="aura-native-nutrition"><nav aria-label="Áreas da nutrição">{[['meals','Refeições'],['water','Água'],['documents','Receitas e planos']].map(([key,label])=><button key={key} className="outline" aria-pressed={area===key} aria-controls={`${id}-${key}`} disabled={pending} onClick={()=>{setArea(key);setVisited(old=>old.includes(key)?old:[...old,key]);}}>{label}</button>)}</nav>
  <div id={`${id}-meals`} hidden={area!=='meals'}><NutritionWorkspace {...props} onDirtyChange={(d,p)=>report('meals',d,p)}/></div>
  <div id={`${id}-water`} hidden={area!=='water'}>{visited.includes('water')&&<NutritionWaterWorkspace {...props} onDirtyChange={(d,p)=>report('water',d,p)}/>}</div>
  <div id={`${id}-documents`} hidden={area!=='documents'}>{visited.includes('documents')&&<NutritionDocumentsWorkspace {...props} onDirtyChange={(d,p)=>report('documents',d,p)}/>}</div>
 </div>;
}
