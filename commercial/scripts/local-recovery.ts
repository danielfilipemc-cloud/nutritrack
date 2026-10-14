import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
// Local synthetic-development recovery only. This is not a Supabase cloud backup.
export type RecoveryManifest={version:1;sha256:string;migrations:{name:string;checksum:string}[]};
export async function snapshotLocalDevelopment(db:PGlite){
 const migrations=(await db.query<{name:string;checksum:string}>('select name,checksum from app_private.aura_migrations order by name')).rows;
 const archive=await db.dumpDataDir();
 const bytes=new Uint8Array(await archive.arrayBuffer());
 const manifest:RecoveryManifest={version:1,sha256:createHash('sha256').update(bytes).digest('hex'),migrations};
 return {bytes,manifest};
}
export async function restoreLocalDevelopment(bytes:Uint8Array,manifest:RecoveryManifest){
 if(manifest.version!==1||createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw new Error('Recovery integrity check failed');
 const db=new PGlite({loadDataDir:new Blob([new Uint8Array(bytes)])});
 try{
 const actual=(await db.query('select name,checksum from app_private.aura_migrations order by name')).rows;
 if(JSON.stringify(actual)!==JSON.stringify(manifest.migrations))throw new Error('Recovery migration registry mismatch');
 return db;
 }catch(e){await db.close();throw e;}
}
