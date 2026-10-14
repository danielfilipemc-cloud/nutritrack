with parts as (
 select 'registry' k,coalesce(jsonb_agg(to_jsonb(m) order by name),'[]'::jsonb) payload from app_private.aura_migrations m
 union all
 select 'rls',coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity) order by n.nspname,c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r'
 union all
 select 'policies',coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]'::jsonb) from pg_policies p where schemaname in ('public','app_private')
 union all
 select 'table_grants',coalesce(jsonb_agg(to_jsonb(g) order by table_schema,table_name,grantor,grantee,privilege_type),'[]'::jsonb) from information_schema.role_table_grants g where table_schema in ('public','app_private')
 union all
 select 'column_grants',coalesce(jsonb_agg(to_jsonb(g) order by table_schema,table_name,column_name,grantor,grantee,privilege_type),'[]'::jsonb) from information_schema.role_column_grants g where table_schema in ('public','app_private')
 union all
 select 'function_grants',coalesce(jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),a.grantor,a.grantee,a.privilege_type),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='app_private' or (n.nspname='public' and p.proname like 'aura_%')
 union all
 select 'functions',coalesce(jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid)) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' or (n.nspname='public' and p.proname like 'aura_%')
 union all
 select 'clients',coalesce(jsonb_agg(to_jsonb(c) order by id),'[]'::jsonb) from public.clients c
 union all
 select 'assessments',coalesce(jsonb_agg(to_jsonb(a) order by id),'[]'::jsonb) from public.assessments a
 union all
 select 'memberships',coalesce(jsonb_agg(to_jsonb(m) order by organization_id,user_id),'[]'::jsonb) from public.organization_members m
 union all
 select 'auth_identity_and_password',coalesce(jsonb_agg(jsonb_build_array(id,email,encrypted_password,email_confirmed_at) order by id),'[]'::jsonb) from auth.users
)
select jsonb_object_agg(k,encode(sha256(convert_to(payload::text,'UTF8')),'hex')) from parts;
