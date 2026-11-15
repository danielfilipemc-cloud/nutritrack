-- Incremental private-only candidate. Depends on personal_plan_reference.
-- Own manual adjustments and private feedback; no consumption or prescriptions.
create table app_private.nutrition_personal_plan_entries(
 organization_id uuid not null,client_id uuid not null,personal_user_id uuid not null,
 entry_revision bigint not null check(entry_revision>0 and entry_revision<9007199254740991),
 plan_revision bigint not null,request_id uuid not null,command_hash text not null check(command_hash ~ '^[a-f0-9]{64}$'),
 kind text not null check(kind in ('revise','feedback')),comment text not null check(length(btrim(comment)) between 3 and 1000),recorded_at timestamptz not null default statement_timestamp(),
 primary key(organization_id,client_id,personal_user_id,entry_revision),unique(organization_id,client_id,personal_user_id,request_id),
 foreign key(organization_id,client_id,personal_user_id,plan_revision) references app_private.nutrition_personal_plan_versions(organization_id,client_id,personal_user_id,revision)
);
alter table app_private.nutrition_personal_plan_entries enable row level security;
revoke all on app_private.nutrition_personal_plan_entries from public,anon,authenticated;
create trigger personal_plan_entries_immutable before update or delete on app_private.nutrition_personal_plan_entries for each row execute function app_private.nutrition_immutable();
create function app_private.personal_plan_change_command(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$declare note text;body jsonb;begin
 if not coalesce(app_private.nutrition_keys(p,array['contractVersion','requestId','expectedRevision','operation','body','comment']),false)
 or p->'contractVersion' is distinct from '1'::jsonb or jsonb_typeof(p->'requestId') is distinct from 'string'
 or (p->>'requestId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or jsonb_typeof(p->'expectedRevision') is distinct from 'number' or (p->>'expectedRevision') !~ '^[1-9][0-9]{0,15}$'
 or (p->>'expectedRevision')::numeric>=9007199254740991 or p->>'operation' not in ('revise','feedback')
 or jsonb_typeof(p->'operation') is distinct from 'string' then raise exception using errcode='22023',message='Invalid plan change';end if;
 if p->>'operation'='revise' then body:=app_private.personal_plan_body(p->'body');note:=app_private.personal_plan_text(p->'comment',300);
 else if p->'body' is distinct from 'null'::jsonb then raise exception using errcode='22023',message='Feedback cannot change plan';end if;body:=null;note:=app_private.personal_plan_text(p->'comment',1000);end if;
 if length(note)<3 then raise exception using errcode='22023',message='Change description required';end if;
 return jsonb_build_object('contractVersion',1,'requestId',(p->>'requestId')::uuid,'expectedRevision',(p->>'expectedRevision')::bigint,'operation',p->'operation','body',body,'comment',note);
end;$$;
create function app_private.student_nutrition_plan_change(p_org uuid,p_client uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$declare c jsonb;fingerprint text;r app_private.nutrition_personal_plan_entries%rowtype;head app_private.nutrition_personal_plan_versions%rowtype;next_entry bigint;next_plan bigint;begin
 if not app_private.nutrition_self_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 c:=app_private.personal_plan_change_command(p_command);
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':'||p_client::text||':'||auth.uid()::text,0));
 -- Serialize writes with revocation/archive/session removal and MFA policy changes.
 perform 1 from public.client_users where organization_id=p_org and client_id=p_client and user_id=auth.uid() and revoked_at is null for share;
 if not found then raise exception using errcode='42501',message='Access denied';end if;
 perform 1 from public.clients where organization_id=p_org and id=p_client and archived_at is null for share;
 if not found then raise exception using errcode='42501',message='Access denied';end if;
 perform 1 from auth.sessions where id=(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'session_id')::uuid and user_id=auth.uid() and (not_after is null or not_after>statement_timestamp()) for share;
 if not found then raise exception using errcode='42501',message='Access denied';end if;
 perform 1 from auth.users where id=auth.uid() and email_confirmed_at is not null for share;
 if not found then raise exception using errcode='42501',message='Access denied';end if;
 perform 1 from app_private.organization_security where organization_id=p_org and require_sensitive_aal2 for share;
 if not found or not app_private.nutrition_self_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 fingerprint:=encode(sha256(convert_to(c::text,'UTF8')),'hex');
 select * into r from app_private.nutrition_personal_plan_entries where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid() and request_id=(c->>'requestId')::uuid;
 if found then
  if r.command_hash<>fingerprint then raise exception using errcode='PT409',message='Request identity conflict';end if;
  return jsonb_build_object('requestId',r.request_id,'kind',r.kind,'planRevision',r.plan_revision,'entryRevision',r.entry_revision,'replayed',true);
 end if;
 select * into head from app_private.nutrition_personal_plan_versions where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid() order by revision desc limit 1;
 if not found or head.status<>'available' then raise exception using errcode='42501',message='No available own plan';end if;
 if head.revision<>(c->>'expectedRevision')::bigint then raise exception using errcode='PT409',message='Plan revision conflict';end if;
 next_plan:=head.revision;
 if c->>'operation'='revise' then
  next_plan:=next_plan+1;
  insert into app_private.nutrition_personal_plan_versions(organization_id,client_id,personal_user_id,revision,status,body,source_label,reason)
  values(p_org,p_client,auth.uid(),next_plan,'available',c->'body','Ajuste pessoal — não validado por profissional',c->>'comment');
 end if;
 select coalesce(max(entry_revision),0)+1 into next_entry from app_private.nutrition_personal_plan_entries where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid();
 insert into app_private.nutrition_personal_plan_entries values(p_org,p_client,auth.uid(),next_entry,next_plan,(c->>'requestId')::uuid,fingerprint,c->>'operation',c->>'comment',statement_timestamp());
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action) values(p_org,p_client,auth.uid(),auth.uid(),case when c->>'operation'='revise' then 'private_plan_self_revised' else 'private_plan_feedback_recorded' end);
 return jsonb_build_object('requestId',c->'requestId','kind',c->'operation','planRevision',next_plan,'entryRevision',next_entry,'replayed',false);
