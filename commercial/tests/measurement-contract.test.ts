import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateMeasurementEnvelope,type MeasurementEnvelope} from '../lib/measurement-contract';
test('measurement boundary preserves source identity, tenant, units and values without conversion',()=>{
 const record:MeasurementEnvelope={version:1,source:'nutritrack',source_record_id:'external-1',organization_id:'org',client_id:'pupil',observed_on:'2026-10-16',values:{weight_kg:{value:80,unit:'kg'}}};
 const context={organization_id:'org',client_id:'pupil'};assert.deepEqual(validateMeasurementEnvelope(record,context),record);
 for(const malformed of [null,{...record,source_record_id:123},{...record,values:null},{...record,private_note:'not part of the contract'},{...record,values:{weight_kg:{value:80.001,unit:'kg'}}}])assert.throws(()=>validateMeasurementEnvelope(malformed as MeasurementEnvelope,context));
 for(const patch of [{organization_id:'foreign'},{client_id:'other'},{version:2},{source:'unknown'},{observed_on:'2026-02-30'},{values:{weight_kg:{value:176,unit:'lb'}}},{values:{weight_kg:{value:NaN,unit:'kg'}}},{values:{unknown:{value:1,unit:'cm'}}},{values:{}}])assert.throws(()=>validateMeasurementEnvelope({...record,...patch} as MeasurementEnvelope,context));
});
