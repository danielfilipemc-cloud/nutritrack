-- Run as postgres in the isolated AURA development project after installation.
-- Synthetic fixtures exist only in this transaction. No passwords or sessions.
-- An error aborts the transaction; ROLLBACK also removes all test helpers.
begin;
create temporary table aura_fixture as select
 gen_random_uuid() ua, gen_random_uuid() ub, gen_random_uuid() coach,
 gen_random_uuid() unassigned, gen_random_uuid() oa, gen_random_uuid() ob,
 gen_random_uuid() ca, gen_random_uuid() cb;
grant select on aura_fixture to authenticated, anon;
create function pg_temp.aura_assert(ok boolean, label text) returns void
language plpgsql security invoker as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
create function pg_temp.aura_denied(statement text) returns void
language plpgsql security invoker as $$ begin
 begin
  execute statement;
 exception when insufficient_privilege or foreign_key_violation then return;
 end;
 raise exception 'FAIL: forbidden statement succeeded: %', statement;
end $$;
insert into auth.users(id) select ua from aura_fixture union all select ub from aura_fixture
 union all select coach from aura_fixture union all select unassigned from aura_fixture;
insert into public.organizations(id,name) select oa,'Synthetic A' from aura_fixture
 union all select ob,'Synthetic B' from aura_fixture;
insert into public.organization_members(organization_id,user_id,role)
 select oa,ua,'owner' from aura_fixture union all select ob,ub,'admin' from aura_fixture
 union all select oa,coach,'coach' from aura_fixture;
insert into public.clients(id,organization_id,full_name) select ca,oa,'Synthetic A' from aura_fixture
 union all select cb,ob,'Synthetic B' from aura_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',ua::text,true) from aura_fixture;
select pg_temp.aura_assert((select count(*)=1 from organizations),'A sees own organization');
select pg_temp.aura_assert((select count(*)=1 from clients),'A sees own client');
select pg_temp.aura_assert((select count(*)=1 from organization_members),'A sees own membership');
insert into clients(organization_id,full_name) select oa,'Synthetic new A' from aura_fixture;
select pg_temp.aura_denied(format('insert into clients(organization_id,full_name) values (%L,''Intruder'')',ob)) from aura_fixture;
insert into assessments(organization_id,client_id,recorded_by,weight_kg) select oa,ca,ua,80 from aura_fixture;
select pg_temp.aura_denied(format('insert into assessments(organization_id,client_id,recorded_by,weight_kg) values (%L,%L,%L,80)',oa,cb,ua)) from aura_fixture;
select pg_temp.aura_denied(format('insert into assessments(organization_id,client_id,recorded_by,weight_kg) values (%L,%L,%L,80)',ob,cb,ua)) from aura_fixture;
select pg_temp.aura_denied(format('insert into assessments(organization_id,client_id,recorded_by,weight_kg) values (%L,%L,%L,80)',oa,ca,ub)) from aura_fixture;
insert into organization_branding(organization_id,display_name,updated_by) select oa,'Synthetic brand A',ua from aura_fixture;
update organization_branding set display_name='Synthetic owner edit';
select pg_temp.aura_assert((select count(*)=1 from organization_branding where display_name='Synthetic owner edit'),'owner updates own branding');
select pg_temp.aura_denied('delete from assessments');
select pg_temp.aura_denied('update assessments set weight_kg=90');
select pg_temp.aura_denied(format('insert into organization_members(organization_id,user_id,role) values (%L,%L,''owner'')',ob,ua)) from aura_fixture;
select set_config('request.jwt.claim.sub',ub::text,true) from aura_fixture;
select pg_temp.aura_assert((select count(*)=1 from organizations),'B sees own organization');
select pg_temp.aura_assert((select count(*)=1 from clients),'B cannot see A clients');
select pg_temp.aura_assert((select count(*)=0 from assessments),'B cannot see A assessments');
select pg_temp.aura_assert((select count(*)=0 from organization_branding),'B cannot see A branding');
insert into clients(organization_id,full_name) select ob,'Synthetic new B' from aura_fixture;
insert into assessments(organization_id,client_id,recorded_by,weight_kg) select ob,cb,ub,70 from aura_fixture;
select pg_temp.aura_denied(format('insert into clients(organization_id,full_name) values (%L,''Intruder'')',oa)) from aura_fixture;
select pg_temp.aura_denied(format('insert into assessments(organization_id,client_id,recorded_by,weight_kg) values (%L,%L,%L,80)',ob,ca,ub)) from aura_fixture;
select pg_temp.aura_denied(format('insert into assessments(organization_id,client_id,recorded_by,weight_kg) values (%L,%L,%L,80)',oa,ca,ub)) from aura_fixture;
insert into organization_branding(organization_id,display_name,updated_by) select ob,'Synthetic brand B',ub from aura_fixture;
update organization_branding set display_name='Synthetic admin edit';
select pg_temp.aura_assert((select count(*)=1 from organization_branding where display_name='Synthetic admin edit'),'admin updates own branding');
with changed as (update organization_branding set display_name='Intruder' where organization_id=(select oa from aura_fixture) returning *)
 select pg_temp.aura_assert(count(*)=0,'admin cannot update foreign branding') from changed;
select set_config('request.jwt.claim.sub',ua::text,true) from aura_fixture;
with changed as (update organization_branding set display_name='Intruder' where organization_id=(select ob from aura_fixture) returning *)
 select pg_temp.aura_assert(count(*)=0,'owner cannot update foreign branding') from changed;
select set_config('request.jwt.claim.sub',coach::text,true) from aura_fixture;
select pg_temp.aura_assert((select count(*)=1 from assessments),'coach reads own assessments');
with changed as (update organization_branding set display_name='Coach edit' returning *)
 select pg_temp.aura_assert(count(*)=0,'coach cannot update branding') from changed;
select pg_temp.aura_denied(format('insert into organization_branding(organization_id,display_name,updated_by) values (%L,''Coach insert'',%L)',ob,coach)) from aura_fixture;
select set_config('request.jwt.claim.sub',unassigned::text,true) from aura_fixture;
select pg_temp.aura_assert((select count(*)=0 from organizations),'unassigned organizations denied');
select pg_temp.aura_assert((select count(*)=0 from organization_members),'unassigned memberships denied');
select pg_temp.aura_assert((select count(*)=0 from clients),'unassigned clients denied');
select pg_temp.aura_assert((select count(*)=0 from assessments),'unassigned assessments denied');
select pg_temp.aura_assert((select count(*)=0 from organization_branding),'unassigned branding denied');
select pg_temp.aura_denied(format('insert into clients(organization_id,full_name) values (%L,''Intruder'')',oa)) from aura_fixture;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.aura_denied('select * from organizations');
select pg_temp.aura_denied('select * from organization_members');
select pg_temp.aura_denied('select * from clients');
select pg_temp.aura_denied('select * from assessments');
select pg_temp.aura_denied('select * from organization_branding');
select pg_temp.aura_denied(format('insert into clients(organization_id,full_name) values (%L,''Intruder'')',oa)) from aura_fixture;
reset role;
select 'PASS: A/B isolation, owner/admin/coach, unassigned and anon; fixtures rolled back' as result;
rollback;
