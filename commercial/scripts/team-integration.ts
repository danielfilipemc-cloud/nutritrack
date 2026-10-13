import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
process.loadEnvFile(".env.local");process.loadEnvFile(".aura-integration/accounts.env");
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 assert.equal(url,"https://vfplbkfxipfictuwkkoe.supabase.co");assert.ok(key?.startsWith("sb_publishable_"));
 const fixture=JSON.parse(await readFile(".aura-integration/fixture.json","utf8"));assert.equal(fixture.project,new URL(url!).hostname);
 const clients:SupabaseClient[]=[],ids:string[]=[],invites:{id:string;org:string;index:number}[]=[];let accepted=false;
 const roles=["OWNER_A","ADMIN_B","COACH_A","UNASSIGNED"];
 const denied=(r:{error:{code?:string}|null})=>assert.equal(r.error?.code,"42501");
 try{
 for(const role of roles){const db:SupabaseClient=createClient(url!,key!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});clients.push(db);
 const {data,error}=await db.auth.signInWithPassword({email:process.env[`AURA_TEST_${role}_EMAIL`]!,password:process.env[`AURA_TEST_${role}_PASSWORD`]!});assert.equal(error,null);assert.ok(data.user);ids.push(data.user.id);}
 assert.deepEqual(ids,fixture.users);
 const [owner,admin,coach,user]=clients;
 const roster=await owner.rpc("aura_team_list",{p_org:fixture.oa});assert.equal(roster.error,null);assert.ok(roster.data.some((r:any)=>r.user_id===ids[0]));
 denied(await owner.rpc("aura_team_list",{p_org:fixture.ob}));denied(await admin.rpc("aura_team_list",{p_org:fixture.oa}));denied(await coach.rpc("aura_team_list",{p_org:fixture.oa}));denied(await user.rpc("aura_team_list",{p_org:fixture.oa}));
 denied(await owner.rpc("aura_team_change",{p_org:fixture.oa,p_user:ids[0],p_role:null}));
 denied(await owner.rpc("aura_team_change",{p_org:fixture.oa,p_user:ids[2],p_role:"owner"}));
 denied(await admin.rpc("aura_invitation_create",{p_org:fixture.ob,p_email:process.env.AURA_TEST_UNASSIGNED_EMAIL,p_role:"admin"}));
 const create=async(index:number,org:string)=>{const r=await clients[index].rpc("aura_invitation_create",{p_org:org,p_email:process.env.AURA_TEST_UNASSIGNED_EMAIL,p_role:"coach"});assert.equal(r.error,null);assert.ok(r.data?.[0]);const row=r.data[0];invites.push({id:row.id,org,index});assert.match(row.token,/^[0-9a-f]{64}$/);return row;};
 const revoked=await create(0,fixture.oa);assert.equal((await owner.rpc("aura_invitation_revoke",{p_org:fixture.oa,p_invite:revoked.id})).error,null);
 denied(await user.rpc("aura_invitation_accept",{p_token:revoked.token}));
 const old=await create(0,fixture.oa);const fresh=await create(0,fixture.oa);
 denied(await user.rpc("aura_invitation_accept",{p_token:old.token}));denied(await coach.rpc("aura_invitation_accept",{p_token:fresh.token}));
 const listed=await owner.rpc("aura_invitation_list",{p_org:fixture.oa});assert.equal(listed.error,null);assert.ok(listed.data.every((r:any)=>!("token" in r)&&!("token_hash" in r)));
 const race=await Promise.all([user.rpc("aura_invitation_accept",{p_token:fresh.token}),user.rpc("aura_invitation_accept",{p_token:fresh.token})]);
 assert.equal(race.filter(r=>!r.error).length,1,"Exactly one concurrent acceptance succeeds");assert.equal(race.filter(r=>r.error?.code==="42501").length,1);accepted=true;
 assert.equal((await owner.rpc("aura_team_change",{p_org:fixture.oa,p_user:ids[3],p_role:"admin"})).error,null);
 assert.equal((await user.rpc("aura_team_list",{p_org:fixture.oa})).error,null);
 assert.equal((await owner.rpc("aura_team_change",{p_org:fixture.oa,p_user:ids[3],p_role:"coach"})).error,null);
 denied(await user.rpc("aura_team_list",{p_org:fixture.oa}));
 assert.equal((await owner.rpc("aura_team_change",{p_org:fixture.oa,p_user:ids[3],p_role:null})).error,null);accepted=false;
 const visible=await user.from("organizations").select("id");assert.equal(visible.error,null);assert.equal(visible.data?.length,0,"Removal is effective with the same JWT");
 const adminInvite=await create(1,fixture.ob);assert.equal((await admin.rpc("aura_invitation_revoke",{p_org:fixture.ob,p_invite:adminInvite.id})).error,null);
 const anonymous=createClient(url!,key!,{auth:{persistSession:false,autoRefreshToken:false}});denied(await anonymous.rpc("aura_team_list",{p_org:fixture.oa}));
 console.log("PASS: real team/invitation API: tenant isolation, role hierarchy, owner protection, wrong email, revoke/resend, private hashes, simultaneous single use and immediate membership revocation.");
 }finally{
 let failed=false;
 if(accepted&&clients[0]){const r=await clients[0].rpc("aura_team_change",{p_org:fixture.oa,p_user:ids[3],p_role:null});if(r.error)failed=true;}
 for(const i of invites){const r=await clients[i.index].rpc("aura_invitation_revoke",{p_org:i.org,p_invite:i.id});if(r.error)failed=true;}
 for(const db of clients){if((await db.auth.signOut()).error)failed=true;}
 if(failed)throw new Error("Synthetic cleanup/sign-out incomplete; inspect fixture before re-running.");
 console.log("PASS: temporary membership removed, pending test invitations revoked and test sessions signed out. Audit history retained.");
 }
}
void main().catch(e=>{console.error(e instanceof Error?e.message:"Team integration failed");process.exitCode=1;});
