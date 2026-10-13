import {test} from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {migrationBundle} from "../scripts/migration-bundle";
import type {Dashboard} from "../lib/dashboard";

test("dashboard aggregates all rows, handles date boundaries and enforces tenant access",async()=>{
 const db=new PGlite(),id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec((await migrationBundle()).replace("create extension if not exists pgcrypto;",""));
 await db.exec(`insert into auth.users(id) values ('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}');insert into organizations(id,name) values ('${id(10)}','Studio A'),('${id(20)}','Studio B'),('${id(30)}','Empty');insert into organization_members(organization_id,user_id,role) values ('${id(30)}','${id(1)}','owner'),('${id(10)}','${id(1)}','owner'),('${id(10)}','${id(2)}','coach'),('${id(20)}','${id(3)}','admin');
 insert into clients(id,organization_id,full_name) values ('${id(100)}','${id(10)}','Recent'),('${id(101)}','${id(10)}','Boundary'),('${id(102)}','${id(10)}','Overdue'),('${id(103)}','${id(10)}','Archived'),('${id(200)}','${id(20)}','Foreign');
 insert into assessments(organization_id,client_id,recorded_by,assessed_on,weight_kg) values
 ('${id(10)}','${id(100)}','${id(1)}',current_date,80),('${id(10)}','${id(101)}','${id(1)}',current_date-30,80),('${id(10)}','${id(102)}','${id(1)}',current_date-31,80),('${id(10)}','${id(103)}','${id(1)}',current_date-29,80),('${id(10)}','${id(102)}','${id(1)}',current_date+1,80),('${id(20)}','${id(200)}','${id(3)}',current_date,80);
 update clients set archived_at=now() where id='${id(103)}';
 insert into clients(organization_id,full_name) select '${id(10)}','Pending '||n from generate_series(1,1100) n;`);
 const asUser=async(n:number)=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id(n)}',false)`);};
 const dashboard=async(org:number)=>(await db.query<{data:Dashboard}>(`select aura_dashboard('${id(org)}') data`)).rows[0].data;
 await asUser(1);const empty=await dashboard(30);assert.equal(empty.active_clients,0);assert.equal(empty.pending_clients,0);assert.deepEqual(empty.recent,[]);assert.deepEqual(empty.pending,[]);const summary=await dashboard(10);
 assert.equal(summary.active_clients,1103);assert.equal(summary.archived_clients,1);
 assert.equal(summary.assessments_30_days,2);assert.equal(summary.pending_clients,1101);
 assert.equal(summary.pending.length,10);assert.equal(summary.recent.length,2);
 assert.ok(!JSON.stringify(summary).includes('Foreign'));assert.ok(!JSON.stringify(summary).includes('weight_kg'));
 assert.ok(summary.recent.some(c=>c.archived_at!==null));
 await asUser(2);assert.deepEqual(await dashboard(10),summary);
 await assert.rejects(dashboard(20),(e:any)=>e.code==='42501');
 await asUser(3);assert.equal((await dashboard(20)).active_clients,1);
 await assert.rejects(dashboard(10),(e:any)=>e.code==='42501');
 await db.exec(`reset role;delete from organization_members where organization_id='${id(10)}' and user_id='${id(2)}'`);await asUser(2);await assert.rejects(dashboard(10),(e:any)=>e.code==='42501');
 await asUser(4);await assert.rejects(dashboard(10),(e:any)=>e.code==='42501');
 await db.exec('reset role;set role anon');await assert.rejects(dashboard(10));
 }finally{await db.close();}
});

test("branding server authorship rejects spoofing and organization reassignment",async()=>{
 const db=new PGlite(),id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec((await migrationBundle()).replace("create extension if not exists pgcrypto;",""));
 await db.exec(`insert into auth.users(id) values ('${id(1)}'),('${id(2)}');insert into organizations(id,name) values ('${id(10)}','Studio A'),('${id(20)}','Studio B');insert into organization_members values ('${id(10)}','${id(1)}','owner',now()),('${id(20)}','${id(1)}','owner',now());set role authenticated;select set_config('request.jwt.claim.sub','${id(1)}',false);
 insert into organization_branding(organization_id,display_name,updated_by,updated_at) values ('${id(10)}','Studio A','${id(2)}','2000-01-01');`);
 const row=(await db.query<{updated_by:string;stamp_year:number}>(`select updated_by,extract(year from updated_at)::int as stamp_year from organization_branding`)).rows[0];
 assert.equal(row.updated_by,id(1));assert.ok(row.stamp_year>2000);
 await assert.rejects(db.exec(`update organization_branding set organization_id='${id(20)}'`),(e:any)=>e.code==='42501');
 }finally{await db.close();}
});
