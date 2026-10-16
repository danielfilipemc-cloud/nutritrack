import {test} from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {baselineMigrationBundle as migrationBundle} from "./baseline";
import {literalSearch} from "../lib/clients";
test("literal name search escapes wildcards and backslashes",()=>{assert.equal(literalSearch("  50%_\\  "),"50\\%\\_\\\\");});
test("client lifecycle, optimistic writes, audit and assessment preservation",async()=>{
 const db=new PGlite(),id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec((await migrationBundle()).replace("create extension if not exists pgcrypto;",""));
 await db.exec(`insert into auth.users(id) values ('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}');insert into organizations(id,name) values ('${id(10)}','Studio A'),('${id(20)}','Studio B');insert into organization_members(organization_id,user_id,role) values ('${id(10)}','${id(1)}','owner'),('${id(10)}','${id(2)}','coach'),('${id(20)}','${id(3)}','admin');insert into clients(id,organization_id,full_name) values ('${id(100)}','${id(10)}','Original');`);
 const asUser=async(n:number)=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id(n)}',false)`);};
 const denied=async(sql:string,code="42501")=>assert.rejects(db.exec(sql),(e:any)=>e.code===code);
 const change=(name:string,archive:boolean,revision:number)=>`select aura_client_change('${id(10)}','${id(100)}','${name}',${archive},${revision})`;
 await asUser(2);await db.exec(change('  Renamed  ',false,1));
 await denied(change('Lost overwrite',false,1),'PT409');await denied(change('x',false,2),'22023');await denied(change('Renamed',true,2));
 await denied(`update clients set full_name='Bypass'`);await denied('delete from clients');await denied('select * from app_private.client_events');
 await db.exec(`insert into assessments(organization_id,client_id,recorded_by,weight_kg) values ('${id(10)}','${id(100)}','${id(2)}',80)`);
 await asUser(1);await db.exec(change('Renamed',true,2));
 assert.equal((await db.query<{n:number}>("select count(*)::int n from assessments")).rows[0].n,1);
 await denied(`insert into assessments(organization_id,client_id,recorded_by,weight_kg) values ('${id(10)}','${id(100)}','${id(1)}',81)`,'23514');
 await db.exec(change('Renamed',false,3));await db.exec(`insert into assessments(organization_id,client_id,recorded_by,weight_kg) values ('${id(10)}','${id(100)}','${id(1)}',81)`);
 const history=await db.query<{action:string;actor_id:string}>(`select * from aura_client_history('${id(10)}','${id(100)}',0)`);
 assert.deepEqual(history.rows.map(r=>r.action).sort(),['created','name_changed','archived','reactivated'].sort());assert.ok(history.rows.some(r=>r.action==='name_changed'&&r.actor_id===id(2)));
 const version=await db.query<{revision:number;full_name:string}>("select revision,full_name from clients");assert.equal(Number(version.rows[0].revision),4);assert.equal(version.rows[0].full_name,'Renamed');
 await db.exec(`insert into clients(organization_id,full_name,archived_at,revision) values ('${id(10)}','Injected archive',now(),99)`);
 assert.equal((await db.query<{revision:number;archived_at:null}>("select revision,archived_at from clients where full_name='Injected archive'")).rows[0].archived_at,null);
 await asUser(3);await denied(change('Foreign',false,4));await denied(`select * from aura_client_history('${id(10)}','${id(100)}',0)`);
 // State of a foreign archived client is never exposed by the assessment trigger.
 await denied(`insert into assessments(organization_id,client_id,recorded_by,weight_kg) values ('${id(10)}','${id(100)}','${id(3)}',80)`);
 await asUser(4);await denied(change('Unassigned',false,4));
 await db.exec('reset role;set role anon');await denied(change('Anonymous',false,4));
 }finally{await db.close();}
});
