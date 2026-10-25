import {exercises,type ExerciseId} from './training';

export type ExerciseGroup='all'|'lower'|'upper'|'core'|'movement';
type Reference={title:string;source:string;sourceUrl:string;videoId:string|null;language:'en';checkedOn:string};
const lower='https://projects.upei.ca/staffgetactive/lower-body-exercises/';
const upper='https://projects.upei.ca/staffgetactive/upper-body-exercises/';
const upei=(title:string,videoId:string,sourceUrl:string):Reference=>({title,videoId,sourceUrl,source:'UPEI · Staff Get Active',language:'en',checkedOn:'2026-10-25'});
// Links are editorial references, not a licence to download/rehost media or
// personalised exercise prescriptions. No third-party request is made on render.
export const exerciseReferences:Record<ExerciseId,Reference>={
 squat:upei('Sit to Stands','wwuLgIlPGhU',lower),
 row:{title:'How to Do a Standing Row with Band',videoId:'db43OS-4ruY',source:'Health e-University · UHN',sourceUrl:'https://www.youtube.com/watch?v=db43OS-4ruY',language:'en',checkedOn:'2026-10-25'},
 wall:{title:'Wall press up',videoId:'kmzcmFZ9NyY',source:'South Tees Hospitals NHS Foundation Trust',sourceUrl:'https://www.southtees.nhs.uk/resources/combined-press-ups/',language:'en',checkedOn:'2026-10-25'},
 step:{title:'Step-up',videoId:null,source:'NHS',sourceUrl:'https://www.nhs.uk/live-well/exercise/balance-exercises/',language:'en',checkedOn:'2026-10-25'},
 calf:upei('Calf Raises','wfoAnZWwv38',lower),
 march:{title:'March on the spot',videoId:null,source:'NHS',sourceUrl:'https://www.nhs.uk/live-well/exercise/how-to-warm-up-before-exercising/',language:'en',checkedOn:'2026-10-25'},
 bridge:upei('Glute Bridges','wahcR2ejQjQ',lower),
 bird:upei('Bird Dogs','k9gTLF8UkHA',upper),
 biceps:upei('Bicep Curl Variations','8VTFnq6d6Cs',upper),
 overhead:upei('Seated Overhead Press','BLeSRVv57qI',upper),
 hip:upei('Hip Abduction','Yt68QEr0NCs',lower),
 lunge:upei('Forward Lunges','ykW68LKG1VI',lower),
};
export const exerciseGroups:Record<ExerciseId,Exclude<ExerciseGroup,'all'>>={squat:'lower',row:'upper',wall:'upper',step:'lower',calf:'lower',march:'movement',bridge:'lower',bird:'core',biceps:'upper',overhead:'upper',hip:'lower',lunge:'lower'};
export const groupLabels:Record<ExerciseGroup,string>={all:'Todos os movimentos',lower:'Membros inferiores',upper:'Membros superiores',core:'Tronco e estabilidade',movement:'Movimento geral'};
export function youtubeReferenceUrl(id:string){if(!/^[A-Za-z0-9_-]{11}$/.test(id))throw new TypeError('Identificador de vídeo inválido.');return `https://www.youtube.com/watch?v=${id}`;}
const normalize=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
export function filterExercises(query:string,group:ExerciseGroup='all',videoOnly=false){const terms=normalize(query).split(/\s+/).filter(Boolean);return exercises.filter(e=>{const text=normalize(`${e.name} ${e.material} ${groupLabels[exerciseGroups[e.id]]}`);return (group==='all'||exerciseGroups[e.id]===group)&&(!videoOnly||!!exerciseReferences[e.id].videoId)&&terms.every(t=>text.includes(t));});}
