import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
test('private recovery pins backup provenance and rejects unsafe contexts and archives',()=>{
 execFileSync('python3',[new URL('./staging_recovery_test.py',import.meta.url).pathname],{stdio:'pipe',timeout:30000});
});
