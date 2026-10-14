import {test} from "node:test";
import assert from "node:assert/strict";
import {baselineMigrationBundle as migrationBundle} from "./baseline";
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
test("cloud SQL harness runs and rolls back every fixture",async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec((await migrationBundle()).replace("create extension if not exists pgcrypto;",""));
  await db.exec(await readFile(new URL("./cloud-rls.sql",import.meta.url),"utf8"));
  for(const table of ["auth.users","public.organizations","public.clients","public.assessments","public.organization_branding"]){
   assert.equal((await db.query<{n:number}>(`select count(*)::int n from ${table}`)).rows[0].n,0);
  }
 } finally {await db.close();}
});
test("real PostgreSQL RLS: tenants, roles, foreign keys and forbidden writes",async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 const sql=(await migrationBundle()).replace("create extension if not exists pgcrypto;","");
 await db.exec(sql);await db.exec(sql); // Recorded migrations must safely skip on replay.
 assert.equal(Number((await db.query<{n:number}>("select count(*)::int n from app_private.aura_migrations")).rows[0].n),8);
 const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
 await db.exec(`insert into auth.users(id) values ('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}'); insert into organizations(id,name) values ('${id(10)}','Studio A'),('${id(20)}','Studio B'); insert into organization_members(organization_id,user_id,role) values ('${id(10)}','${id(1)}','owner'),('${id(20)}','${id(2)}','admin'),('${id(10)}','${id(3)}','coach'); insert into clients(id,organization_id,full_name) values ('${id(100)}','${id(10)}','Aluno A'),('${id(200)}','${id(20)}','Aluno B');`);
 const asUser=async(n:number)=>{await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id(n)}',false)`);};
 const count=async(table:string)=>Number((await db.query<{n:number}>(`select count(*)::int n from ${table}`)).rows[0].n);
 const denied=async(sql:string)=>{await assert.rejects(db.exec(sql));};
 for(const [user,org,other,client] of [[1,10,20,200],[2,20,10,100]]) {
 await asUser(user);assert.equal(await count('organizations'),1);assert.equal(await count('clients'),1);assert.equal(await count('organization_members'),1);
 await db.exec(`insert into clients(organization_id,full_name) values ('${id(org)}','Novo aluno')`);
 await denied(`insert into clients(organization_id,full_name) values ('${id(other)}','Intruso')`);
 await denied(`insert into assessments(organization_id,client_id,recorded_by,weight_kg) values ('${id(org)}','${id(client)}','${id(user)}',80)`);
 await denied(`insert into assessments(organization_id,client_id,recorded_by,weight_kg) values ('${id(other)}','${id(client)}','${id(user)}',80)`);
 await db.exec(`insert into organization_branding(organization_id,display_name,updated_by) values ('${id(org)}','Marca própria','${id(user)}')`);
 assert.equal(await count('organization_branding'),1);
 await denied(`insert into organization_members values ('${id(other)}','${id(user)}','owner',now())`);
 }
 await asUser(1);await db.exec(`insert into assessments(organization_id,client_id,recorded_by,weight_kg) values ('${id(10)}','${id(100)}','${id(1)}',80)`);
 await denied(`insert into assessments(organization_id,client_id,recorded_by,weight_kg) values ('${id(10)}','${id(100)}','${id(2)}',80)`);
 await denied(`delete from assessments`);await denied(`update assessments set weight_kg=90`);
 await asUser(2);assert.equal(await count('assessments'),0);
 await asUser(3);assert.equal(await count('assessments'),1);assert.equal((await db.query(`update organization_branding set display_name='Hack' returning *`)).rows.length,0);
 await denied(`insert into organization_branding(organization_id,display_name,updated_by) values ('${id(20)}','Hack','${id(3)}')`);
 await asUser(4);for(const t of ['organizations','clients','assessments','organization_branding','organization_members'])assert.equal(await count(t),0);
 await denied(`insert into clients(organization_id,full_name) values ('${id(10)}','Intruso')`);
 await db.exec('reset role; set role anon');for(const t of ['organizations','clients','assessments','organization_branding','organization_members'])await denied(`select * from ${t}`);
 await db.exec("reset role; update app_private.aura_migrations set checksum='tampered' where name='schema.sql'");
 await assert.rejects(db.exec(sql),/checksum mismatch/);await db.exec("rollback");
 } finally {await db.close();}
});

import {supabaseRlsSql} from "../scripts/supabase-rls-sql";
test("cloud SQL harness asserts access and rolls back all synthetic fixtures",async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,aud text,role text,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec((await migrationBundle()).replace("create extension if not exists pgcrypto;",""));
 const results=await db.exec(supabaseRlsSql());const result=results[results.length-1].rows[0] as {result:string;assertions:number};assert.equal(result.result,"PASS");assert.ok(result.assertions>40);
 const count=await db.query<{n:number}>("select count(*)::int n from auth.users");assert.equal(count.rows[0].n,0);
 }finally{await db.close();}
});
