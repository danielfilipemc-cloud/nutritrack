-- PREPARED ONLY. Requires canonical19 and the three personal access candidates.
-- Assisted, append-only plan consultation. No browser writer or remote activation.
create function app_private.personal_plan_text(p jsonb,maximum integer) returns text
language plpgsql immutable set search_path='' as $$declare s text;begin
 if jsonb_typeof(p) is distinct from 'string' then raise exception using errcode='22023',message='Invalid plan text';end if;
 s:=btrim(p#>>'{}');if s ~ '[[:cntrl:]]' or length(s) not between 1 and maximum then raise exception using errcode='22023',message='Invalid plan text';end if;return s;
end;$$;
create function app_private.personal_plan_dish(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$declare c jsonb;begin
 if not coalesce(app_private.nutrition_keys(p,array['source','items']),false) or p->>'source' is distinct from 'manual'
 or jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 8 then raise exception using errcode='22023',message='Manual plan portions required';end if;
 c:=app_private.nutrition_command_v1(jsonb_build_object('contractVersion',1,'requestId','00000000-0000-0000-0000-000000000001','mealId',null,'expectedRevision',0,'consumedOn','2000-01-01','mealKind','other','operation','save','items',p->'items'));
 return jsonb_build_object('source','manual','items',c->'items');
end;$$;
create function app_private.personal_plan_body(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$declare m jsonb;a jsonb;meals jsonb:='[]';alts jsonb;ids uuid[]:='{}';i uuid;begin
 if not coalesce(app_private.nutrition_keys(p,array['title','notes','meals']),false) or jsonb_typeof(p->'meals') is distinct from 'array'
 or jsonb_array_length(p->'meals') not between 1 and 12 or octet_length(p::text)>65536 then raise exception using errcode='22023',message='Invalid plan body';end if;
 for m in select value from jsonb_array_elements(p->'meals') loop
  if not coalesce(app_private.nutrition_keys(m,array['id','label','time','primary','alternatives']),false)
   or jsonb_typeof(m->'id') is distinct from 'string' or (m->>'id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or (m->'time'<>'null'::jsonb and (jsonb_typeof(m->'time') is distinct from 'string' or (m->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
   or jsonb_typeof(m->'alternatives') is distinct from 'array' or jsonb_array_length(m->'alternatives')>3 then raise exception using errcode='22023',message='Invalid plan meal';end if;
  i:=(m->>'id')::uuid;if i=any(ids) then raise exception using errcode='22023',message='Duplicate plan identity';end if;ids:=array_append(ids,i);alts:='[]';
  for a in select value from jsonb_array_elements(m->'alternatives') loop
   if not coalesce(app_private.nutrition_keys(a,array['id','label','dish']),false) or jsonb_typeof(a->'id') is distinct from 'string'
    or (a->>'id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception using errcode='22023',message='Invalid plan alternative';end if;
   i:=(a->>'id')::uuid;if i=any(ids) then raise exception using errcode='22023',message='Duplicate plan identity';end if;ids:=array_append(ids,i);
   alts:=alts||jsonb_build_array(jsonb_build_object('id',i,'label',app_private.personal_plan_text(a->'label',120),'dish',app_private.personal_plan_dish(a->'dish')));
  end loop;
  meals:=meals||jsonb_build_array(jsonb_build_object('id',m->'id','label',app_private.personal_plan_text(m->'label',120),'time',m->'time','primary',app_private.personal_plan_dish(m->'primary'),'alternatives',alts));
 end loop;
 return jsonb_build_object('title',app_private.personal_plan_text(p->'title',120),'notes',case when p->'notes'='null'::jsonb then null else app_private.personal_plan_text(p->'notes',2000) end,'meals',meals);
end;$$;
create table app_private.nutrition_personal_plan_versions(
 organization_id uuid not null,client_id uuid not null,personal_user_id uuid not null references auth.users(id),revision bigint not null check(revision>0 and revision<9007199254740991),
 status text not null check(status in ('available','withdrawn')),body jsonb,source_label text not null check(length(btrim(source_label)) between 1 and 240),reason text not null check(length(btrim(reason)) between 3 and 300),recorded_at timestamptz not null default statement_timestamp(),
 primary key(organization_id,client_id,personal_user_id,revision),foreign key(client_id,organization_id) references public.clients(id,organization_id),
 check((status='available' and body is not null) or (status='withdrawn' and body is null))
);
alter table app_private.nutrition_personal_plan_versions enable row level security;
revoke all on app_private.nutrition_personal_plan_versions from public,anon,authenticated;
create function app_private.personal_plan_insert_guard() returns trigger
language plpgsql set search_path='' as $$declare rev bigint;begin
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text||':'||new.client_id::text||':'||new.personal_user_id::text,0));
 if not exists(select 1 from public.client_users l join public.clients c on c.organization_id=l.organization_id and c.id=l.client_id
  join app_private.organization_security s on s.organization_id=l.organization_id
  where l.organization_id=new.organization_id and l.client_id=new.client_id and l.user_id=new.personal_user_id and l.revoked_at is null and c.archived_at is null and s.require_sensitive_aal2)
 then raise exception using errcode='42501',message='Active own link and required MFA policy needed';end if;
 select coalesce(max(revision),0) into rev from app_private.nutrition_personal_plan_versions where organization_id=new.organization_id and client_id=new.client_id and personal_user_id=new.personal_user_id;
 if new.revision<>rev+1 then raise exception using errcode='PT409',message='Plan revision conflict';end if;
 new.source_label:=app_private.personal_plan_text(to_jsonb(new.source_label),240);new.reason:=app_private.personal_plan_text(to_jsonb(new.reason),300);
 if length(new.reason)<3 then raise exception using errcode='22023',message='Change reason required';end if;
 if new.status='available' then new.body:=app_private.personal_plan_body(new.body);end if;
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action)
 values(new.organization_id,new.client_id,null,new.personal_user_id,case when new.status='available' then 'private_plan_reference_added' else 'private_plan_reference_withdrawn' end);
 return new;
end;$$;
create trigger personal_plan_insert_guard before insert on app_private.nutrition_personal_plan_versions for each row execute function app_private.personal_plan_insert_guard();
create trigger personal_plan_immutable before update or delete on app_private.nutrition_personal_plan_versions for each row execute function app_private.nutrition_immutable();
create function app_private.student_nutrition_plan_read(p_org uuid,p_client uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare r app_private.nutrition_personal_plan_versions%rowtype;scope jsonb;begin
 if not app_private.nutrition_self_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 scope:=jsonb_build_object('organizationId',p_org,'clientId',p_client,'userId',auth.uid());
 select * into r from app_private.nutrition_personal_plan_versions where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid() order by revision desc limit 1;
 if not found then return jsonb_build_object('scope',scope,'revision',0,'status','none','recordedAt',null,'sourceLabel',null,'body',null);end if;
 return jsonb_build_object('scope',scope,'revision',r.revision,'status',r.status,'recordedAt',r.recorded_at,'sourceLabel',r.source_label,'body',r.body);
end;$$;
create function public.aura_student_nutrition_plan_read(p_org uuid,p_client uuid) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.student_nutrition_plan_read(p_org,p_client);$$;
create function app_private.student_nutrition_plan_export(p_org uuid,p_client uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare versions jsonb;begin
 if not app_private.nutrition_self_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 if (select count(*) from app_private.nutrition_personal_plan_versions where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid())>1000 then raise exception using errcode='54000',message='Assisted complete plan export required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('revision',revision,'status',status,'recordedAt',recorded_at,'sourceLabel',source_label,'body',body,'reason',reason) order by revision),'[]'::jsonb) into versions
 from app_private.nutrition_personal_plan_versions where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid();
 if octet_length(versions::text)>8388608 then raise exception using errcode='54000',message='Assisted complete plan export required';end if;
 return jsonb_build_object('format','aura.private-plan.v1','complete',true,'scope',jsonb_build_object('organizationId',p_org,'clientId',p_client,'userId',auth.uid()),'count',jsonb_array_length(versions),'versions',versions,'sha256',encode(sha256(convert_to(versions::text,'UTF8')),'hex'));
end;$$;
create function public.aura_student_nutrition_plan_export(p_org uuid,p_client uuid) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.student_nutrition_plan_export(p_org,p_client);$$;
revoke all on function app_private.personal_plan_text(jsonb,integer),app_private.personal_plan_dish(jsonb),app_private.personal_plan_body(jsonb),app_private.personal_plan_insert_guard(),app_private.student_nutrition_plan_read(uuid,uuid),public.aura_student_nutrition_plan_read(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.student_nutrition_plan_read(uuid,uuid),public.aura_student_nutrition_plan_read(uuid,uuid) to authenticated;
revoke all on function app_private.student_nutrition_plan_export(uuid,uuid),public.aura_student_nutrition_plan_export(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.student_nutrition_plan_export(uuid,uuid),public.aura_student_nutrition_plan_export(uuid,uuid) to authenticated;
-- No writer grant. Operator-assisted content publication needs a separate,
-- exact-destination, scope-bound and reviewed activation/provisioning package.
