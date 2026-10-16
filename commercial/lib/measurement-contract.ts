import {validDate,measurement} from './validation';
export const measurementFields={weight_kg:{label:'Peso',unit:'kg',max:500},height_cm:{label:'Altura',unit:'cm',max:300},waist_cm:{label:'Cintura',unit:'cm',max:300}} as const;
export type MeasurementEnvelope={version:1;source:'aura'|'nutritrack';source_record_id:string;organization_id:string;client_id:string;observed_on:string;values:Partial<Record<keyof typeof measurementFields,{value:number;unit:'kg'|'cm'}>>};
/** Read contract only. Accepting an envelope does not grant access or import it. */
export function validateMeasurementEnvelope(input:MeasurementEnvelope,context:{organization_id:string;client_id:string}){
 if(!input||typeof input!=='object'||input.version!==1||!['aura','nutritrack'].includes(input.source)||typeof input.source_record_id!=='string'||!input.source_record_id.trim()||input.source_record_id.length>160||/[\u0000-\u001f]/.test(input.source_record_id)||typeof input.organization_id!=='string'||!input.organization_id||typeof input.client_id!=='string'||!input.client_id||input.organization_id!==context.organization_id||input.client_id!==context.client_id||typeof input.observed_on!=='string'||!validDate(input.observed_on)||!input.values||typeof input.values!=='object'||Array.isArray(input.values))throw Error('Invalid measurement identity or version');
 const keys=Object.keys(input.values);if(!keys.length)throw Error('Missing measurements');
 if(Object.keys(input).some(key=>!['version','source','source_record_id','organization_id','client_id','observed_on','values'].includes(key))||input.observed_on<'2000-01-01'||input.observed_on>'2100-12-31')throw Error('Unknown fields or date outside contract');
 for(const key of keys){const definition=measurementFields[key as keyof typeof measurementFields],item=input.values[key as keyof typeof measurementFields];if(!definition||!item||item.unit!==definition.unit||!Number.isFinite(item.value)||item.value<=0||item.value>definition.max||Object.keys(item).some(k=>!['value','unit'].includes(k)))throw Error('Invalid measurement value or unit');measurement(String(item.value),definition.max,key==='weight_kg'?2:1);}
 return input;
}
