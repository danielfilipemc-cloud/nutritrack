import {validDate} from './validation';
export type WaterEntryV1={consumedOn:string;time:string|null;quantity:{amount:number;unit:'ml'}};
export type WaterCommandV1={contractVersion:1;requestId:string;waterId:string|null;expectedRevision:number;operation:'save'|'void';entry:WaterEntryV1|null;reason:string|null};
export function waterObject(value:unknown,keys:string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw new TypeError('Invalid water fields');return value as Record<string,unknown>;
}
export function waterId(value:unknown):string{if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))throw new TypeError('Invalid water identity');return value.toLowerCase();}
export function waterRevision(value:unknown,min=1):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min)throw new RangeError('Invalid water revision');return value;}
export function parseWaterEntryV1(input:unknown,today:string):WaterEntryV1{
 const value=waterObject(input,['consumedOn','time','quantity']),quantity=waterObject(value.quantity,['amount','unit']);
 if(!validDate(today)||typeof value.consumedOn!=='string'||!validDate(value.consumedOn)||value.consumedOn.startsWith('0000-')||value.consumedOn>today
 ||value.time!==null&&(typeof value.time!=='string'||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time))
 ||typeof quantity.amount!=='number'||!Number.isInteger(quantity.amount)||quantity.amount<1||quantity.amount>5000||quantity.unit!=='ml')throw new RangeError('Invalid water declaration');
 return {consumedOn:value.consumedOn,time:value.time as string|null,quantity:{amount:quantity.amount,unit:'ml'}};
}
/** Staff-scoped command; actor/organization/client are never accepted in payload.
 * Unknown time stays null. Daily legacy totals, goals and zero declarations are
 * separate contracts; no implicit conversion from cups, litres or grams. */
export function parseWaterCommandV1(input:unknown,today:string):WaterCommandV1{
 const v=waterObject(input,['contractVersion','requestId','waterId','expectedRevision','operation','entry','reason']);
 const id=v.waterId===null?null:waterId(v.waterId),rev=waterRevision(v.expectedRevision,0);
 if(v.contractVersion!==1||!['save','void'].includes(v.operation as string)||(!id&&rev!==0)||(id&&rev<1)||v.operation==='void'&&!id||!validDate(today))throw new RangeError('Invalid water command');
 let reason:string|null=null;
 if(id){if(typeof v.reason!=='string'||/[\u0000-\u001f\u007f]/.test(v.reason)||[...v.reason].some(c=>{const n=c.codePointAt(0)!;return n>=0xd800&&n<=0xdfff;}))throw new TypeError('Invalid change reason');reason=v.reason.replace(/^ +| +$/g,'');if([...reason].length<3||[...reason].length>300)throw new RangeError('Invalid change reason');}
 else if(v.reason!==null)throw new TypeError('New declarations have no correction reason');
 if(v.operation==='void'&&v.entry!==null)throw new TypeError('Void cannot replace declaration');
 return {contractVersion:1,requestId:waterId(v.requestId),waterId:id,expectedRevision:rev,operation:v.operation as 'save'|'void',entry:v.operation==='void'?null:parseWaterEntryV1(v.entry,today),reason};
}
