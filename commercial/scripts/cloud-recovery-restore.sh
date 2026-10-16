#!/usr/bin/env bash
set -euo pipefail
umask 077
grep -qx AURA-Dev /etc/aura-development-runtime
test "${DOCKER_HOST:-unix:///var/run/docker.sock}" = unix:///var/run/docker.sock
test "$(docker context inspect --format '{{.Endpoints.docker.Host}}')" = unix:///var/run/docker.sock
root=$(cd -- "$(dirname -- "$0")/.." && pwd)
container=supabase_db_aura-foundations-cloud-recovery
test "$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostIp}}' "$container")" = 127.0.0.1
test "$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$container")" = 60322
sql(){ docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -At; }
test "$(printf '%s\n' 'select not exists(select 1 from auth.users);' | sql)" = t
sql < "$root/.aura-integration/cloud-recovery/restore.generated.private.sql" > "$root/.aura-integration/cloud-recovery/restore.private.log" 2>&1
sql < "$root/.aura-integration/cloud-recovery/verify.generated.private.sql" > "$root/.aura-integration/cloud-recovery/restored.private.json"
printf '%s\n' 'PASS: approved synthetic cloud archive restored into fresh loopback destination; source unchanged.'
