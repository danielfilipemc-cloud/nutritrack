import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrationBundle} from '../scripts/migration-bundle';
import {id} from './foundation-fixture';
import {snapshotLocalDevelopment,restoreLocalDevelopment} from '../scripts/local-recovery';
test('eight-file populated baseline restores before upgrading without rewriting records, hashes or blanket permissions',async()=>{
 let db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec((await migrationBundle({through:'20261013210823_followup_agenda.sql'})).replace('create extension if not exists pgcrypto;',''));
 await db.exec(`insert into auth.users values('${id(1)}','synthetic-owner@example.invalid',now()),('${id(2)}','synthetic-coach@example.invalid',now());
 insert into organizations(id,name) values('${id(10)}','Synthetic populated baseline');
 insert into organization_members(organization_id,user_id,role) values('${id(10)}','${id(1)}','owner'),('${id(10)}','${id(2)}','coach');
 insert into clients(id,organization_id,full_name) values('${id(100)}','${id(10)}','Synthetic preserved pupil');
 insert into assessments(id,organization_id,client_id,recorded_by,assessed_on,weight_kg,note) values('${id(300)}','${id(10)}','${id(100)}','${id(2)}','2026-01-01',80,'Synthetic preserved private note');`);
 const hashes=(await db.query<{name:string;checksum:string}>('select name,checksum from app_private.aura_migrations order by name')).rows;
 const before=(await db.query('select id,organization_id,client_id,recorded_by,assessed_on,weight_kg,note,created_at from assessments')).rows;
 const snapshot=await snapshotLocalDevelopment(db),baseline=db;
 db=await restoreLocalDevelopment(snapshot.bytes,snapshot.manifest);await baseline.close();
 assert.deepEqual((await db.query('select name,checksum from app_private.aura_migrations order by name')).rows,hashes);
 assert.deepEqual((await db.query('select id,organization_id,client_id,recorded_by,assessed_on,weight_kg,note,created_at from assessments')).rows,before);
 await db.exec((await migrationBundle()).replace('create extension if not exists pgcrypto;',''));
 assert.deepEqual((await db.query('select id,organization_id,client_id,recorded_by,assessed_on,weight_kg,note,created_at from assessments')).rows,before);
 for(const h of hashes){assert.deepEqual((await db.query('select name,checksum from app_private.aura_migrations where name=$1',[h.name])).rows[0],h);}
 assert.equal((await db.query('select * from staff_capabilities')).rows.length,0);assert.equal((await db.query('select * from client_assignments')).rows.length,0);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id(2)}',false)`);assert.equal((await db.query('select * from assessments')).rows.length,0);
 await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id(1)}',false);set role authenticated`);
 await db.query(`select aura_capability_save('${id(10)}','${id(2)}','assessments',true,true)`);await db.query(`select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',true)`);
 await db.exec(`select set_config('request.jwt.claim.sub','${id(2)}',false)`);assert.equal((await db.query('select * from assessments')).rows.length,1);
 await db.exec('reset role');
 assert.equal((await db.query<{n:number}>("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r' and not c.relrowsecurity")).rows[0].n,0);
 assert.equal((await db.query<{n:number}>("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'aura_%' and (p.prosecdef or has_function_privilege('anon',p.oid,'EXECUTE'))")).rows[0].n,0);
 }finally{await db.close();}
});
