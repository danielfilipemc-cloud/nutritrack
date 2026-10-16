#!/usr/bin/env bash
# Synthetic local baseline8 only. Does not reset/delete a destination or link cloud.
set -euo pipefail
umask 077
mode=${1:-}
case "$mode" in backup|restore|verify) ;; *) printf '%s\n' 'Use backup, restore or verify' >&2; exit 1;; esac
grep -qx AURA-Dev /etc/aura-development-runtime
test "${DOCKER_HOST:-unix:///var/run/docker.sock}" = unix:///var/run/docker.sock
test "$(docker context inspect --format '{{.Endpoints.docker.Host}}')" = unix:///var/run/docker.sock
export PATH=/opt/aura/node-v22.23.3-linux-x64/bin:$PATH
commercial_root=$(cd -- "$(dirname -- "$0")/.." && pwd)
backup=${AURA_LOCAL_BACKUP_DIR:-/mnt/e/AURA-Development-20261014/backups/supabase-baseline-20261014}
[[ "$backup" =~ ^/mnt/[a-z]/AURA-Development-[0-9]{8}/backups/[a-zA-Z0-9_-]+$ ]] || { printf '%s\n' 'Dedicated local backup path required' >&2; exit 1; }
source_db=supabase_db_aura-foundations-local
instance=${2:-restore}
case "$instance" in restore|rehearsal) ;; *) printf '%s\n' 'Only restore or rehearsal local destinations are permitted' >&2; exit 1;; esac
restored_db="supabase_db_aura-foundations-$instance"
output="$commercial_root/.aura-integration/local-runtime/$instance"
sql(){ docker exec -i "$1" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -At; }
if test "$mode" = backup; then
 test ! -e "$backup"
 test "$(printf '%s\n' 'select count(*) from app_private.aura_migrations;' | sql "$source_db")" = 8
 available_kib=$(df -Pk -- "$(dirname -- "$backup")" | awk 'NR==2 {print $4}')
 [[ "$available_kib" =~ ^[0-9]+$ ]] && test "$available_kib" -ge 10485760
 mkdir -m 0700 "$backup"
 runtime="$commercial_root/.aura-integration/local-runtime/baseline"
 sb(){ npm exec --cache /var/cache/aura-npm --yes --package=supabase@2.120.0 -- supabase --workdir "$runtime" "$@"; }
 sql "$source_db" < "$commercial_root/scripts/local-baseline-fingerprint.sql" > "$backup/baseline-fingerprints.json"
 sb db dump --local --role-only --file "$backup/roles.sql" > "$backup/dump.private.log" 2>&1
 sb db dump --local --file "$backup/schema.sql" >> "$backup/dump.private.log" 2>&1
 sb db dump --local --data-only --use-copy --file "$backup/data.sql" >> "$backup/dump.private.log" 2>&1
 grep -Fq 'COPY "app_private"."aura_migrations"' "$backup/data.sql"
 grep -Fq 'COPY "auth"."users"' "$backup/data.sql"
 cd "$backup"
 sha256sum roles.sql schema.sql data.sql baseline-fingerprints.json > SHA256SUMS
 sha256sum --check SHA256SUMS
 printf '%s\n' 'Synthetic baseline8 backup created; private dumps are not publication artifacts.'
 exit 0
fi
test -d "$output"
# Container names alone are not sufficient proof of a local isolated database.
port=58322
if test "$instance" = rehearsal; then port=59322; fi
test "$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostIp}}' "$restored_db")" = 127.0.0.1
test "$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$restored_db")" = "$port"
cd "$backup"
sha256sum --check SHA256SUMS
if test "$mode" = restore; then
 test ! -e "$output/restore.private.log"
 empty=$(printf '%s\n' "select to_regclass('app_private.aura_migrations') is null and (select count(*) from auth.users)=0;" | sql "$restored_db")
 test "$empty" = t
 # Defaults on an existing Supabase platform can silently add object grants.
 # Normalize object ACLs INSIDE the restore transaction before exposing restored data.
 {
  cat roles.sql
  cat schema.sql
  printf '%s\n' 'SET session_replication_role = replica;'
  cat data.sql
  printf '%s\n' 'SET session_replication_role = origin;'
  printf '%s\n' 'REVOKE ALL ON ALL TABLES IN SCHEMA public,app_private FROM PUBLIC,anon,authenticated,service_role;'
  printf '%s\n' 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public,app_private FROM PUBLIC,anon,authenticated,service_role;'
  printf '%s\n' 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public,app_private FROM PUBLIC,anon,authenticated,service_role;'
  # This tool is restricted to the reviewed AURA baseline schema, whose ACL
  # statements are single-line pg_dump output. Never use arbitrary SQL input here.
  grep -E '^(GRANT|REVOKE) ' schema.sql
  printf '%s\n' "NOTIFY pgrst, 'reload schema';"
 } | docker exec -i "$restored_db" psql -X -v ON_ERROR_STOP=1 --single-transaction --file=- -U postgres -d postgres > "$output/restore.private.log" 2>&1
fi
sql "$restored_db" < "$commercial_root/scripts/local-baseline-fingerprint.sql" > "$output/restored-fingerprints.json"
node -e 'const fs=require("node:fs");const expected=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const actual=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));if(Object.keys(expected).length!==Object.keys(actual).length||!Object.keys(expected).every(key=>expected[key]===actual[key]))process.exit(1);' baseline-fingerprints.json "$output/restored-fingerprints.json" || { printf '%s\n' 'Restored data or authorization differs: recovery is NOT approved' >&2; exit 1; }
printf '%s\n' 'PASS: baseline8 fingerprints match. Also run restored Auth/JWT verification before approving recovery.'
