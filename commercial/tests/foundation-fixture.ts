import {PGlite} from '@electric-sql/pglite';
import {migrationBundle} from '../scripts/migration-bundle';
export const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
export async function foundationFixture(through?:string){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec((await migrationBundle({through})).replace('create extension if not exists pgcrypto;',''));
 await db.exec(`insert into auth.users values
 ('${id(1)}','owner@example.invalid',now()),('${id(2)}','coach@example.invalid',now()),('${id(3)}','admin@example.invalid',now()),
 ('${id(4)}','student@example.invalid',now()),('${id(5)}','foreign@example.invalid',now()),('${id(6)}','unconfirmed@example.invalid',null),
 ('${id(7)}','otherstaff@example.invalid',now()),('${id(8)}','secondstudent@example.invalid',now());
 insert into organizations(id,name) values('${id(10)}','Synthetic A'),('${id(20)}','Synthetic B');
 insert into organization_members(organization_id,user_id,role) values('${id(10)}','${id(1)}','owner'),('${id(10)}','${id(2)}','coach'),('${id(10)}','${id(3)}','admin'),('${id(10)}','${id(7)}','coach'),('${id(20)}','${id(5)}','owner');
 insert into clients(id,organization_id,full_name) values('${id(100)}','${id(10)}','Synthetic pupil A'),('${id(101)}','${id(10)}','Synthetic pupil A2'),('${id(200)}','${id(20)}','Synthetic pupil B');`);
 const asUser=async(n:number)=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id(n)}',false)`);
 const grant=async(user:number,client:number,modules=['profile','assessments','followup','schedule'])=>{
  await asUser(1);
  for(const m of modules)await db.query(`select aura_capability_save('${id(10)}','${id(user)}','${m}',true,true)`);
  await db.query(`select aura_assignment_save('${id(10)}','${id(client)}','${id(user)}',true)`);
 };
 return {db,asUser,grant};
}
