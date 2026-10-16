#!/usr/bin/env bash
set -euo pipefail
umask 077
instance=${1:-baseline}
case "$instance" in baseline|restore|rehearsal|cloud-recovery) ;; *) printf '%s\n' 'Only named synthetic local runtimes are permitted' >&2; exit 1;; esac
case "${2:-}" in ''|--keep-alive) ;; *) printf '%s\n' 'Optional second argument: --keep-alive' >&2; exit 1;; esac
grep -qx AURA-Dev /etc/aura-development-runtime || { printf '%s\n' 'Dedicated AURA-Dev runtime marker required' >&2; exit 1; }
host_storage=$(cat /etc/aura-development-storage)
[[ "$host_storage" =~ ^/mnt/[a-z]$ ]] || { printf '%s\n' 'Verified Windows backing volume marker required' >&2; exit 1; }
available_kib=$(df -Pk -- "$host_storage" | awk 'NR==2 {print $4}')
[[ "$available_kib" =~ ^[0-9]+$ ]] && test "$available_kib" -ge 10485760 || { printf '%s\n' 'At least 10 GiB free on the Windows backing volume is required before pulling images' >&2; exit 1; }
findmnt -no OPTIONS / | grep -Eq '(^|,)rw(,|$)' || { printf '%s\n' 'WSL root filesystem must be healthy and writable' >&2; exit 1; }
export PATH=/opt/aura/node-v22.23.3-linux-x64/bin:$PATH
test "$(node -p process.versions.node)" = 22.23.3
test "${DOCKER_HOST:-unix:///var/run/docker.sock}" = unix:///var/run/docker.sock
test "$(docker context inspect --format '{{.Endpoints.docker.Host}}')" = unix:///var/run/docker.sock
test "$(docker info --format '{{.OSType}}')" = linux
network="aura-foundations-loopback-$instance"
if test -n "$(docker network ls --filter "name=^$network$" --format '{{.Name}}')"; then
 test "$(docker network inspect --format '{{.Driver}}' "$network")" = bridge
 test "$(docker network inspect --format '{{ index .Options "com.docker.network.bridge.host_binding_ipv4" }}' "$network")" = 127.0.0.1
 test "$(docker network inspect --format '{{ index .Labels "com.aura.synthetic" }}' "$network")" = true
else
 docker network create --label com.aura.synthetic=true -o com.docker.network.bridge.host_binding_ipv4=127.0.0.1 "$network" >/dev/null
fi
commercial_root=$(cd -- "$(dirname -- "$0")/.." && pwd)
runtime="$commercial_root/.aura-integration/local-runtime/$instance"
mkdir -p "$runtime/supabase/migrations"
if test -n "$(find "$runtime/supabase/migrations" -maxdepth 1 -type f -print -quit)"; then
 printf '%s\n' 'Automatic app migrations are prohibited in this runtime; review the nonempty migrations directory' >&2
 exit 1
fi
template="$commercial_root/supabase/local-validation/config.toml"
if test "$instance" = restore; then
 sed -e 's/aura-foundations-local/aura-foundations-restore/g' -e 's/573/583/g' "$template" > "$runtime/config.expected.toml"
elif test "$instance" = rehearsal; then
 sed -e 's/aura-foundations-local/aura-foundations-rehearsal/g' -e 's/573/593/g' "$template" > "$runtime/config.expected.toml"
elif test "$instance" = cloud-recovery; then
 sed -e 's/aura-foundations-local/aura-foundations-cloud-recovery/g' -e 's/573/603/g' "$template" > "$runtime/config.expected.toml"
else
 cat "$template" > "$runtime/config.expected.toml"
fi
if test -e "$runtime/supabase/config.toml"; then
 cmp --silent "$runtime/config.expected.toml" "$runtime/supabase/config.toml" || { printf '%s\n' 'Existing configuration differs: review rather than overwrite' >&2; exit 1; }
else
 cp --no-clobber "$runtime/config.expected.toml" "$runtime/supabase/config.toml"
fi
npm exec --cache /var/cache/aura-npm --yes --package=supabase@2.120.0 -- supabase --workdir "$runtime" --network-id "$network" start --exclude studio,postgres-meta,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor > "$runtime/start.private.log" 2>&1
printf '%s\n' "Local $instance runtime started. Private startup output is ignored by Git. No AURA migrations applied by this script."
if test "${2:-}" = --keep-alive; then
 printf '%s\n' 'Keeping this WSL session open for local development. Close it with Ctrl+C when finished.'
 exec sleep infinity
fi
