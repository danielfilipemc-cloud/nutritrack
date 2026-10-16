import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {foundationFixture,id} from '../tests/foundation-fixture';
import {snapshotLocalDevelopment,restoreLocalDevelopment,type RecoveryManifest} from './local-recovery';
// Creates ONLY synthetic local data. No env files, Supabase SDK or network.
async function main(){
 const f=await foundationFixture();try{
 await f.grant(2,100);await f.asUser(2);
 await f.db.query(`select aura_assessment_create('${id(10)}','${id(100)}',app_private.business_today(),80,null,null)`);
 await f.db.exec('reset role');
 const {bytes,manifest}=await snapshotLocalDevelopment(f.db);
 const dir=new URL('../.aura-integration/foundation-recovery/',import.meta.url);await mkdir(dir,{recursive:true});
 await writeFile(new URL('synthetic-backup.tar.gz',dir),bytes);await writeFile(new URL('manifest.json',dir),JSON.stringify(manifest,null,2));
 const saved=new Uint8Array(await readFile(new URL('synthetic-backup.tar.gz',dir)));
 const savedManifest=JSON.parse(await readFile(new URL('manifest.json',dir),'utf8')) as RecoveryManifest;
 const restored=await restoreLocalDevelopment(saved,savedManifest);try{
 const count=(await restored.query<{n:number}>('select count(*)::int n from assessments')).rows[0].n;if(count!==1)throw new Error('Restore row count mismatch');
 await restored.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id(3)}',false)`);
 if((await restored.query('select * from assessments')).rows.length)throw new Error('Restore authorization mismatch');
 console.log(JSON.stringify({result:'PASS',scope:'synthetic-local-only',migrations:manifest.migrations.length,restored_assessments:count,restored_admin_has_measurements:false,sha256:manifest.sha256}));
 }finally{await restored.close();}
 }finally{await f.db.close();}
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Local recovery failed');process.exitCode=1;});
