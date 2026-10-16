import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {migrationBundle} from './migration-bundle';
const directory=new URL('../.aura-integration/cloud-recovery/',import.meta.url);
// Produces a private restore artifact only. The separate shell guard fixes the
// destination to a fresh fourth local runtime and never accepts a cloud URL.
async function main(){
 const bytes=await readFile(new URL('approved-synthetic.private.json',directory));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),(await readFile(new URL('approved-synthetic.private.json.sha256',directory),'utf8')).trim());
 const backup=JSON.parse(bytes.toString('utf8'));assert.equal(backup.project_ref,'vgbwmamntjmhzrpvhxzb');assert.equal(backup.scope,'approved-synthetic-cloud-recovery');assert.equal(backup.version,1);
 const tables:Record<string,Record<string,unknown>[]>=backup.tables;
 const order=['auth.users','auth.identities','public.organizations','public.organization_members','public.clients','public.organization_branding','public.staff_capabilities','public.client_assignments','public.client_users','public.nutritrack_links','public.assessments','public.client_followups','public.appointments','public.client_objectives',...Object.keys(tables).filter(name=>name.startsWith('app_private.')).sort()];
 assert.equal(new Set(order).size,Object.keys(tables).length);assert.ok(Object.keys(tables).every(name=>order.includes(name)&&/^(auth|public|app_private)\.[a-z_]+$/.test(name)));
 for(const user of tables['auth.users']){assert.equal((user.raw_app_meta_data as any)?.synthetic,true);assert.ok(String(user.email).endsWith('@example.invalid'));}
 const bundle=await migrationBundle();const expected=[...bundle.matchAll(/insert into app_private\.aura_migrations\(name,checksum\) values \('([^']+)','([a-f0-9]+)'\)/g)].map(m=>({name:m[1],checksum:m[2]})).sort((a,b)=>a.name.localeCompare(b.name));
 const actual=tables['app_private.aura_migrations'].map(r=>({name:r.name,checksum:r.checksum})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));assert.deepEqual(actual,expected);
 let sql=`do $$ declare r record;used boolean;begin if exists(select 1 from auth.users) then raise exception 'Empty recovery destination required';end if;for r in select schemaname,tablename from pg_tables where schemaname in ('public','app_private') and tablename<>'aura_migrations' loop execute format('select exists(select 1 from %I.%I)',r.schemaname,r.tablename) into used;if used then raise exception 'Recovery destination contains application data';end if;end loop;end;$$;\n`+bundle+'\nbegin;\n';
 for(const name of order){
  const [schema,table]=name.split('.');
  const rows=name==='auth.users'?tables[name].map(row=>({...row,confirmation_token:'',recovery_token:'',email_change_token_new:'',email_change_token_current:'',phone_change_token:'',reauthentication_token:''})):tables[name];
  const json=JSON.stringify(rows);let tag;do{tag='$restore_'+randomUUID().replaceAll('-','')+'$';}while(json.includes(tag));
  const conflict=name==='app_private.aura_migrations'?' on conflict(name) do update set checksum=excluded.checksum,applied_at=excluded.applied_at':'';
  sql+=(schema==='auth'?'':`alter table ${name} disable trigger user;\n`)+`do ${tag} declare cols text;begin\nselect string_agg(quote_ident(attname),',' order by attnum) into cols from pg_attribute where attrelid='${name}'::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity='';\nexecute format('insert into ${schema}.${table} (%s) select %s from jsonb_populate_recordset(null::${schema}.${table},$1)${conflict}',cols,cols) using '${json.replaceAll("'","''")}'::jsonb;end;${tag};\n`+(schema==='auth'?'':`alter table ${name} enable trigger user;\n`);
 }
 sql+="commit;\nnotify pgrst,'reload schema';\n";
 await writeFile(new URL('restore.generated.private.sql',directory),sql,{mode:0o600});
 // Compare only source fields, allowing additional provider columns locally.
 let verify='select jsonb_build_object(';
 verify+=order.map(name=>`'${name}',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from ${name} t)`).join(',');verify+=') as restored;\n';
 await writeFile(new URL('verify.generated.private.sql',directory),verify,{mode:0o600});
 console.log('PASS: authorized synthetic archive integrity and canonical migrations checked; private restore SQL prepared');
}
void main().catch(()=>{console.error('Recovery preparation refused; private rows and credentials omitted');process.exitCode=1;});
