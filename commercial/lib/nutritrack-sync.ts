import {parsePortionV1,type PortionV1} from './nutrition-contract';
import {measurement,validDate} from './validation';

/** Portable protocol/core only. No HTTP routes, credentials, personal storage,
 * database adapter or background worker are enabled by importing this module.
 * Access and clock MUST be derived afresh by a trusted server adapter, never
 * accepted from a browser body. This core does not authenticate a session.
 */
export type SyncKind='nutrition-plan'|'nutrition-entry'|'measurement';
type Item={id:string;label:string;portion:PortionV1};
type Plan={state:'published'|'withdrawn';validFrom:string;validTo:string;meals:{id:string;name:string;time:string;items:Item[]}[]};
type Entry={consumedOn:string;mealKind:'breakfast'|'lunch'|'dinner'|'snack'|'other';items:Item[];originPlan:{id:string;revision:number}|null};
type Measure={observedOn:string;weightKg:number|null;heightCm:number|null;waistCm:number|null};
type Base={contractVersion:1;eventId:string;linkId:string;consentVersion:number;sourceRecordId:string;revision:number;occurredAt:string};
export type SyncEnvelope=Base&({kind:'nutrition-plan';source:'aura';payload:Plan}|{kind:'nutrition-entry';source:'nutritrack';payload:Entry}|{kind:'measurement';source:'nutritrack';payload:Measure});
export type SyncLink={id:string;organizationId:string;clientId:string;nutritrackAccountId:string;active:boolean;consentVersion:number;scopes:readonly SyncKind[];consentExpiresAt:string};
export type SyncAccess={actorId:string;source:'aura'|'nutritrack';organizationId:string;clientId:string;maySend:readonly SyncKind[]};
export type SyncClock={now:string;today:string};
type Stored={revision:number;locallyEdited:boolean;pendingReview:boolean;versions:SyncEnvelope[]};
export type SyncState={links:SyncLink[];records:Record<string,Stored>;receipts:Record<string,{fingerprint:string;revision:number}>};
export class SyncConflict extends Error {}
function fail(message:string):never{throw new TypeError(message);}
function object(value:unknown,keys:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))fail('Objeto de sincronização inválido.');const row=value as Record<string,unknown>;if(Object.keys(row).length!==keys.length||keys.some(k=>!Object.hasOwn(row,k)))fail('Campos inesperados no contrato de sincronização.');return row;}
function text(value:unknown,max:number){if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))fail('Texto de sincronização inválido.');return value.trim();}
function id(value:unknown){const result=text(value,80);if(!/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/.test(result))fail('Identificador de origem inválido.');return result;}
function uuid(value:unknown){const result=text(value,36);if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(result))fail('Identificador do vínculo inválido.');return result.toLowerCase();}
function revision(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)fail('Revisão de origem inválida.');return value;}
function date(value:unknown,today?:string){if(typeof value!=='string'||!validDate(value)||value<'2000-01-01'||value>'2100-12-31'||today&&value>today)fail('Data do registo inválida.');return value;}
function instant(value:unknown){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))fail('Instante UTC inválido.');const d=new Date(value);if(d.toISOString().slice(0,10)!==value.slice(0,10))fail('Instante UTC inválido.');return d.toISOString();}
function unique<T extends {id:string}>(rows:T[]){if(new Set(rows.map(r=>r.id)).size!==rows.length)fail('Identificadores repetidos.');return rows;}
function items(value:unknown,max:number):Item[]{if(!Array.isArray(value)||value.length<1||value.length>max)fail('Número de alimentos inválido.');return unique(value.map(raw=>{const row=object(raw,['id','label','portion']);return {id:id(row.id),label:text(row.label,120),portion:parsePortionV1(row.portion)};}));}
function plan(value:unknown):Plan{const p=object(value,['state','validFrom','validTo','meals']);if(p.state!=='published'&&p.state!=='withdrawn')fail('Estado do plano inválido.');const from=date(p.validFrom),to=date(p.validTo);if(from>to||!Array.isArray(p.meals)||(p.state==='withdrawn'?p.meals.length!==0:p.meals.length<1||p.meals.length>12))fail('Plano disponibilizado inválido.');const meals=unique(p.meals.map(raw=>{const row=object(raw,['id','name','time','items']);if(typeof row.time!=='string'||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.time))fail('Hora da refeição inválida.');return {id:id(row.id),name:text(row.name,80),time:row.time,items:items(row.items,20)};}));return {state:p.state,validFrom:from,validTo:to,meals};}
function entry(value:unknown,today:string):Entry{const p=object(value,['consumedOn','mealKind','items','originPlan']);if(!['breakfast','lunch','dinner','snack','other'].includes(p.mealKind as string))fail('Tipo de refeição inválido.');const source=p.originPlan===null?null:object(p.originPlan,['id','revision']);return {consumedOn:date(p.consumedOn,today),mealKind:p.mealKind as Entry['mealKind'],items:items(p.items,50),originPlan:source?{id:id(source.id),revision:revision(source.revision)}:null};}
function measure(value:unknown,today:string):Measure{const p=object(value,['observedOn','weightKg','heightCm','waistCm']);const number=(v:unknown,max:number,decimals:number)=>{if(v===null)return null;if(typeof v!=='number'||!Number.isFinite(v))fail('Medição inválida.');return measurement(String(v),max,decimals);};const out={observedOn:date(p.observedOn,today),weightKg:number(p.weightKg,500,2),heightCm:number(p.heightCm,250,1),waistCm:number(p.waistCm,300,1)};if([out.weightKg,out.heightCm,out.waistCm].every(v=>v===null))fail('Registo sem medições.');return out;}
export function parseSyncEnvelope(value:unknown,clock:SyncClock):SyncEnvelope{
 const serialized=JSON.stringify(value);if(serialized&&new TextEncoder().encode(serialized).length>128_000)fail('Evento demasiado grande.');
 const now=instant(clock.now);date(clock.today);const p=object(value,['contractVersion','eventId','linkId','consentVersion','sourceRecordId','revision','occurredAt','kind','source','payload']);
 if(p.contractVersion!==1)fail('Versão de transporte não suportada.');const occurredAt=instant(p.occurredAt);if(occurredAt<'2000-01-01T00:00:00.000Z'||Date.parse(occurredAt)>Date.parse(now)+300_000)fail('O evento tem um instante futuro ou inválido.');
 const base:Base={contractVersion:1,eventId:uuid(p.eventId),linkId:uuid(p.linkId),consentVersion:revision(p.consentVersion),sourceRecordId:id(p.sourceRecordId),revision:revision(p.revision),occurredAt};
 if(p.kind==='nutrition-plan'&&p.source==='aura')return {...base,kind:p.kind,source:p.source,payload:plan(p.payload)};
 if(p.kind==='nutrition-entry'&&p.source==='nutritrack')return {...base,kind:p.kind,source:p.source,payload:entry(p.payload,clock.today)};
 if(p.kind==='measurement'&&p.source==='nutritrack')return {...base,kind:p.kind,source:p.source,payload:measure(p.payload,clock.today)};
 return fail('Tipo ou direção de sincronização não permitidos.');
}
export const syncRecordKey=(event:Pick<SyncEnvelope,'linkId'|'source'|'kind'|'sourceRecordId'>)=>JSON.stringify([event.linkId,event.source,event.kind,event.sourceRecordId]);
const receiptKey=(event:SyncEnvelope)=>JSON.stringify([event.linkId,event.eventId]);
/** Deterministic JSON over an already validated, normalised DTO. Digests contain
 * no plaintext payload in receipts; signatures/transport authentication are NOT
 * supplied by this function and must be implemented by the server adapter.
 */
