import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {migrationSource} from "../scripts/migration-bundle";

test("migration checksums match the existing cloud registry on Windows and Linux",async()=>{
 const registered:Record<string,string>={
  "schema.sql":"c45dd37d5cbddeaa65ded29d631421d06593fc76014cb38b68128660e8a8b890",
  "002_assessments.sql":"99b9e62c5f558321700b1f1415d9fcd9898093bf3d52b908cc3ec3617816dd96",
  "003_branding.sql":"97dc0225af4f4ca37b0463bf259efec2856646dc4b0ac06da3adf2f99bc683eb",
  "migrations/20261013175333_team_invitations.sql":"27cc9bbd4c6720a013fccb2db2163842a987e605dac910fda0abb73c26fb6e67",
  "migrations/20261013181649_client_management.sql":"d8e23c0c154bf508661db71708335c10d591743085605e53ca3698a5209359be",
  "migrations/20261013201340_client_conflict_response.sql":"12ee866e584bd7dd797ba0befe8cfa06fd5cba6bdd1369d506a494ae505408e6",
 };
 for(const [name,expected] of Object.entries(registered)){
  const lf=(await readFile(new URL("../supabase/"+name,import.meta.url),"utf8")).replace(/\r\n/g,"\n");
  for(const checkout of [lf,lf.replace(/\n/g,"\r\n")]){
   const actual=createHash("sha256").update(migrationSource(name,checkout)).digest("hex");
   assert.equal(actual,expected,name);
  }
 }
});
