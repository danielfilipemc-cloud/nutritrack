import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('staging backup refuses other contexts and proves real encryption roundtrip without exposing plaintext artifacts',()=>{
 execFileSync(process.env.AURA_TEST_PYTHON||'python3',[fileURLToPath(new URL('./staging_backup_test.py',import.meta.url))],{stdio:'pipe',timeout:30000});
});
