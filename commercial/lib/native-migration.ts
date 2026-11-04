/** Offline NutriTrack v2 inventory. No Auth, network, storage or clinical conversion. */
import {validDate} from './validation';
import {parseCompositionV1} from './nutrition-contract';
export type Json = null | boolean | number | string | Json[] | {[key: string]: Json};
export type MigrationCategory = 'meals'|'water'|'foods'|'measurements'|'templates'|'profile'|'preferences'|'photos'|'unknown';
export type MigrationRecord = {id: string; category: MigrationCategory; origin: string; fingerprint: string; disposition: 'prepared'|'pending'; reason: string; raw: Json; normalized: Json};
export type MigrationManifest = {contractVersion: 1; source: 'NutriTrack Pro'; backupVersion: 2; sourceNamespace: string; snapshot: string; exportedAt: string; records: MigrationRecord[]; counts: {total: number; prepared: number; pending: number}};
function decimalIdentity(token: string): string {
 const [mantissa, exponent = '0'] = token.toLowerCase().split('e');
 const negative = mantissa.startsWith('-'), unsigned = negative ? mantissa.slice(1) : mantissa;
 const [whole, fraction = ''] = unsigned.split('.');
 const digits = (whole + fraction).replace(/^0+/, '');
 if (!digits) return '0';
 const significant = digits.replace(/0+$/, '');
 return (negative ? '-' : '') + significant + 'e' + (Number(exponent) - fraction.length + digits.length - significant.length);
}
const fail = (message: string): never => {throw new Error(message);};
const isObject = (v: Json): v is {[k: string]: Json} => !!v && typeof v === 'object' && !Array.isArray(v);
export function canonical(value: Json): string {
 if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
 if (isObject(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
 return JSON.stringify(value);
}
export async function digest(value: Json): Promise<string> {
 const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
 return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
}
/** Bounded recursive JSON parser rejects duplicate/prototype keys before JSON.parse
 * can silently discard them. All raw values survive inventory or rejection. */
export function parseMigrationJson(text: string): Json {
 if (new TextEncoder().encode(text).length > 2_000_000) return fail('O ficheiro excede 2 MB.');
 let i = 0, nodes = 0;
 const ws = () => {while (/[ \t\r\n]/.test(text[i] ?? '') && i < text.length) i++;};
 const string = (): string => {
  const start = i++;
  while (i < text.length) {if (text[i] === '\\') {i += 2; continue;} if (text[i++] === '"') return JSON.parse(text.slice(start,i));}
  return fail('Texto JSON incompleto.');
 };
 const read = (depth: number): Json => {
  if (++nodes > 50_000 || depth > 24) return fail('Estrutura demasiado complexa.');
  ws();const c = text[i];
  if (c === '"') return string();
  if (c === '{') {
   i++;ws();const out: {[k: string]: Json} = Object.create(null);if (text[i] === '}') {i++;return out;}
   while (i < text.length) {
    ws();if (text[i] !== '"') return fail('Chave JSON inválida.');const k = string();ws();
    if (Object.hasOwn(out,k) || ['__proto__','prototype','constructor'].includes(k)) return fail('Chave repetida ou reservada.');
    if (text[i++] !== ':') return fail('Objeto JSON inválido.');out[k] = read(depth+1);ws();
    const end = text[i++];if (end === '}') return out;if (end !== ',') return fail('Objeto JSON inválido.');
   }
  } else if (c === '[') {
   i++;ws();const out: Json[] = [];if (text[i] === ']') {i++;return out;}
   while (i < text.length) {out.push(read(depth+1));ws();const end = text[i++];if (end === ']') return out;if (end !== ',') return fail('Lista JSON inválida.');}
  } else {
   const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
   if (match) {i+=match[0].length;const value = JSON.parse(match[0]);if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)) || decimalIdentity(match[0]) !== decimalIdentity(JSON.stringify(value)))) return fail('Número sem representação exata suportada; o ficheiro não foi alterado.');return value;}
  }
  return fail('JSON inválido ou incompleto.');
 };
 try {const result = read(0);ws();if (i !== text.length) return fail('Conteúdo adicional no ficheiro.');return result;} catch (e) {throw e instanceof Error ? e : new Error('JSON inválido.');}
}
const safeText = (v: Json|undefined, max = 120): v is string => typeof v === 'string' && v.trim().length > 0 && Array.from(v).length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const numeric = (v: Json|undefined, max: number, positive = false): v is number => typeof v === 'number' && Number.isFinite(v) && v >= (positive ? Number.MIN_VALUE : 0) && v <= max;
const day = (v: Json|undefined, today: string): v is string => typeof v === 'string' && validDate(v) && v >= '2000-01-01' && v <= today;
const keys = (v: {[k: string]: Json}, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
const nutrientKeys = ['calories','protein','carbs','fat'] as const;
function meal(raw: Json, today: string): Json | null {
 if (!isObject(raw) || !keys(raw,['date','time','type','name','quantity',...nutrientKeys,'source']) || !day(raw.date,today)
 || typeof raw.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time) || !safeText(raw.name) || !safeText(raw.type)
 || !numeric(raw.quantity,5000,true) || !nutrientKeys.every(k => numeric(raw[k],1_000_000)) || (raw.source !== undefined && raw.source !== 'planned')) return null;
 return {contractVersion:1,kind:'legacy-reported-total',observedOn:raw.date,time:raw.time,label:raw.name,mealLabel:raw.type,
  declaredGrams:raw.quantity,reportedTotals:Object.fromEntries(nutrientKeys.map(k=>[k,raw[k]])),composition:null,legacySource:raw.source??'manual'};
}
function food(raw: Json): Json|null {
 if (!isObject(raw) || !keys(raw,['cat','source','name','barcode','serving','unit','aliases',...nutrientKeys]) || !safeText(raw.name)
 || !safeText(raw.cat) || !safeText(raw.unit) || !numeric(raw.serving,5000,true)
 || ['source','barcode','aliases'].some(k=>raw[k]!==undefined && (typeof raw[k]!=='string' || String(raw[k]).length>500))) return null;
 try {return {contractVersion:1,label:raw.name,composition:parseCompositionV1({contractVersion:1,basis:{amount:100,unit:'g'},nutrients:Object.fromEntries(nutrientKeys.map(k=>[k,raw[k]??null]))}) as unknown as Json,legacyServing:{amount:raw.serving,unit:raw.unit}};} catch {return null;}
}
function measurement(raw: Json,today: string): Json|null {
 const fields = ['weight','waist','hip','chest','arm','thigh'];
 if (!isObject(raw) || !keys(raw,['date',...fields]) || !day(raw.date,today) || !fields.some(k=>typeof raw[k]==='number')
 || fields.some(k=>raw[k]!==undefined && raw[k]!==null && !numeric(raw[k],k==='weight'?500:400,true))) return null;
 return {contractVersion:1,observedOn:raw.date,measurements:Object.fromEntries(fields.map(k=>[k,{value:raw[k]??null,unit:k==='weight'?'kg':'cm'}]))};
}
export async function previewNativeMigration(text: string, sourceNamespace: string, today: string): Promise<MigrationManifest> {
 if (!/^[a-z0-9][a-z0-9_-]{7,79}$/.test(sourceNamespace)) return fail('Identificador de origem explícito inválido. Não uses email ou nome.');
 if (!validDate(today)) return fail('Data de referência inválida.');
 const root = parseMigrationJson(text);
 if (!isObject(root) || root.app!=='NutriTrack Pro' || root.version!==2 || !isObject(root.data)
 || typeof root.exportedAt!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(root.exportedAt) || (!Number.isFinite(Date.parse(root.exportedAt)) || new Date(root.exportedAt).toISOString().replace('.000Z','Z') !== root.exportedAt.replace(/\.0{1,3}Z$/,'Z').replace(/\.(\d{1,2})Z$/,(_,n:string)=>'.'+n.padEnd(3,'0')+'Z'))) return fail('É necessário um backup NutriTrack Pro versão 2 com data de exportação.');
 const data = root.data, records: MigrationRecord[] = [];
 const add = async(category: MigrationCategory, raw: Json, normalized: Json, reason: string, origin: string = category) => {
  if (records.length >= 5000) return fail('O inventário excede 5000 registos.');
  const fingerprint = await digest({category,origin,raw});
  records.push({id:'',category,origin,fingerprint,disposition:normalized===null?'pending':'prepared',reason,raw,normalized});
 };
 const list = async(value: Json|undefined,category: MigrationCategory, transform?: (r:Json)=>Json|null, reason='Sem destino nativo aprovado.', origin: string = category) => {
  if (value===undefined) return;
  if (!Array.isArray(value)) {await add(category,value,null,'Formato de coleção não suportado.',origin);return;}
  if (!value.length) {await add(category,[],{kind:'empty-collection'},'Coleção vazia preservada.',origin);return;}
  for (const raw of value) {const normalized = transform?.(raw)??null;await add(category,raw,normalized,normalized===null?reason:'Valores de origem preservados.',origin);}
 };
 if (data.nutritrackData!==undefined) {
  if (!isObject(data.nutritrackData)) await add('unknown',data.nutritrackData,null,'Estrutura nutritrackData não suportada.');
  else for (const [k,v] of Object.entries(data.nutritrackData)) {
   if (k==='meals') await list(v,'meals',r=>meal(r,today),'Refeição inválida ou com campos não suportados.');
   else if (k==='templates') await list(v,'templates',undefined,'Modelo diário: não converter automaticamente em receita ou consumo.');
   else if (k==='bodyPhotos') await list(v,'photos',undefined,'Fotografias: destino seguro e retenção por definir.');
   else if (k==='profile') await add('profile',v,null,'Perfil e metas: exigem decisão explícita; não substituem identidade nem prescrição AURA.');
   else await add('unknown',{path:'nutritrackData.'+k,value:v},null,'Campo de origem sem mapeamento.');
  }
 }
 for (const [k,v] of Object.entries(data)) {
  if (k==='nutritrackData') continue;
  if (k==='customFoods') await list(v,'foods',food,'Alimento inválido ou com campos não suportados.');
  else if (k==='weightLog'||k==='bodyMeasurements') await list(v,'measurements',r=>measurement(r,today),'Medida inválida ou com campos não suportados.',k);
  else if (k==='waterData' && isObject(v)) {
   if (!Object.keys(v).length) await add('water',{}, {kind:'empty-collection'},'Coleção vazia preservada.');
   for (const [date,cups] of Object.entries(v)) {
    const normalized = day(date,today) && numeric(cups,200) && Number.isInteger(cups) ? {contractVersion:1,observedOn:date,totalMl:Number(cups)*250,legacyCups:cups,mlPerCup:250,time:null,kind:'legacy-daily-total'}:null;
    await add('water',{date,cups},normalized,normalized===null?'Contagem ou data inválida.':'Total diário: copos de 250 ml do contrato de origem, sem hora inventada.');
   }
  } else if (k==='recentFoods'||k==='darkMode'||k==='planDailyData') await add('preferences',{path:k,value:v},null,'Preferências e hábitos preservados para decisão; não representam consumo confirmado.');
  else await add('unknown',{path:k,value:v},null,'Campo de origem sem mapeamento.');
 }
 for (const [k,v] of Object.entries(root)) if (!['app','version','exportedAt','data'].includes(k)) await add('unknown',{path:'backup.'+k,value:v},null,'Metadado adicional preservado.');
 records.sort((a,b)=>a.category.localeCompare(b.category)||a.fingerprint.localeCompare(b.fingerprint));
 const occurrences = new Map<string,number>();
 for (const r of records) {const n=(occurrences.get(r.fingerprint)??0)+1;occurrences.set(r.fingerprint,n);r.id=r.category+':'+r.fingerprint+':'+n;}
 const snapshot = await digest(records as unknown as Json);
 return {contractVersion:1,source:'NutriTrack Pro',backupVersion:2,sourceNamespace,snapshot,exportedAt:root.exportedAt,records,
  counts:{total:records.length,prepared:records.filter(r=>r.disposition==='prepared').length,pending:records.filter(r=>r.disposition==='pending').length}};
}
