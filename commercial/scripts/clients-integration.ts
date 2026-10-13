import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import {literalSearch,CLIENT_PAGE_SIZE} from "../lib/clients";
process.loadEnvFile(".env.local");process.loadEnvFile(".env.admin.local");process.loadEnvFile(".aura-integration/accounts.env");
const boundedFetch:typeof fetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)});
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
 assert.equal(url,"https://vfplbkfxipfictuwkkoe.supabase.co");assert.ok(key?.startsWith("sb_publishable_"));assert.ok(secret?.startsWith("sb_secret_"));
 const fixture=JSON.parse(await readFile(".aura-integration/fixture.json","utf8"));assert.equal(fixture.project,new URL(url!).hostname);
 const admin=createClient(url!,secret!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch}}),clients:SupabaseClient[]=[],users:string[]=[];
 const marker=`AURA-${randomUUID()}`;
 const rows=Array.from({length:120},(_,i)=>({id:randomUUID(),organization_id:fixture.oa,full_name:`${marker} Page ${String(i).padStart(3,"0")}`}));
 const special={id:randomUUID(),organization_id:fixture.oa,full_name:`${marker} 50%_`};
 const foreign={id:randomUUID(),organization_id:fixture.ob,full_name:`${marker} Foreign`};
 const denied=(r:{error:{code?:string}|null},code="42501")=>assert.equal(r.error?.code,code);
 try{
 for(const role of ["OWNER_A","ADMIN_B","COACH_A","UNASSIGNED"]){const db:SupabaseClient=createClient(url!,key!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch}});clients.push(db);const r=await db.auth.signInWithPassword({email:process.env[`AURA_TEST_${role}_EMAIL`]!,password:process.env[`AURA_TEST_${role}_PASSWORD`]!});assert.equal(r.error,null);assert.ok(r.data.user);users.push(r.data.user.id);}
 assert.deepEqual(users,fixture.users);const [owner,adminB,coach,unassigned]=clients;
 assert.equal((await owner.from("clients").insert([...rows,special])).error,null);assert.equal((await adminB.from("clients").insert(foreign)).error,null);
 const found=new Set<string>();for(let page=0;page<5;page++){
 const r=await owner.from("clients").select("id",{count:"exact"}).eq("organization_id",fixture.oa).ilike("full_name",`%${literalSearch(marker+" Page")}%`).order("full_name").order("id").range(page*CLIENT_PAGE_SIZE,(page+1)*CLIENT_PAGE_SIZE-1);
 assert.equal(r.error,null);assert.equal(r.count,120);assert.equal(r.data?.length,page===4?20:25);for(const c of r.data!){assert.ok(!found.has(c.id));found.add(c.id);}}
 assert.equal(found.size,120);console.log("PASS: five pages cover all 120 matching clients without duplicates.");
 const literal=await owner.from("clients").select("id").eq("organization_id",fixture.oa).ilike("full_name",`%${literalSearch(special.full_name)}%`);assert.equal(literal.error,null);assert.deepEqual(literal.data?.map(r=>r.id),[special.id]);
 const target=rows[0].id;const change=(db:SupabaseClient,id:string,org:string,name:string,archived:boolean,revision:number)=>db.rpc("aura_client_change",{p_org:org,p_client:id,p_name:name,p_archived:archived,p_revision:revision});
 const race=await Promise.all([change(owner,target,fixture.oa,marker+" First",false,1),change(coach,target,fixture.oa,marker+" Second",false,1)]);
 console.log("Concurrent write response codes:",JSON.stringify(race.map(r=>({status:r.status,code:r.error?.code,message:r.error?.message?.slice(0,160)}))));assert.equal(race.filter(r=>!r.error).length,1,"Exactly one concurrent edit must succeed");assert.equal(race.filter(r=>r.error?.code==="PT409").length,1);
 const record=await owner.from("clients").select("full_name,revision").eq("id",target).single();assert.equal(record.error,null);assert.equal(record.data?.revision,2);const name=record.data!.full_name;
 denied(await change(coach,target,fixture.oa,name,true,2));denied(await change(adminB,target,fixture.oa,name,true,2));denied(await change(unassigned,target,fixture.oa,name,false,2));
 assert.equal((await owner.from("assessments").insert({organization_id:fixture.oa,client_id:target,recorded_by:users[0],weight_kg:80})).error,null);
 assert.equal((await change(owner,target,fixture.oa,name,true,2)).error,null);
 denied(await owner.from("assessments").insert({organization_id:fixture.oa,client_id:target,recorded_by:users[0],weight_kg:81}),"23514");
 denied(await adminB.from("assessments").insert({organization_id:fixture.oa,client_id:target,recorded_by:users[1],weight_kg:81}));
 const preserved=await owner.from("assessments").select("id",{count:"exact"}).eq("organization_id",fixture.oa).eq("client_id",target);assert.equal(preserved.error,null);assert.equal(preserved.count,1);
 const active=await owner.from("clients").select("id").eq("id",target).is("archived_at",null);assert.equal(active.data?.length,0);
 assert.equal((await change(owner,target,fixture.oa,name,false,3)).error,null);
 assert.equal((await owner.from("assessments").insert({organization_id:fixture.oa,client_id:target,recorded_by:users[0],weight_kg:81})).error,null);
 assert.equal((await change(adminB,foreign.id,fixture.ob,foreign.full_name,true,1)).error,null);assert.equal((await change(adminB,foreign.id,fixture.ob,foreign.full_name,false,2)).error,null);
 const history=await owner.rpc("aura_client_history",{p_org:fixture.oa,p_client:target,p_offset:0});assert.equal(history.error,null);assert.deepEqual(history.data.map((e:any)=>e.action).sort(),["created","name_changed","archived","reactivated"].sort());assert.ok(history.data.every((e:any)=>!("full_name" in e)&&!("weight_kg" in e)));
 denied(await adminB.rpc("aura_client_history",{p_org:fixture.oa,p_client:target,p_offset:0}));
 denied(await owner.from("clients").update({full_name:"Bypass"}).eq("id",target));
 console.log("PASS: 120 clients over five pages, literal wildcard search, concurrent version conflict, coach/tenant denials, archive/reactivate, preserved assessments and private audit history.");
 }finally{
 let failed=false;
 for(const [org,ids] of [[fixture.oa,[...rows.map(r=>r.id),special.id]],[fixture.ob,[foreign.id]]] as [string,string[]][]){
 const r=await admin.from("clients").delete().eq("organization_id",org).in("id",ids);if(r.error)failed=true;
 const remaining=await admin.from("clients").select("id").eq("organization_id",org).in("id",ids);if(remaining.error||remaining.data?.length)failed=true;
 }
 for(const db of clients){if((await db.auth.signOut()).error)failed=true;}
 if(failed)throw new Error("Synthetic cleanup/sign-out incomplete; inspect the fixture UUIDs.");
 console.log("PASS: all 122 generated clients, their assessments and audit records removed by scoped cleanup; original demo data untouched.");
 }
}
void main().catch(e=>{console.error(e instanceof Error?e.message:"Client integration failed");process.exitCode=1;});
