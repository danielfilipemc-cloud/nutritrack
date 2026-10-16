#!/usr/bin/env bash
# Compatibility repair exclusively for the synthetic recovered fourth runtime.
set -euo pipefail
grep -qx AURA-Dev /etc/aura-development-runtime
test "${DOCKER_HOST:-unix:///var/run/docker.sock}" = unix:///var/run/docker.sock
test "$(docker context inspect --format '{{.Endpoints.docker.Host}}')" = unix:///var/run/docker.sock
container=supabase_db_aura-foundations-cloud-recovery
test "$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostIp}}' "$container")" = 127.0.0.1
test "$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$container")" = 60322
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -At <<'SQL'
begin;
do $$begin if exists(select 1 from auth.users where raw_app_meta_data->>'synthetic' is distinct from 'true' or email not like '%@example.invalid') then raise exception 'Synthetic recovery users only';end if;end;$$;
update auth.users set confirmation_token=coalesce(confirmation_token,''),recovery_token=coalesce(recovery_token,''),email_change_token_new=coalesce(email_change_token_new,''),email_change_token_current=coalesce(email_change_token_current,''),phone_change_token=coalesce(phone_change_token,''),reauthentication_token=coalesce(reauthentication_token,'');
commit;
SQL
