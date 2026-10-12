import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
export async function migrationBundle(){
 let sql=`begin;
create schema if not exists app_private;
revoke all on schema app_private from public,anon;
create table if not exists app_private.aura_migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now());
revoke all on app_private.aura_migrations from public,anon,authenticated;
`;
 for(const name of ["schema.sql","002_assessments.sql","003_branding.sql"]){
 const body=await readFile(new URL("../supabase/"+name,import.meta.url),"utf8");const hash=createHash("sha256").update(body).digest("hex");
 sql+=`do $migration$ begin
if exists(select 1 from app_private.aura_migrations where name='${name}' and checksum<>'${hash}') then raise exception 'Migration checksum mismatch: ${name}'; end if;
if not exists(select 1 from app_private.aura_migrations where name='${name}') then
${body}
insert into app_private.aura_migrations(name,checksum) values ('${name}','${hash}');
end if; end $migration$;
`;
 }return sql+"commit;\n";
}
if(process.argv.includes("--write")){void (async()=>{await writeFile(new URL("../supabase/install.generated.sql",import.meta.url),await migrationBundle());console.log("Generated transactional SQL for a NEW independent project only.");})().catch(error=>{console.error(error);process.exitCode=1;});}
