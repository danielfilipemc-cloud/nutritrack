-- INACTIVE/OFFLINE CANDIDATE. Baseline18/19 required. Not part of installer.
-- No remote execution without separate reviewed activation/recovery package.
create function app_private.nutrition_document_text(p jsonb,maximum integer,minimum integer default 1) returns text
language plpgsql immutable set search_path='' as $$declare s text;begin
 if jsonb_typeof(p) is distinct from 'string' then raise exception using errcode='22023',message='Invalid document text';end if;
 s:=p#>>'{}';if s ~ '[[:cntrl:]]' or length(btrim(s)) not between minimum and maximum then raise exception using errcode='22023',message='Invalid document text';end if;return btrim(s);
end;$$;
create function app_private.nutrition_document_items(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$declare v jsonb;canonical jsonb:='[]';parsed jsonb;begin
 if jsonb_typeof(p) is distinct from 'array' then raise exception using errcode='22023',message='Invalid ingredients';end if;
 if jsonb_array_length(p) not between 1 and 8 then raise exception using errcode='22023',message='Invalid ingredient count';end if;
 for v in select * from jsonb_array_elements(p) loop
  canonical:=canonical||jsonb_build_array(jsonb_set(v,'{label}',to_jsonb(app_private.nutrition_document_text(v->'label',120))));
 end loop;
 parsed:=app_private.nutrition_command_v1(jsonb_build_object('contractVersion',1,'requestId','00000000-0000-0000-0000-000000000001','mealId',null,'expectedRevision',0,'consumedOn','2000-01-01','mealKind','other','operation','save','items',canonical));
 return parsed->'items';
end;$$;
create function app_private.nutrition_document_recipe(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$begin
 if not coalesce(app_private.nutrition_keys(p,array['title','notes','items']),false) then raise exception using errcode='22023',message='Invalid recipe';end if;
 return jsonb_build_object('title',app_private.nutrition_document_text(p->'title',120),'notes',case when p->'notes'='null'::jsonb then null else app_private.nutrition_document_text(p->'notes',2000) end,'items',app_private.nutrition_document_items(p->'items'));
end;$$;
create function app_private.nutrition_document_dish(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$declare r numeric;recipe uuid;begin
 if p->>'source'='manual' and app_private.nutrition_keys(p,array['source','items']) then return jsonb_build_object('source','manual','items',app_private.nutrition_document_items(p->'items'));end if;
 if not coalesce(app_private.nutrition_keys(p,array['source','recipeId','revision']),false) or p->'source' is distinct from '"recipe"'::jsonb
 or jsonb_typeof(p->'recipeId') is distinct from 'string' or (p->>'recipeId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or jsonb_typeof(p->'revision') is distinct from 'number' then raise exception using errcode='22023',message='Invalid recipe reference';end if;
 r:=(p->>'revision')::numeric;recipe:=(p->>'recipeId')::uuid;
 if r<1 or r>9007199254740991 or r<>trunc(r) then raise exception using errcode='22023',message='Invalid recipe revision';end if;
 return jsonb_build_object('source','recipe','recipeId',recipe,'revision',r::bigint);
end;$$;
create function app_private.nutrition_document_body(p_kind text,p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$declare m jsonb;a jsonb;meals jsonb:='[]';alts jsonb;ids uuid[]:='{}';identity uuid;begin
 if p_kind='recipe' then return app_private.nutrition_document_recipe(p);end if;
 if p_kind is distinct from 'plan' or not coalesce(app_private.nutrition_keys(p,array['title','notes','meals']),false) or jsonb_typeof(p->'meals') is distinct from 'array' then raise exception using errcode='22023',message='Invalid plan';end if;
 if jsonb_array_length(p->'meals') not between 1 and 12 then raise exception using errcode='22023',message='Invalid meal count';end if;
 for m in select * from jsonb_array_elements(p->'meals') loop
  if not app_private.nutrition_keys(m,array['id','label','time','primary','alternatives']) or jsonb_typeof(m->'id') is distinct from 'string'
  or (m->>'id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or jsonb_typeof(m->'alternatives') is distinct from 'array'
  or m->'time'<>'null'::jsonb and (jsonb_typeof(m->'time') is distinct from 'string' or (m->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception using errcode='22023',message='Invalid meal';end if;
  identity:=(m->>'id')::uuid;if identity=any(ids) then raise exception using errcode='22023',message='Duplicate plan identity';end if;ids:=array_append(ids,identity);
  if jsonb_array_length(m->'alternatives')>3 then raise exception using errcode='22023',message='Too many alternatives';end if;
  alts:='[]';for a in select * from jsonb_array_elements(m->'alternatives') loop
   if not app_private.nutrition_keys(a,array['id','label','dish']) or jsonb_typeof(a->'id') is distinct from 'string' or (a->>'id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception using errcode='22023',message='Invalid alternative';end if;
   identity:=(a->>'id')::uuid;if identity=any(ids) then raise exception using errcode='22023',message='Duplicate plan identity';end if;ids:=array_append(ids,identity);
   alts:=alts||jsonb_build_array(jsonb_build_object('id',identity,'label',app_private.nutrition_document_text(a->'label',120),'dish',app_private.nutrition_document_dish(a->'dish')));
  end loop;
  meals:=meals||jsonb_build_array(jsonb_build_object('id',(m->>'id')::uuid,'label',app_private.nutrition_document_text(m->'label',120),'time',m->'time','primary',app_private.nutrition_document_dish(m->'primary'),'alternatives',alts));
 end loop;
 return jsonb_build_object('title',app_private.nutrition_document_text(p->'title',120),'notes',case when p->'notes'='null'::jsonb then null else app_private.nutrition_document_text(p->'notes',2000) end,'meals',meals);
end;$$;
create function app_private.nutrition_document_command(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$declare target uuid;request uuid;rev numeric;reason text;begin
 if not coalesce(app_private.nutrition_keys(p,array['contractVersion','requestId','documentId','kind','expectedRevision','operation','body','reason']),false)
 or p->'contractVersion' is distinct from '1'::jsonb or jsonb_typeof(p->'requestId') is distinct from 'string'
 or (p->>'requestId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or p->>'kind' not in ('recipe','plan') or jsonb_typeof(p->'kind') is distinct from 'string'
 or p->>'operation' not in ('save','publish','withdraw') or jsonb_typeof(p->'operation') is distinct from 'string'
 or jsonb_typeof(p->'expectedRevision') is distinct from 'number' then raise exception using errcode='22023',message='Invalid document command';end if;
 request:=(p->>'requestId')::uuid;rev:=(p->>'expectedRevision')::numeric;
 if rev<0 or rev>9007199254740991 or rev<>trunc(rev) then raise exception using errcode='22023',message='Invalid document revision';end if;
 if p->'documentId'<>'null'::jsonb then
  if jsonb_typeof(p->'documentId') is distinct from 'string' or (p->>'documentId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception using errcode='22023',message='Invalid document identity';end if;target:=(p->>'documentId')::uuid;
 end if;
 if target is null and (rev<>0 or p->>'operation'<>'save' or p->'reason'<>'null'::jsonb) or target is not null and rev<1 then raise exception using errcode='22023',message='Invalid document operation';end if;
 if target is not null then reason:=app_private.nutrition_document_text(p->'reason',300,3);end if;
 if p->>'operation'<>'save' and p->'body'<>'null'::jsonb then raise exception using errcode='22023',message='Publication cannot replace draft';end if;
 return jsonb_build_object('contractVersion',1,'requestId',request,'documentId',target,'kind',p->>'kind','expectedRevision',rev::bigint,'operation',p->>'operation','body',case when p->>'operation'='save' then app_private.nutrition_document_body(p->>'kind',p->'body') else null end,'reason',reason);
end;$$;

create table public.nutrition_documents(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,client_id uuid not null,kind text not null check(kind in ('recipe','plan')),
 current_revision bigint not null check(current_revision between 1 and 9007199254740991),published_revision bigint check(published_revision between 1 and current_revision),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default statement_timestamp(),
 unique(id,organization_id,client_id),foreign key(client_id,organization_id) references public.clients(id,organization_id)
);
create table public.nutrition_document_versions(
 document_id uuid not null,organization_id uuid not null,client_id uuid not null,revision bigint not null check(revision between 1 and 9007199254740991),
 status text not null check(status in ('draft','published','withdrawn')),body jsonb not null check(jsonb_typeof(body)='object'),reason text,
 recorded_by uuid not null references auth.users(id),created_at timestamptz not null default statement_timestamp(),
 primary key(document_id,revision),unique(document_id,revision,organization_id,client_id),
 foreign key(document_id,organization_id,client_id) references public.nutrition_documents(id,organization_id,client_id),
 check((revision=1 and status='draft' and reason is null) or (revision>1 and reason is not null and length(btrim(reason)) between 3 and 300))
);
alter table public.nutrition_documents add foreign key(id,current_revision) references public.nutrition_document_versions(document_id,revision) deferrable initially deferred;
alter table public.nutrition_documents add foreign key(id,published_revision) references public.nutrition_document_versions(document_id,revision) deferrable initially deferred;
create index nutrition_documents_scope_idx on public.nutrition_documents(organization_id,client_id,kind,id);
-- One available plan per pupil. Replacing another plan requires explicit withdrawal.
create unique index nutrition_documents_active_plan_idx on public.nutrition_documents(organization_id,client_id) where kind='plan' and published_revision is not null;
create table app_private.nutrition_document_requests(
 organization_id uuid not null references public.organizations(id),actor_id uuid not null references auth.users(id),request_id uuid not null,client_id uuid not null,
 command_hash text not null,document_id uuid not null,revision bigint not null,created_at timestamptz not null default statement_timestamp(),
 primary key(organization_id,actor_id,request_id),foreign key(document_id,revision,organization_id,client_id) references public.nutrition_document_versions(document_id,revision,organization_id,client_id)
);
create table app_private.nutrition_document_events(
 organization_id uuid not null,actor_id uuid not null,request_id uuid not null,document_id uuid not null,revision bigint not null,
 action text not null check(action in ('save','publish','withdraw')),created_at timestamptz not null default statement_timestamp(),
 primary key(organization_id,actor_id,request_id),foreign key(organization_id,actor_id,request_id) references app_private.nutrition_document_requests(organization_id,actor_id,request_id)
);
create function app_private.nutrition_document_head_guard() returns trigger language plpgsql set search_path='' as $$begin
 if (new.id,new.organization_id,new.client_id,new.kind,new.created_by,new.created_at) is distinct from (old.id,old.organization_id,old.client_id,old.kind,old.created_by,old.created_at) or new.current_revision<>old.current_revision+1 then raise exception using errcode='55000',message='Immutable document identity or invalid revision';end if;return new;
end;$$;
create trigger nutrition_document_head_guard before update on public.nutrition_documents for each row execute function app_private.nutrition_document_head_guard();
create trigger nutrition_document_head_immutable before delete on public.nutrition_documents for each row execute function app_private.nutrition_immutable();
create trigger nutrition_document_versions_immutable before update or delete on public.nutrition_document_versions for each row execute function app_private.nutrition_immutable();
create trigger nutrition_document_requests_immutable before update or delete on app_private.nutrition_document_requests for each row execute function app_private.nutrition_immutable();
create trigger nutrition_document_events_immutable before update or delete on app_private.nutrition_document_events for each row execute function app_private.nutrition_immutable();
alter table public.nutrition_documents enable row level security;
alter table public.nutrition_document_versions enable row level security;
alter table app_private.nutrition_document_requests enable row level security;
alter table app_private.nutrition_document_events enable row level security;
revoke all on public.nutrition_documents,public.nutrition_document_versions,app_private.nutrition_document_requests,app_private.nutrition_document_events from public,anon,authenticated;
grant select on public.nutrition_documents,public.nutrition_document_versions to authenticated;
create policy nutrition_documents_read on public.nutrition_documents for select to authenticated using(app_private.nutrition_allowed(organization_id,client_id,false));
create policy nutrition_document_versions_read on public.nutrition_document_versions for select to authenticated using(app_private.nutrition_allowed(organization_id,client_id,false));

create function app_private.nutrition_document_freeze_dish(p_org uuid,p_client uuid,p jsonb) returns jsonb
language plpgsql set search_path='' as $$declare h public.nutrition_documents%rowtype;snapshot jsonb;begin
 if p->>'source'='manual' then return p;end if;
 select * into h from public.nutrition_documents where id=(p->>'recipeId')::uuid and organization_id=p_org and client_id=p_client and kind='recipe' for share;
 if not found or h.published_revision is distinct from (p->>'revision')::bigint then raise exception using errcode='PT409',message='Recipe publication unavailable';end if;
 if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 select body into snapshot from public.nutrition_document_versions where document_id=h.id and revision=h.published_revision and status='published';
 if not found then raise exception using errcode='PT409',message='Recipe publication unavailable';end if;
 return p||jsonb_build_object('snapshot',snapshot);
end;$$;
create function app_private.nutrition_document_freeze_plan(p_org uuid,p_client uuid,p jsonb) returns jsonb
language plpgsql set search_path='' as $$declare m jsonb;a jsonb;meals jsonb:='[]';alts jsonb;begin
 for m in select * from jsonb_array_elements(p->'meals') loop
  alts:='[]';for a in select * from jsonb_array_elements(m->'alternatives') loop alts:=alts||jsonb_build_array(jsonb_set(a,'{dish}',app_private.nutrition_document_freeze_dish(p_org,p_client,a->'dish')));end loop;
  meals:=meals||jsonb_build_array(m||jsonb_build_object('primary',app_private.nutrition_document_freeze_dish(p_org,p_client,m->'primary'),'alternatives',alts));
 end loop;return jsonb_set(p,'{meals}',meals);
end;$$;
create function app_private.nutrition_document_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$declare c jsonb;hash text;r app_private.nutrition_document_requests%rowtype;h public.nutrition_documents%rowtype;v public.nutrition_document_versions%rowtype;target uuid;rev bigint;publication bigint;content jsonb;state text;begin
 perform app_private.require_sensitive_session(p_org);
 if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 c:=app_private.nutrition_document_command(p_command);
 perform pg_advisory_xact_lock(hashtextextended('aura:nutrition:document:'||p_org::text||':'||auth.uid()::text||':'||(c->>'requestId'),0));
 if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 if exists(select 1 from public.clients where id=p_client and organization_id=p_org and archived_at is not null) then raise exception using errcode='23514',message='Archived client';end if;
 hash:=encode(sha256(convert_to(jsonb_build_object('organizationId',p_org,'clientId',p_client,'command',c)::text,'UTF8')),'hex');
 select * into r from app_private.nutrition_document_requests where organization_id=p_org and actor_id=auth.uid() and request_id=(c->>'requestId')::uuid;
 if found then
  if r.command_hash<>hash then raise exception using errcode='PT409',message='Request identity conflict';end if;
  return jsonb_build_object('documentId',r.document_id,'revision',r.revision,'replayed',true);
 end if;
 target:=(c->>'documentId')::uuid;
 if target is null then target:=gen_random_uuid();rev:=1;
 else
  select * into h from public.nutrition_documents where id=target and organization_id=p_org and client_id=p_client and kind=c->>'kind' for update;
  if not found then raise exception using errcode='42501',message='Access denied';end if;
  perform app_private.require_sensitive_session(p_org);
  if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
  if exists(select 1 from public.clients where id=p_client and organization_id=p_org and archived_at is not null) then raise exception using errcode='23514',message='Archived client';end if;
  if h.current_revision<>(c->>'expectedRevision')::bigint or h.current_revision>=9007199254740991 then raise exception using errcode='PT409',message='Document revision conflict';end if;
  select * into v from public.nutrition_document_versions where document_id=target and revision=h.current_revision;
  rev:=h.current_revision+1;publication:=h.published_revision;
 end if;
 if c->>'operation'='save' then content:=c->'body';state:='draft';if c->>'kind'='plan' then content:=app_private.nutrition_document_freeze_plan(p_org,p_client,content);end if;
 elsif c->>'operation'='publish' then
  if v.status is distinct from 'draft' then raise exception using errcode='23514',message='Only a draft can be published';end if;content:=v.body;state:='published';publication:=rev;
 else
  if h.published_revision is null then raise exception using errcode='23514',message='No available publication to withdraw';end if;
  select body into content from public.nutrition_document_versions where document_id=target and revision=h.published_revision and status='published';
  if not found then raise exception using errcode='23514',message='Invalid publication';end if;
  state:='withdrawn';publication:=null;
 end if;
 -- Recipe locks may have waited: revalidate actor/scope before the final atomic write.
 perform app_private.require_sensitive_session(p_org);
 if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 if exists(select 1 from public.clients where id=p_client and organization_id=p_org and archived_at is not null) then raise exception using errcode='23514',message='Archived client';end if;
 if h.id is null then insert into public.nutrition_documents(id,organization_id,client_id,kind,current_revision,published_revision,created_by) values(target,p_org,p_client,c->>'kind',rev,publication,auth.uid());
 else update public.nutrition_documents set current_revision=rev,published_revision=publication where id=target;end if;
 insert into public.nutrition_document_versions(document_id,organization_id,client_id,revision,status,body,reason,recorded_by) values(target,p_org,p_client,rev,state,content,c->>'reason',auth.uid());
 insert into app_private.nutrition_document_requests(organization_id,actor_id,request_id,client_id,command_hash,document_id,revision) values(p_org,auth.uid(),(c->>'requestId')::uuid,p_client,hash,target,rev);
 insert into app_private.nutrition_document_events(organization_id,actor_id,request_id,document_id,revision,action) values(p_org,auth.uid(),(c->>'requestId')::uuid,target,rev,c->>'operation');
 return jsonb_build_object('documentId',target,'revision',rev,'replayed',false);
exception when unique_violation then raise exception using errcode='PT409',message='Only one plan publication may be available';
end;$$;
create function app_private.nutrition_document_projection(p_id uuid,p_rev bigint) returns jsonb
language sql stable set search_path='' as $$select jsonb_build_object('documentId',v.document_id,'kind',h.kind,'revision',v.revision,'status',v.status,'body',v.body,'reason',v.reason,'recordedBy',v.recorded_by) from public.nutrition_document_versions v join public.nutrition_documents h on h.id=v.document_id where v.document_id=p_id and v.revision=p_rev;$$;
create function app_private.nutrition_document_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare r app_private.nutrition_document_requests%rowtype;begin
 perform app_private.require_sensitive_session(p_org);if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 select * into r from app_private.nutrition_document_requests where organization_id=p_org and actor_id=auth.uid() and client_id=p_client and request_id=p_request;
 if not found then return null;end if;return jsonb_build_object('documentId',r.document_id,'revision',r.revision);
end;$$;
create function app_private.nutrition_document_list(p_org uuid,p_client uuid,p_kind text,p_after uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare result jsonb;cursor uuid;begin
 if not app_private.nutrition_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_kind is null or p_kind not in ('recipe','plan') then raise exception using errcode='22023',message='Invalid kind';end if;
 select coalesce(jsonb_agg(jsonb_build_object('current',app_private.nutrition_document_projection(id,current_revision),'published',case when published_revision is null then null else app_private.nutrition_document_projection(id,published_revision) end) order by id),'[]'::jsonb) into result
 from(select id,current_revision,published_revision from public.nutrition_documents where organization_id=p_org and client_id=p_client and kind=p_kind and (p_after is null or id>p_after) order by id limit 21) page;
 if jsonb_array_length(result)>20 then cursor:=(result->19->'current'->>'documentId')::uuid;result:=result-20;end if;
 return jsonb_build_object('documents',result,'nextCursor',cursor);
end;$$;
create function app_private.nutrition_document_history(p_org uuid,p_client uuid,p_document uuid,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare result jsonb;cursor bigint;begin
 if not app_private.nutrition_allowed(p_org,p_client,false) or not exists(select 1 from public.nutrition_documents where id=p_document and organization_id=p_org and client_id=p_client) then raise exception using errcode='42501',message='Access denied';end if;
 if p_before is not null and (p_before<1 or p_before>9007199254740991) then raise exception using errcode='22023',message='Invalid cursor';end if;
 select coalesce(jsonb_agg(app_private.nutrition_document_projection(document_id,revision) order by revision desc),'[]'::jsonb) into result from(select document_id,revision from public.nutrition_document_versions where document_id=p_document and (p_before is null or revision<p_before) order by revision desc limit 21) page;
 if jsonb_array_length(result)>20 then cursor:=(result->19->>'revision')::bigint;result:=result-20;end if;return jsonb_build_object('versions',result,'nextCursor',cursor);
end;$$;
create function public.aura_nutrition_document_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.nutrition_document_save(p_org,p_client,p_command);$$;
create function public.aura_nutrition_document_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select app_private.nutrition_document_request_status(p_org,p_client,p_request);$$;
create function public.aura_nutrition_document_list(p_org uuid,p_client uuid,p_kind text,p_after uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.nutrition_document_list(p_org,p_client,p_kind,p_after);$$;
create function public.aura_nutrition_document_history(p_org uuid,p_client uuid,p_document uuid,p_before bigint default null) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.nutrition_document_history(p_org,p_client,p_document,p_before);$$;
revoke all on function app_private.nutrition_document_text(jsonb,integer,integer),app_private.nutrition_document_items(jsonb),app_private.nutrition_document_recipe(jsonb),app_private.nutrition_document_dish(jsonb),app_private.nutrition_document_body(text,jsonb),app_private.nutrition_document_command(jsonb),app_private.nutrition_document_head_guard(),app_private.nutrition_document_freeze_dish(uuid,uuid,jsonb),app_private.nutrition_document_freeze_plan(uuid,uuid,jsonb),app_private.nutrition_document_projection(uuid,bigint) from public,anon,authenticated;
revoke all on function app_private.nutrition_document_save(uuid,uuid,jsonb),public.aura_nutrition_document_save(uuid,uuid,jsonb),app_private.nutrition_document_request_status(uuid,uuid,uuid),public.aura_nutrition_document_request_status(uuid,uuid,uuid),app_private.nutrition_document_list(uuid,uuid,text,uuid),public.aura_nutrition_document_list(uuid,uuid,text,uuid),app_private.nutrition_document_history(uuid,uuid,uuid,bigint),public.aura_nutrition_document_history(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function app_private.nutrition_document_save(uuid,uuid,jsonb),public.aura_nutrition_document_save(uuid,uuid,jsonb),app_private.nutrition_document_request_status(uuid,uuid,uuid),public.aura_nutrition_document_request_status(uuid,uuid,uuid),app_private.nutrition_document_list(uuid,uuid,text,uuid),public.aura_nutrition_document_list(uuid,uuid,text,uuid),app_private.nutrition_document_history(uuid,uuid,uuid,bigint),public.aura_nutrition_document_history(uuid,uuid,uuid,bigint) to authenticated;
