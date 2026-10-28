import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
test('staging backup refuses other contexts and proves real encryption roundtrip without exposing plaintext artifacts',()=>{
 execFileSync('python3',[new URL('./staging_backup_test.py',import.meta.url).pathname],{stdio:'pipe',timeout:30000});
});
