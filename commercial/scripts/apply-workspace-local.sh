#!/usr/bin/env bash
# Additive synthetic loopback upgrades only; no reset, deletion or cloud connection.
set -euo pipefail
umask 077
expected=${1:?expected registry count};target=${2:?target registry count}
case "$expected:$target" in 11:12|12:13|13:14) ;; *) exit 1;; esac
grep -qx AURA-Dev /etc/aura-development-runtime
test "${DOCKER_HOST:-unix:///var/run/docker.sock}" = unix:///var/run/docker.sock
test "$(docker context inspect --format '{{.Endpoints.docker.Host}}')" = unix:///var/run/docker.sock
root=$(cd -- "$(dirname -- "$0")/.." && pwd)
container=supabase_db_aura-foundations-local
test "$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostIp}}' "$container")" = 127.0.0.1
test "$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$container")" = 57322
sql(){ docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres --no-psqlrc -At; }
test "$(printf '%s\n' 'select count(*) from app_private.aura_migrations;' | sql)" = "$expected"
test "$(printf '%s\n' "select count(*) from auth.users where coalesce(raw_app_meta_data->>'synthetic','false')<>'true';" | sql)" = 0
test "$(grep -c 'insert into app_private.aura_migrations(name,checksum)' "$root/supabase/install.generated.sql")" = "$target"
run=$(mktemp -d "$root/.aura-integration/workspace-upgrade-XXXXXXXX")
docker exec "$container" pg_dump -U postgres -d postgres --format=custom > "$run/before.private.dump"
test -s "$run/before.private.dump"
sha256sum "$run/before.private.dump" > "$run/SHA256SUMS"
# All existing application rows, not just selected modules, must remain unchanged.
printf '%s\n' "select string_agg(format('select %L as relation,md5(coalesce(jsonb_agg((to_jsonb(t)-''source_system''-''source_link_id''-''source_record_id''-''source_revision'') order by (to_jsonb(t)-''source_system''-''source_link_id''-''source_record_id''-''source_revision'')::text),\$\$[]\$\$::jsonb)::text) as fingerprint from %I.%I t;',schemaname||'.'||tablename,schemaname,tablename),' ' order by schemaname,tablename) from pg_tables where schemaname in ('public','app_private') and tablename<>'aura_migrations';" | sql > "$run/fingerprint.sql"
sql < "$run/fingerprint.sql" > "$run/before.txt"
printf '%s\n' 'select name,checksum,applied_at from app_private.aura_migrations order by name;' | sql > "$run/registry-before.txt"
sql < "$root/supabase/install.generated.sql" > "$run/upgrade.private.log" 2>&1
test "$(printf '%s\n' 'select count(*) from app_private.aura_migrations;' | sql)" = "$target"
sql < "$run/fingerprint.sql" > "$run/after.txt"
cmp --silent "$run/before.txt" "$run/after.txt"
# Compare the original registry rows verbatim, excluding newly added names.
while IFS= read -r row;do printf '%s\n' "$row" | grep -Fqx -f - <(printf '%s\n' 'select name,checksum,applied_at from app_private.aura_migrations order by name;' | sql);done < "$run/registry-before.txt"
printf '%s\n' "NOTIFY pgrst, 'reload schema';" | sql > /dev/null
printf 'PASS: local additive upgrade %s→%s; all prior application rows and registry unchanged; backup retained.\n' "$expected" "$target"
