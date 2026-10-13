import {existsSync} from "node:fs";

// Only a publishable key is needed. Never print keys or response bodies.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
async function main() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key || !key.startsWith("sb_publishable_")) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL and a modern publishable key.");
 }
 const base=new URL(url);
 if (base.protocol!=="https:" || base.hostname!=="vfplbkfxipfictuwkkoe.supabase.co") {
  throw new Error("Use the HTTPS URL of the independent Supabase development project.");
 }
 const headers={apikey:key};
 const settings=await fetch(new URL("/auth/v1/settings",base),{headers,signal:AbortSignal.timeout(15000)});
 if (!settings.ok) throw new Error(`Auth settings unavailable: HTTP ${settings.status}`);
 const auth=await settings.json() as {disable_signup?:boolean;external?:{anonymous_users?:boolean}};
 let failed=false;
 for (const table of ["organizations","organization_members","clients","assessments","organization_branding"]) {
  const response=await fetch(new URL(`/rest/v1/${table}?select=*&limit=0`,base),{headers,signal:AbortSignal.timeout(15000)});
  // Inspect the error code too: a missing table must not count as access denial.
  const error=await response.json() as {code?:string};
  const denied=[401,403].includes(response.status)&&error.code==="42501";
  console.log(`${denied?"PASS":"FAIL"}: anonymous ${table}, HTTP ${response.status}`);
  if (!denied) failed=true;
 }
 // Public email signup remains enabled by the owner; no membership is granted automatically.
 const closed=auth.external?.anonymous_users===false;
 console.log(`${closed?"PASS":"FAIL"}: public email signup enabled=${auth.disable_signup===false} (owner preference), anonymous sign-in disabled=${auth.external?.anonymous_users===false}`);
 if (!closed) failed=true;
 if (failed) throw new Error("Cloud checks failed. Review Auth settings and Data API permissions; no users were created.");
 console.log("PASS: public API checks. Authenticated A/B sessions still require separate integration tests.");
}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Cloud check failed");process.exitCode=1;});