end;$$;
create function app_private.student_nutrition_plan_change_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare r app_private.nutrition_personal_plan_entries%rowtype;begin
 if not app_private.nutrition_self_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 select * into r from app_private.nutrition_personal_plan_entries where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid() and request_id=p_request;
 if not found then return null;end if;
 return jsonb_build_object('requestId',r.request_id,'kind',r.kind,'planRevision',r.plan_revision,'entryRevision',r.entry_revision,'replayed',true);
end;$$;
create function app_private.student_nutrition_plan_feedback_export(p_org uuid,p_client uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare entries jsonb;begin
 if not app_private.nutrition_self_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 if (select count(*) from app_private.nutrition_personal_plan_entries where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid())>1000 then raise exception using errcode='54000',message='Assisted complete feedback export required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('entryRevision',entry_revision,'planRevision',plan_revision,'kind',kind,'comment',comment,'recordedAt',recorded_at) order by entry_revision),'[]'::jsonb) into entries
 from app_private.nutrition_personal_plan_entries where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid();
 if octet_length(entries::text)>8388608 then raise exception using errcode='54000',message='Assisted complete feedback export required';end if;
 return jsonb_build_object('format','aura.private-plan-feedback.v1','complete',true,'scope',jsonb_build_object('organizationId',p_org,'clientId',p_client,'userId',auth.uid()),'count',jsonb_array_length(entries),'entries',entries,'sha256',encode(sha256(convert_to(entries::text,'UTF8')),'hex'));
end;$$;
create function public.aura_student_nutrition_plan_change(p_org uuid,p_client uuid,p_command jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.student_nutrition_plan_change(p_org,p_client,p_command);$$;
create function public.aura_student_nutrition_plan_change_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.student_nutrition_plan_change_status(p_org,p_client,p_request);$$;
create function public.aura_student_nutrition_plan_feedback_export(p_org uuid,p_client uuid) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.student_nutrition_plan_feedback_export(p_org,p_client);$$;
revoke all on function app_private.personal_plan_change_command(jsonb),app_private.student_nutrition_plan_change(uuid,uuid,jsonb),app_private.student_nutrition_plan_change_status(uuid,uuid,uuid),app_private.student_nutrition_plan_feedback_export(uuid,uuid),public.aura_student_nutrition_plan_change(uuid,uuid,jsonb),public.aura_student_nutrition_plan_change_status(uuid,uuid,uuid),public.aura_student_nutrition_plan_feedback_export(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.student_nutrition_plan_change(uuid,uuid,jsonb),app_private.student_nutrition_plan_change_status(uuid,uuid,uuid),app_private.student_nutrition_plan_feedback_export(uuid,uuid),public.aura_student_nutrition_plan_change(uuid,uuid,jsonb),public.aura_student_nutrition_plan_change_status(uuid,uuid,uuid),public.aura_student_nutrition_plan_feedback_export(uuid,uuid) to authenticated;
