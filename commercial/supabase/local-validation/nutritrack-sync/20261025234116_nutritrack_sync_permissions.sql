-- OFFLINE CANDIDATE ONLY. Generated with Supabase CLI 2.122.0, then deliberately
-- kept OUTSIDE migrations/ so existing installers cannot activate it by accident.
-- Requires reviewed baseline 19. Execute only in an explicit transaction locally.
-- No payload storage, transport, account creation, backfill or Auth configuration.

-- Historical actor IDs deliberately have no Auth FK: deleting an identity must
-- not be blocked by consent history. Every use rechecks the live binding/user.
create table app_private.nutritrack_sync_links (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null, client_id uuid not null,
 account_id uuid not null,
 proposed_by uuid not null,
 binding_linked_at timestamptz not null, invalidated_at timestamptz,
 created_at timestamptz not null default statement_timestamp(),
 foreign key(client_id,organization_id) references public.clients(id,organization_id)
);
create unique index sync_current_binding_idx on app_private.nutritrack_sync_links
 (organization_id,client_id,account_id,binding_linked_at) where invalidated_at is null;
create table app_private.nutritrack_sync_consents (
 link_id uuid not null references app_private.nutritrack_sync_links(id),
 revision bigint not null check(revision between 1 and 9007199254740991),
 state text not null check(state in ('active','revoked')),
 scopes text[] not null,
 expires_at timestamptz not null,
 actor_id uuid not null,
 created_at timestamptz not null default statement_timestamp(),
 primary key(link_id,revision),
 check((state='revoked' and cardinality(scopes)=0 and expires_at<=created_at)
 or (state='active' and array_ndims(scopes)=1 and cardinality(scopes) between 1 and 3
 and array_position(scopes,null) is null
 and scopes<@array['nutrition-plan','nutrition-entry','measurement']::text[]
 and expires_at>created_at and expires_at<=created_at+interval '90 days'))
);
alter table app_private.nutritrack_sync_links enable row level security;
alter table app_private.nutritrack_sync_consents enable row level security;
revoke all on app_private.nutritrack_sync_links,app_private.nutritrack_sync_consents from public,anon,authenticated;
grant select on app_private.nutritrack_sync_links,app_private.nutritrack_sync_consents to authenticated;

create function app_private.nutritrack_sync_immutable() returns trigger
language plpgsql set search_path='' as $$begin
 if tg_table_name='nutritrack_sync_links' and tg_op='UPDATE' then
  if old.invalidated_at is null and new.invalidated_at is not null
  and to_jsonb(new)-'invalidated_at'=to_jsonb(old)-'invalidated_at' then return new;end if;
 end if;
 raise exception using errcode='55000',message='Sync identity and consent history are append-only';
end;$$;
revoke all on function app_private.nutritrack_sync_immutable() from public,anon,authenticated;
create trigger sync_link_immutable before update or delete on app_private.nutritrack_sync_links
 for each row execute function app_private.nutritrack_sync_immutable();
create trigger sync_consent_immutable before update or delete on app_private.nutritrack_sync_consents
 for each row execute function app_private.nutritrack_sync_immutable();

-- This feature requires a live, non-anonymous, confirmed email identity even if
-- the establishment has not opted into MFA. Legacy modules are not changed.
create function app_private.nutritrack_sync_session_valid(p_org uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 sid text:=claims->>'session_id';begin
 if auth.uid() is null or sid is null
 or sid!~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 or not exists(select 1 from auth.users u where u.id=auth.uid()
 and u.email_confirmed_at is not null and u.is_anonymous is not true
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp()))
 or not exists(select 1 from auth.sessions s where s.id=sid::uuid and s.user_id=auth.uid()
 and (s.not_after is null or s.not_after>statement_timestamp())) then return false;end if;
 return app_private.sensitive_session_valid(p_org);
end;$$;
revoke all on function app_private.nutritrack_sync_session_valid(uuid) from public,anon,authenticated;

