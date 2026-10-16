#!/usr/bin/env bash
# One additive upgrade of the dedicated synthetic local runtime, never cloud/reset.
set -euo pipefail
umask 077
grep -qx AURA-Dev /etc/aura-development-runtime
test "${DOCKER_HOST:-unix:///var/run/docker.sock}" = unix:///var/run/docker.sock
test "$(docker context inspect --format '{{.Endpoints.docker.Host}}')" = unix:///var/run/docker.sock
root=$(cd -- "$(dirname -- "$0")/.." && pwd)
container=supabase_db_aura-foundations-local
test "$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostIp}}' "$container")" = 127.0.0.1
test "$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$container")" = 57322
sql(){ docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -At; }
test "$(printf '%s\n' 'select count(*) from app_private.aura_migrations;' | sql)" = 10
test "$(printf '%s\n' "select count(*) from auth.users where coalesce(raw_app_meta_data->>'synthetic','false')<>'true';" | sql)" = 0
test -s "$root/supabase/install.generated.sql"
grep -Fq '20261016184133_student_objectives.sql' "$root/supabase/install.generated.sql"
test "$(grep -c 'insert into app_private.aura_migrations(name,checksum)' "$root/supabase/install.generated.sql")" = 11
run=$(mktemp -d "$root/.aura-integration/objectives-upgrade-XXXXXXXX")
docker exec "$container" pg_dump -U postgres -d postgres --format=custom > "$run/before.private.dump"
test -s "$run/before.private.dump"
sha256sum "$run/before.private.dump" > "$run/SHA256SUMS"
cat > "$run/verify-before-after.sql" <<'SQL'
select jsonb_build_object(
 'clients',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from public.clients t),
 'assessments',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from public.assessments t),
 'followups',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by client_id),'[]'::jsonb)::text) from public.client_followups t),
 'memberships',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by organization_id,user_id),'[]'::jsonb)::text) from public.organization_members t),
 'capabilities',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by organization_id,user_id,module),'[]'::jsonb)::text) from public.staff_capabilities t),
 'assignments',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by organization_id,client_id,user_id),'[]'::jsonb)::text) from public.client_assignments t),
 'registry',(select jsonb_agg(to_jsonb(t) order by name) from app_private.aura_migrations t where name<>'migrations/20261016184133_student_objectives.sql'));
SQL
sql < "$run/verify-before-after.sql" > "$run/before.json"
sql < "$root/supabase/install.generated.sql" > "$run/upgrade.private.log" 2>&1
printf '%s\n' "NOTIFY pgrst, 'reload schema';" | sql > /dev/null
test "$(printf '%s\n' 'select count(*) from app_private.aura_migrations;' | sql)" = 11
sql < "$run/verify-before-after.sql" > "$run/after.json"
cmp --silent "$run/before.json" "$run/after.json" || { printf '%s\n' 'Existing data or migration history differs; upgrade NOT approved' >&2; exit 1; }
printf '%s\n' 'PASS: local upgrade 10→11; previous data, permissions and registry unchanged; private backup retained.'