async function fingerprint(event:SyncEnvelope){const bytes=new TextEncoder().encode(JSON.stringify(event));const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');}
function authorize(state:SyncState,event:SyncEnvelope,access:SyncAccess,clock:SyncClock){const link=state.links.find(l=>l.id===event.linkId);if(!link||!link.active||link.consentVersion!==event.consentVersion||Date.parse(instant(link.consentExpiresAt))<=Date.parse(instant(clock.now))||!link.scopes.includes(event.kind)||!access||!access.maySend?.includes(event.kind)||access.source!==event.source||access.organizationId!==link.organizationId||access.clientId!==link.clientId||(event.source==='nutritrack'&&access.actorId!==link.nutritrackAccountId))throw Error('Sincronização sem vínculo, consentimento ou acesso vigente.');uuid(access.actorId);return link;}
/** Immutable local reference reducer. A production repository MUST recheck link,
 * consent and live access inside the SAME locked transaction as receipt + write.
 * A call here is not persistence, a session check, network sync or permission to
 * expose a route. Keep this reducer out of the anonymous demonstration.
 */
export async function receiveSyncEnvelope(state:SyncState,input:unknown,access:SyncAccess,clock:SyncClock){
 const event=parseSyncEnvelope(input,clock),hash=await fingerprint(event);const link=authorize(state,event,access,clock),receipt=state.receipts[receiptKey(event)];
 if(receipt){if(receipt.fingerprint!==hash)throw new SyncConflict('O identificador do evento já tem outro conteúdo.');return {state,receipt:{eventId:event.eventId,revision:receipt.revision,status:'duplicate' as const}};}
 if(event.kind==='nutrition-entry'&&event.payload.originPlan){
  const ref=event.payload.originPlan,planKey=syncRecordKey({linkId:event.linkId,source:'aura',kind:'nutrition-plan',sourceRecordId:ref.id});
  const knownPlan=state.records[planKey],origin=knownPlan?.versions.find(v=>v.revision===ref.revision);
  if(!link.scopes.includes('nutrition-plan')||!origin||knownPlan.revision!==ref.revision||origin.kind!=='nutrition-plan'||origin.payload.state!=='published'||event.payload.consumedOn<origin.payload.validFrom||event.payload.consumedOn>origin.payload.validTo)throw new SyncConflict('A versão do plano não está disponível neste vínculo ou período.');
 }
 const key=syncRecordKey(event),old=state.records[key];if(old?.locallyEdited)throw new SyncConflict('Existe uma correção local; é necessária revisão explícita.');if(event.revision!==(old?.revision??0)+1)throw new SyncConflict('Revisão em falta, desatualizada ou fora de ordem.');
 const next:SyncState={...state,records:{...state.records,[key]:{revision:event.revision,locallyEdited:false,pendingReview:event.source==='nutritrack',versions:[...(old?.versions||[]),structuredClone(event)]}},receipts:{...state.receipts,[receiptKey(event)]:{fingerprint:hash,revision:event.revision}}};
 return {state:next,receipt:{eventId:event.eventId,revision:event.revision,status:'applied' as const}};
}
