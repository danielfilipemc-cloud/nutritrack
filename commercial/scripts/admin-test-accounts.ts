import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {existsSync} from "node:fs";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
const roles=["OWNER_A","ADMIN_B","COACH_A","UNASSIGNED"] as const;
type Record={run:string;project:string;accounts:{id:string;role:string}[]};
async function main(){
 if(existsSync(".env.local"))process.loadEnvFile(".env.local");
 if(existsSync(".env.admin.local"))process.loadEnvFile(".env.admin.local");
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 assert.equal(url,"https://vfplbkfxipfictuwkkoe.supabase.co","Dedicated AURA development project only");
 if(!key?.startsWith("sb_secret_"))throw new Error("Add SUPABASE_SECRET_KEY to ignored .env.admin.local. Do not send it in chat or use NEXT_PUBLIC_.");
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const file=".aura-integration/accounts.json";
 if(process.argv.includes("--cleanup")){
  const f=JSON.parse(await readFile(file,"utf8")) as Record;assert.equal(f.project,url);
  for(const account of f.accounts){
   const {data,error}=await db.auth.admin.getUserById(account.id);
   if(error?.status===404)continue;
   if(error||data.user?.app_metadata.aura_test_run!==f.run)throw new Error("Account identity/fixture marker mismatch; cleanup aborted.");
   const members=await db.from("organization_members").select("user_id").eq("user_id",account.id);
   if(members.error||members.data?.length)throw new Error("Run fixture SQL cleanup before removing Auth users.");
   const assessments=await db.from("assessments").select("id").eq("recorded_by",account.id).limit(1);
   if(assessments.error||assessments.data?.length)throw new Error("Synthetic assessments still reference this account; cleanup aborted.");
   const removed=await db.auth.admin.deleteUser(account.id);if(removed.error)throw new Error("Admin account deletion failed; keep the local manifest for retry.");
  }
  console.log("Dedicated fixture accounts removed. Local manifests/credentials retained for review; remove them before another run.");return;
 }
 if(existsSync(file)||existsSync(".aura-integration/accounts.env")||existsSync(".aura-integration/fixture.json"))throw new Error("Existing fixture files: review/clean previous run before creating accounts.");
 await mkdir(".aura-integration",{recursive:true});
 const f:Record={run:randomUUID(),project:url,accounts:[]};
 const credentials:string[]=[];
 await writeFile(file,JSON.stringify(f,null,2),{mode:0o600,flag:"wx"});
 for(const role of roles){
  const email=`${role.toLowerCase().replaceAll("_","-")}+${f.run}@aura.example`;
  const password=randomBytes(32).toString("base64url");
  const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{aura_test_run:f.run,synthetic:true}});
  if(error||!data.user)throw new Error(`Admin creation failed for ${role}. Keep the manifest for cleanup; no credentials logged.`);
  f.accounts.push({id:data.user.id,role});await writeFile(file,JSON.stringify(f,null,2),{mode:0o600});
  credentials.push(`AURA_TEST_${role}_EMAIL=${email}`,`AURA_TEST_${role}_PASSWORD=${password}`);
  await writeFile(".aura-integration/accounts.env",credentials.join("\n")+"\n",{mode:0o600});
 }
 console.log("Four confirmed synthetic accounts created without invitation emails. Credentials are only in ignored .aura-integration/accounts.env. Run test:auth:prepare next.");
}
void main().catch(e=>{console.error(e instanceof Error?e.message:"Admin provisioning failed");process.exitCode=1;});