create function app_private.nutritrack_sync_can_read(p_org uuid,p_client uuid,p_account uuid,p_binding timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.nutritrack_sync_session_valid(p_org)
 and exists(select 1 from public.clients c join public.client_users u
 on u.organization_id=c.organization_id and u.client_id=c.id
 join auth.users a on a.id=u.user_id
 where c.organization_id=p_org and c.id=p_client and c.archived_at is null
 and u.user_id=p_account and u.linked_at=p_binding and u.revoked_at is null
 and a.email_confirmed_at is not null and a.is_anonymous is not true and a.deleted_at is null
 and (a.banned_until is null or a.banned_until<=statement_timestamp()))
 and (auth.uid()=p_account or app_private.nutrition_allowed(p_org,p_client,false));
$$;
revoke all on function app_private.nutritrack_sync_can_read(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function app_private.nutritrack_sync_can_read(uuid,uuid,uuid,timestamptz) to authenticated;
create policy sync_links_read on app_private.nutritrack_sync_links for select to authenticated
 using(app_private.nutritrack_sync_can_read(organization_id,client_id,account_id,binding_linked_at));
create policy sync_consents_read on app_private.nutritrack_sync_consents for select to authenticated
 using(exists(select 1 from app_private.nutritrack_sync_links l where l.id=link_id
 and app_private.nutritrack_sync_can_read(l.organization_id,l.client_id,l.account_id,l.binding_linked_at)));

-- Boolean permission primitive for a FUTURE transactional adapter. No client
-- supplied actor/source is trusted; all roles/identity are derived from SQL.
-- A read statement has MVCC semantics, not retroactive erasure on revocation.
create function app_private.nutritrack_sync_allowed(p_link uuid,p_operation text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare l app_private.nutritrack_sync_links%rowtype;
 c app_private.nutritrack_sync_consents%rowtype;scope text;begin
 select * into l from app_private.nutritrack_sync_links where id=p_link;
 if not found or l.invalidated_at is not null or not app_private.nutritrack_sync_can_read(l.organization_id,l.client_id,l.account_id,l.binding_linked_at) then return false;end if;
 select * into c from app_private.nutritrack_sync_consents where link_id=p_link order by revision desc limit 1;
 if not found or c.state<>'active' or c.expires_at<=statement_timestamp() then return false;end if;
 scope:=case when p_operation in ('plan-publish','plan-read') then 'nutrition-plan'
 when p_operation in ('entry-submit','entry-read','entry-review') then 'nutrition-entry'
 when p_operation in ('measurement-submit','measurement-read','measurement-review') then 'measurement' end;
 if scope is null or not scope=any(c.scopes) then return false;end if;
 if scope='measurement' and auth.uid()<>l.account_id
 and not app_private.can_access_client(l.organization_id,l.client_id,'assessments',p_operation='measurement-review') then return false;end if;
 if p_operation in ('entry-submit','measurement-submit') then return auth.uid()=l.account_id;end if;
 if p_operation in ('plan-publish','entry-review','measurement-review') then
  return auth.uid()<>l.account_id and app_private.nutrition_allowed(l.organization_id,l.client_id,true);end if;
 return p_operation in ('plan-read','entry-read','measurement-read');
end;$$;
revoke all on function app_private.nutritrack_sync_allowed(uuid,text) from public,anon,authenticated;
grant execute on function app_private.nutritrack_sync_allowed(uuid,text) to authenticated;

create function app_private.nutritrack_sync_propose(p_org uuid,p_client uuid) returns uuid
language plpgsql security definer set search_path='' as $$declare account uuid;binding timestamptz;link uuid;begin
 perform app_private.require_sensitive_session(p_org);
 if not app_private.nutritrack_sync_session_valid(p_org) or not app_private.nutrition_allowed(p_org,p_client,true)
 or not exists(select 1 from public.clients where organization_id=p_org and id=p_client and archived_at is null)
 then raise exception using errcode='42501',message='Sync access denied';end if;
 select user_id,linked_at into account,binding from public.client_users where organization_id=p_org and client_id=p_client and revoked_at is null;
 if account is null or not app_private.nutritrack_sync_can_read(p_org,p_client,account,binding) then raise exception using errcode='42501',message='Sync access denied';end if;
 insert into app_private.nutritrack_sync_links(organization_id,client_id,account_id,proposed_by,binding_linked_at)
 values(p_org,p_client,account,auth.uid(),binding) on conflict(organization_id,client_id,account_id,binding_linked_at) where invalidated_at is null do nothing returning id into link;
 if link is null then select id into link from app_private.nutritrack_sync_links
 where organization_id=p_org and client_id=p_client and account_id=account and binding_linked_at=binding and invalidated_at is null;
 else insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action)
 values(p_org,p_client,auth.uid(),account,'sync_link_proposed');end if;
 return link;
end;$$;
create function public.aura_nutritrack_sync_propose(p_org uuid,p_client uuid) returns uuid
language sql security invoker set search_path='' as $$select app_private.nutritrack_sync_propose(p_org,p_client);$$;
revoke all on function app_private.nutritrack_sync_propose(uuid,uuid),public.aura_nutritrack_sync_propose(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.nutritrack_sync_propose(uuid,uuid),public.aura_nutritrack_sync_propose(uuid,uuid) to authenticated;

create function app_private.nutritrack_sync_consent(p_org uuid,p_client uuid,p_expected bigint,p_scopes text[],p_expires timestamptz,p_revoke boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare account uuid;binding timestamptz;link uuid;rev bigint;normalized text[];begin
 perform app_private.require_sensitive_session(p_org);
 if not app_private.nutritrack_sync_session_valid(p_org) then raise exception using errcode='42501',message='Sync access denied';end if;
 select user_id,linked_at into account,binding from public.client_users where organization_id=p_org and client_id=p_client and revoked_at is null;
 if account is null or not exists(select 1 from public.clients where organization_id=p_org and id=p_client and archived_at is null)
 then raise exception using errcode='42501',message='Sync access denied';end if;
 if p_revoke is null or (not p_revoke and auth.uid()<>account)
 or (p_revoke and auth.uid()<>account and not app_private.can_manage_access(p_org) and not app_private.nutrition_allowed(p_org,p_client,true))
 then raise exception using errcode='42501',message='Sync access denied';end if;
 if p_expected is null or p_expected<0 or p_expected>=9007199254740991 or p_scopes is null
 then raise exception using errcode='22023',message='Invalid consent';end if;
 select id into link from app_private.nutritrack_sync_links where organization_id=p_org and client_id=p_client and account_id=account and binding_linked_at=binding and invalidated_at is null;
 if link is null then raise exception using errcode='42501',message='Sync access denied';end if;
 select revision into rev from app_private.nutritrack_sync_consents where link_id=link order by revision desc limit 1;
 if p_expected<>coalesce(rev,0) then raise exception using errcode='PT409',message='Consent revision conflict';end if;
 if p_revoke then
  if cardinality(p_scopes)<>0 or p_expires is not null then raise exception using errcode='22023',message='Invalid revocation';end if;
  normalized:=array[]::text[];
 else
  if array_ndims(p_scopes)<>1 or cardinality(p_scopes) not between 1 and 3 or array_position(p_scopes,null) is not null
  or not p_scopes<@array['nutrition-plan','nutrition-entry','measurement']::text[]
  or (select count(distinct x) from unnest(p_scopes) x)<>cardinality(p_scopes)
  or p_expires is null or p_expires<=statement_timestamp() or p_expires>statement_timestamp()+interval '90 days'
  then raise exception using errcode='22023',message='Invalid consent';end if;
  select array_agg(x order by x) into normalized from unnest(p_scopes) x;
 end if;
 insert into app_private.nutritrack_sync_consents(link_id,revision,state,scopes,expires_at,actor_id)
 values(link,coalesce(rev,0)+1,case when p_revoke then 'revoked' else 'active' end,normalized,
 case when p_revoke then statement_timestamp() else p_expires end,auth.uid());
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action)
 values(p_org,p_client,auth.uid(),account,case when p_revoke then 'sync_consent_revoked' else 'sync_consent_accepted' end);
 return jsonb_build_object('linkId',link,'revision',coalesce(rev,0)+1,'state',case when p_revoke then 'revoked' else 'active' end);
end;$$;
create function public.aura_nutritrack_sync_consent(p_org uuid,p_client uuid,p_expected bigint,p_scopes text[],p_expires timestamptz,p_revoke boolean) returns jsonb
language sql security invoker set search_path='' as $$select app_private.nutritrack_sync_consent(p_org,p_client,p_expected,p_scopes,p_expires,p_revoke);$$;
revoke all on function app_private.nutritrack_sync_consent(uuid,uuid,bigint,text[],timestamptz,boolean),public.aura_nutritrack_sync_consent(uuid,uuid,bigint,text[],timestamptz,boolean) from public,anon,authenticated;
grant execute on function app_private.nutritrack_sync_consent(uuid,uuid,bigint,text[],timestamptz,boolean),public.aura_nutritrack_sync_consent(uuid,uuid,bigint,text[],timestamptz,boolean) to authenticated;

create function app_private.nutritrack_sync_context(p_org uuid,p_client uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare account uuid;binding timestamptz;l app_private.nutritrack_sync_links%rowtype;c app_private.nutritrack_sync_consents%rowtype;begin
 select user_id,linked_at into account,binding from public.client_users where organization_id=p_org and client_id=p_client and revoked_at is null;
 if account is null or not app_private.nutritrack_sync_can_read(p_org,p_client,account,binding)
 then raise exception using errcode='42501',message='Sync access denied';end if;
 select * into l from app_private.nutritrack_sync_links where organization_id=p_org and client_id=p_client and account_id=account and binding_linked_at=binding and invalidated_at is null;
 if not found then return jsonb_build_object('state','unlinked','revision',0);end if;
 select * into c from app_private.nutritrack_sync_consents where link_id=l.id order by revision desc limit 1;
 return jsonb_build_object('linkId',l.id,'revision',coalesce(c.revision,0),'state',case when c.revision is null then 'awaiting-consent'
 when c.state='revoked' then 'revoked' when c.expires_at<=statement_timestamp() then 'expired' else 'active' end,
 'scopes',coalesce(c.scopes,array[]::text[]),'expiresAt',c.expires_at,
 'canPublishPlan',app_private.nutritrack_sync_allowed(l.id,'plan-publish'),
 'canReadPlan',app_private.nutritrack_sync_allowed(l.id,'plan-read'),
 'canSubmitEntry',app_private.nutritrack_sync_allowed(l.id,'entry-submit'),
 'canSubmitMeasurement',app_private.nutritrack_sync_allowed(l.id,'measurement-submit'),
 'canReviewEntry',app_private.nutritrack_sync_allowed(l.id,'entry-review'),
 'canReadMeasurement',app_private.nutritrack_sync_allowed(l.id,'measurement-read'),
 'canReviewMeasurement',app_private.nutritrack_sync_allowed(l.id,'measurement-review'));
end;$$;
create function public.aura_nutritrack_sync_context(p_org uuid,p_client uuid) returns jsonb
language sql security invoker set search_path='' as $$select app_private.nutritrack_sync_context(p_org,p_client);$$;
revoke all on function app_private.nutritrack_sync_context(uuid,uuid),public.aura_nutritrack_sync_context(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.nutritrack_sync_context(uuid,uuid),public.aura_nutritrack_sync_context(uuid,uuid) to authenticated;

-- AURA binding revocation/replacement is terminal for existing sync links. This
-- narrow additive trigger is necessary even when the same identity is relinked
-- without changing linked_at. It never revives or edits a consent snapshot.
create function app_private.nutritrack_sync_binding_invalidated() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if tg_op='UPDATE' then
  if (new.organization_id,new.client_id,new.user_id,new.linked_at,new.revoked_at)
  is not distinct from (old.organization_id,old.client_id,old.user_id,old.linked_at,old.revoked_at) then return new;end if;
 end if;
 perform 1 from public.organizations where id=old.organization_id for update;
 update app_private.nutritrack_sync_links set invalidated_at=statement_timestamp()
 where organization_id=old.organization_id and client_id=old.client_id and account_id=old.user_id
 and binding_linked_at=old.linked_at and invalidated_at is null;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
revoke all on function app_private.nutritrack_sync_binding_invalidated() from public,anon,authenticated;
create trigger sync_binding_invalidated after update or delete on public.client_users
 for each row execute function app_private.nutritrack_sync_binding_invalidated();
