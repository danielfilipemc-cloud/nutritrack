import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {existsSync} from "node:fs";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";

// Four confirmed, dedicated synthetic accounts must be created in trusted Auth Admin UI.
// No service-role/secret key, public signup or direct writes to auth.users.
type Fixture={project:string;oa:string;ob:string;ca:string;cb:string;users:string[]};
const roles=["OWNER_A","ADMIN_B","COACH_A","UNASSIGNED"] as const;
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key?.startsWith("sb_publishable_"))throw new Error("Configure the development URL and publishable key.");
 assert.equal(new URL(url).hostname,"vfplbkfxipfictuwkkoe.supabase.co","Only the approved AURA development project is supported");
 const clients:SupabaseClient[]=[];
 const users:string[]=[];
 try{
  for(const role of roles){
   const email=process.env[`AURA_TEST_${role}_EMAIL`],password=process.env[`AURA_TEST_${role}_PASSWORD`];
   if(!email||!password)throw new Error(`Missing AURA_TEST_${role}_EMAIL/PASSWORD in ignored .env.local; never send credentials in chat.`);
   const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   clients.push(db);
   const {data,error}=await db.auth.signInWithPassword({email,password});
   if(error||!data.user)throw new Error(`Cannot sign in as ${role}; use a confirmed synthetic account.`);
   users.push(data.user.id);
  }
  assert.equal(new Set(users).size,4,"Four independent users are required");
  if(process.argv.includes("--prepare")){
   for(const db of clients){const {data,error}=await db.from("organization_members").select("organization_id");assert.equal(error,null);assert.equal(data?.length,0,"Dedicated accounts must have no existing memberships");}
   if(existsSync(".aura-integration/fixture.json"))throw new Error("Existing fixture: run tests/cleanup before preparing again.");
   const f:Fixture={project:new URL(url).hostname,oa:randomUUID(),ob:randomUUID(),ca:randomUUID(),cb:randomUUID(),users};
   // Values below are validated UUIDs, never emails, passwords or JWTs.
   for(const id of [f.oa,f.ob,f.ca,f.cb,...users])assert.match(id,/^[0-9a-f-]{36}$/i);
   const sql=`begin;\ninsert into public.organizations(id,name) values ('${f.oa}','AURA synthetic A'),('${f.ob}','AURA synthetic B');\ninsert into public.organization_members(organization_id,user_id,role) values ('${f.oa}','${users[0]}','owner'),('${f.ob}','${users[1]}','admin'),('${f.oa}','${users[2]}','coach');\ninsert into public.clients(id,organization_id,full_name) values ('${f.ca}','${f.oa}','Synthetic A'),('${f.cb}','${f.ob}','Synthetic B');\ncommit;\n`;
   await mkdir(".aura-integration",{recursive:true});
   await writeFile(".aura-integration/fixture.json",JSON.stringify(f,null,2));
   await writeFile(".aura-integration/provision.sql",sql);
   await writeFile(".aura-integration/cleanup.sql",`begin;\ndelete from public.organizations where id in ('${f.oa}','${f.ob}');\ncommit;\n`);
   console.log("Prepared ignored .aura-integration/provision.sql and cleanup.sql. Execute provision.sql via trusted SQL Editor, then npm run test:auth. No credentials were saved.");
   return;
  }
  const f=JSON.parse(await readFile(".aura-integration/fixture.json","utf8")) as Fixture;
  assert.equal(f.project,new URL(url).hostname);assert.deepEqual(f.users,users,"Use the same four accounts as preparation");
  const tables=["organizations","organization_members","clients","assessments","organization_branding"];
  const denied=(error:{code?:string}|null,code="42501")=>assert.equal(error?.code,code,"Expected database access/constraint denial");
  for(const [i,org,other,client,foreignClient] of [[0,f.oa,f.ob,f.ca,f.cb],[1,f.ob,f.oa,f.cb,f.ca]] as const){
   const db=clients[i];
   const own=await db.from("organizations").select("id").eq("id",org);assert.equal(own.error,null);assert.equal(own.data?.length,1);
   for(const table of tables){const r=await db.from(table).select("*").eq(table==="organizations"?"id":"organization_id",other);assert.equal(r.error,null);assert.equal(r.data?.length,0,`${roles[i]} cannot read foreign ${table}`);}
   const added=await db.from("clients").insert({organization_id:org,full_name:"Synthetic API client"}).select("id");assert.equal(added.error,null);assert.equal(added.data?.length,1);
   denied((await db.from("clients").insert({organization_id:other,full_name:"Synthetic forbidden"})).error);
   const assessment={organization_id:org,client_id:client,recorded_by:users[i],weight_kg:80};
   assert.equal((await db.from("assessments").insert(assessment)).error,null);
   denied((await db.from("assessments").insert({...assessment,client_id:foreignClient})).error,"23503");
   denied((await db.from("assessments").insert({...assessment,organization_id:other,client_id:foreignClient})).error);
   denied((await db.from("assessments").insert({...assessment,recorded_by:users[2]})).error);
   denied((await db.from("assessments").update({weight_kg:90}).eq("organization_id",org)).error);
   denied((await db.from("assessments").delete().eq("organization_id",org)).error);
   assert.equal((await db.from("organization_branding").upsert({organization_id:org,display_name:"Synthetic API brand",updated_by:users[i]})).error,null);
   const foreign=await db.from("organization_branding").update({display_name:"Forbidden",updated_by:users[i]}).eq("organization_id",other).select("organization_id");assert.equal(foreign.error,null);assert.equal(foreign.data?.length,0);
   denied((await db.from("organization_branding").upsert({organization_id:other,display_name:"Forbidden",updated_by:users[i]})).error);
   denied((await db.from("organization_members").insert({organization_id:other,user_id:users[i],role:"owner"})).error);
   console.log(`PASS: ${roles[i]} reads/writes own tenant; foreign reads/writes, author spoofing and assessment edits denied`);
  }
  const coach=clients[2];
  const read=await coach.from("organization_branding").select("organization_id").eq("organization_id",f.oa);assert.equal(read.error,null);assert.equal(read.data?.length,1);
  const edit=await coach.from("organization_branding").update({display_name:"Forbidden",updated_by:users[2]}).eq("organization_id",f.oa).select("organization_id");assert.equal(edit.error,null);assert.equal(edit.data?.length,0);
  denied((await coach.from("organization_branding").upsert({organization_id:f.oa,display_name:"Forbidden",updated_by:users[2]})).error);
  for(const table of tables){const r=await clients[3].from(table).select("*");assert.equal(r.error,null);assert.equal(r.data?.length,0,`Unassigned cannot read ${table}`);}
  denied((await clients[3].from("clients").insert({organization_id:f.oa,full_name:"Forbidden"})).error);
  denied((await clients[3].from("assessments").insert({organization_id:f.oa,client_id:f.ca,recorded_by:users[3],weight_kg:80})).error);
  denied((await clients[3].from("organization_branding").upsert({organization_id:f.oa,display_name:"Forbidden",updated_by:users[3]})).error);
  console.log("PASS: real Auth/PostgREST tenant and role checks. Execute ignored cleanup.sql as administrator, verify removal, then remove .aura-integration; delete dedicated Auth accounts via trusted administration.");
 }finally{
  await Promise.all(clients.map(async db=>{const {error}=await db.auth.signOut();if(error)console.error("Session sign-out failed; revoke the test user's sessions via Auth Admin.");}));
 }
}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Auth integration failed");process.exitCode=1;});
