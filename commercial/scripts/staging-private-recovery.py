"""Restore ONE frozen encrypted staging backup into a disposable, offline cluster.

No source connection, remote SQL, schema exclusions, --clean, or automatic retry.
The protected GitHub environment supplies the decryption key, never the DB password.
Private SQL/errors/data disappear with the temporary directory and container.
This proves database archive recovery only, not cloud/Auth/Storage recovery.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile
import time

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('staging-private-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

BACKUP_SHA = 'a72b72db0d903e35e025f5bef2ba11584ba6a919'
CIPHER_SHA = 'd38fc10b5147af9e18121a513c1cad47dad6918cbe0f88d66fbf56bbb363a70a'
SERVER_IMAGE = 'docker.io/supabase/postgres@sha256:5a213ad5fa0885bade074ce9c2835970a5ed59a813fb9019550041736d1bb85b'
BOOTSTRAP = 'aura_recovery_operator'
LABEL = 'aura.private-recovery'
FILES = {'staging.dump', 'roles.sql', 'archive-list.txt', 'manifest.json'}


class RecoveryFailure(RuntimeError):
    pass


def require(condition, code):
    if not condition:
        raise RecoveryFailure(code)


def guard(env):
    require(env.get('GITHUB_ACTIONS') == 'true' and env.get('GITHUB_REPOSITORY') == backup.REPOSITORY
            and env.get('GITHUB_REF') == backup.BRANCH and env.get('GITHUB_EVENT_NAME') == 'push', 'CONTEXT_INVALID')
    sha = env.get('GITHUB_SHA', '')
    require(re.fullmatch('[0-9a-f]{40}', sha) and sha == env.get('AURA_BACKUP_APPROVED_SHA'), 'SOURCE_NOT_APPROVED')
    key = env.get('AURA_BACKUP_PASSPHRASE', '')
    require(len(key) >= 32 and not any(c in key for c in '\x00\r\n'), 'KEY_INVALID')
    require(not env.get('AURA_STAGING_DB_PASSWORD'), 'UNNECESSARY_DB_SECRET')


def verify_cipher(folder):
    require({p.name for p in folder.iterdir()} == {'aura-staging-private-backup.tar.gpg', 'SHA256.txt'}, 'ARTIFACT_FILES_INVALID')
    require(all(p.is_file() and not p.is_symlink() for p in folder.iterdir()), 'ARTIFACT_FILES_INVALID')
    cipher = folder / 'aura-staging-private-backup.tar.gpg'
    require(cipher.is_file() and not cipher.is_symlink() and cipher.stat().st_size <= 1024**3, 'CIPHER_INVALID')
    require(hashlib.sha256(cipher.read_bytes()).hexdigest() == CIPHER_SHA, 'CIPHER_HASH_MISMATCH')
    require((folder / 'SHA256.txt').read_text().strip() == CIPHER_SHA + '  ' + cipher.name, 'CHECKSUM_FILE_INVALID')
    return cipher


def unpack(archive, destination):
    with tarfile.open(archive, 'r:') as tar:
        members = tar.getmembers()
        require(len(members) == len(FILES) and {m.name for m in members} == FILES, 'ARCHIVE_FILES_INVALID')
        require(all(m.isfile() and 0 <= m.size <= 1024**3 for m in members)
                and sum(m.size for m in members) <= 1024**3, 'ARCHIVE_MEMBER_INVALID')
        for member in members:
            with tar.extractfile(member) as stream:
                (destination / member.name).write_bytes(stream.read())
    manifest = json.loads((destination / 'manifest.json').read_text())
    require(manifest.get('project') == backup.PROJECT and manifest.get('sourceCodeSha') == BACKUP_SHA
            and manifest.get('clientImage') == backup.IMAGE and manifest.get('archiveCatalogueVerified') is True
            and manifest.get('recoveryVerified') is False and str(manifest.get('serverVersion', '')).isdigit()
            and 170000 <= int(manifest['serverVersion']) < 180000, 'MANIFEST_INVALID')
    require(set(manifest.get('files', {})) == FILES - {'manifest.json'}, 'MANIFEST_FILES_INVALID')
    for name, expected in manifest['files'].items():
        require(hashlib.sha256((destination / name).read_bytes()).hexdigest() == expected, 'ARCHIVE_HASH_MISMATCH')
    require(not re.search(r'\b' + BOOTSTRAP + r'\b', (destination / 'roles.sql').read_text()), 'BOOTSTRAP_ROLE_COLLISION')
    return manifest


def canonical_dump(data):
    # Track SQL lexical state so generated top-level comments can be omitted
    # without erasing multiline strings, quoted identifiers or function bodies.
    lines = []
    copying = False
    quote = None
    escaped = False
    dollar = None
    block = 0
    for line in data.decode('utf-8').split('\n'):
        if not copying and quote is None and dollar is None and not block and (
                line.startswith('--') or not line.strip()
                or re.fullmatch(r'\\(?:un)?restrict [A-Za-z0-9]+', line)):
            continue
        lines.append(line)
        if copying:
            if line == r'\.': copying = False
            continue
        if quote is None and dollar is None and not block and line.startswith('COPY ') and line.endswith(' FROM stdin;'):
            copying = True
            continue
        i = 0
        while i < len(line):
            if dollar:
                if line.startswith(dollar, i):
                    i += len(dollar)
                    dollar = None
                else: i += 1
            elif quote:
                if quote == "'" and escaped and line[i] == chr(92): i += 2
                elif line[i] == quote:
                    if i+1 < len(line) and line[i+1] == quote: i += 2
                    else:
                        quote = None
                        i += 1
                else: i += 1
            elif block:
                if line.startswith('/*', i):
                    block += 1
                    i += 2
                elif line.startswith('*/', i):
                    block -= 1
                    i += 2
                else: i += 1
            elif line.startswith('--', i): break
            elif line.startswith('/*', i):
                block = 1
                i += 2
            elif line[i] in ["'", '"']:
                quote = line[i]
                escaped = i > 0 and line[i-1] in 'Ee' and (i < 2 or not (line[i-2].isalnum() or line[i-2] == '_'))
                i += 1
            elif line[i] == '$' and (i == 0 or not (line[i-1].isalnum() or line[i-1] in '_$')):
                match = re.match(r'\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$', line[i:])
                if match:
                    dollar = match[0]
                    i += len(dollar)
                else: i += 1
            else: i += 1
    require(not copying and quote is None and dollar is None and not block, 'DUMP_SQL_UNTERMINATED')
    return '\n'.join(lines).encode()


class Cluster:
    def __init__(self, root, env, image=SERVER_IMAGE):
        self.root, self.env, self.image = root, env, image
        self.cid = None
        self.log = root / 'restore.private.log'

    def call(self, args, *, stdin=None, output=None, timeout=300):
        backup.safe_process(args, self.env, self.log, stdin=stdin, output=output, timeout=timeout)

    def docker(self, *args, **kwargs):
        return self.call(['docker', '--host=unix:///var/run/docker.sock', *args], **kwargs)

    def sql(self, sql, *, output=None):
        return self.docker('exec', '-i', self.cid, 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1',
                           '-h', '/tmp', '-U', BOOTSTRAP, '-d', 'postgres', stdin=sql.encode(), output=output)

    def start(self):
        # Bare initdb: none of the image's platform initialization SQL runs.
        # A unique bootstrap role allows the original roles.sql to run unchanged.
        self.docker('run', '-d', '--network=none', '--read-only', '--user=postgres',
                    '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=128',
                    '--memory=2g', '--cpus=2', '--label', LABEL + '=true',
                    '--tmpfs', '/tmp:rw,nosuid,nodev,size=1024m,mode=1777',
                    '--entrypoint', '/bin/sh', self.image, '-ec',
                    'initdb -D /tmp/aura-pg -U ' + BOOTSTRAP + ' --auth=trust --encoding=UTF8 --locale=C >/tmp/init.private.log 2>&1; '
                    'exec postgres -D /tmp/aura-pg -k /tmp -c listen_addresses= -c max_connections=20',
                    output=self.root / 'container.id')
        self.cid = (self.root / 'container.id').read_text().strip()
        require(re.fullmatch('[0-9a-f]{64}', self.cid), 'CONTAINER_ID_INVALID')
        self.docker('inspect', self.cid, output=self.root / 'container.json')
        info = json.loads((self.root / 'container.json').read_text())[0]
        require(info['HostConfig']['NetworkMode'] == 'none' and info['HostConfig']['ReadonlyRootfs']
                and not info['HostConfig'].get('Binds') and not info['HostConfig'].get('PortBindings')
                and info['Config']['Labels'].get(LABEL) == 'true', 'DESTINATION_NOT_ISOLATED')
        ready = False
        for _ in range(40):
            # A new process per readiness check; no remote socket is accepted.
            try:
                self.sql('select 1;', output=self.root / 'ready.txt')
                ready = (self.root / 'ready.txt').read_text().strip() == '1'
            except backup.BackupFailure:
                pass
            if ready: break
            time.sleep(0.5)
        require(ready, 'LOCAL_DATABASE_NOT_READY')

    def restore(self):
        self.sql("""select not exists(select 1 from pg_namespace where nspname not like 'pg_%'
                 and nspname not in ('public','information_schema'))
                 and not exists(select 1 from pg_class where relnamespace='public'::regnamespace)
                 and not exists(select 1 from pg_proc where pronamespace='public'::regnamespace)
                 and not exists(select 1 from pg_type where typnamespace='public'::regnamespace);""", output=self.root / 'empty.txt')
        require((self.root / 'empty.txt').read_text().strip() == 't', 'DESTINATION_NOT_EMPTY')
        self.sql((self.root / 'roles.sql').read_text())
        self.docker('exec', '-i', self.cid, '/bin/sh', '-ec', 'umask 077; cat > /tmp/staging.dump',
                    stdin=(self.root / 'staging.dump').read_bytes())
        self.docker('exec', self.cid, 'pg_restore', '--list', '/tmp/staging.dump', output=self.root / 'restore-toc.txt')
        # pg_dump omits initdb's standard public schema unless it was changed.
        # Remove ONLY the empty initdb schema when this archive recreates it.
        if re.search(r'^\d+; \d+ \d+ SCHEMA - public \S+', (self.root / 'restore-toc.txt').read_text(), re.MULTILINE):
            self.sql('drop schema public;')
        self.docker('exec', self.cid, 'pg_restore', '--exit-on-error', '--single-transaction',
                    '--verbose', '-h', '/tmp', '-U', BOOTSTRAP, '-d', 'postgres', '/tmp/staging.dump')

    def verify(self):
        self.docker('exec', self.cid, 'pg_dumpall', '-h', '/tmp', '-U', BOOTSTRAP,
                    '--roles-only', '--no-role-passwords', output=self.root / 'roles.actual.sql')
        actual_roles = '\n'.join(line for line in (self.root / 'roles.actual.sql').read_text().split('\n')
                                  if not line.startswith(('CREATE ROLE ' + BOOTSTRAP + ';', 'ALTER ROLE ' + BOOTSTRAP + ' WITH')))
        require(canonical_dump((self.root / 'roles.sql').read_bytes()) == canonical_dump(actual_roles.encode()),
                'ROLES_ROUNDTRIP_MISMATCH')
        for section in ['schema', 'data']:
            self.docker('exec', self.cid, 'pg_restore', '--' + section + '-only', '--file=-', '/tmp/staging.dump',
                        output=self.root / (section + '.expected.sql'))
            # Both original and restored output use PostgreSQL17.11 clients;
            # version comments and random psql guards are the only omissions.
            self.docker('exec', self.cid, 'pg_dump', '--' + section + '-only', '-h', '/tmp', '-U', BOOTSTRAP,
                        '-d', 'postgres', output=self.root / (section + '.actual.sql'))
            require(canonical_dump((self.root / (section + '.expected.sql')).read_bytes()) ==
                    canonical_dump((self.root / (section + '.actual.sql')).read_bytes()), section.upper() + '_ROUNDTRIP_MISMATCH')
        # No external binary or root encryption keys are in this DB archive.
        # Nonempty Storage/Vault cannot silently pass a database-only gate.
        self.sql("select (select count(*) from storage.objects)=0 and (select count(*) from storage.buckets)=0 and (select count(*) from vault.secrets)=0;", output=self.root / 'external.txt')
        require((self.root / 'external.txt').read_text().strip() == 't', 'EXTERNAL_RECOVERY_REQUIRED')
        self.sql("select jsonb_agg(jsonb_build_object('name',name,'checksum',checksum) order by name) from app_private.aura_migrations;", output=self.root / 'registry.txt')
        require(json.loads((self.root / 'registry.txt').read_text()) == json.loads(Path(__file__).with_name('staging-recovery-baseline.json').read_text()), 'BASELINE_NOT_SEVENTEEN')

    def close(self):
        if self.cid and re.fullmatch('[0-9a-f]{64}', self.cid):
            self.docker('rm', '-f', self.cid, timeout=30)
            self.cid = None


def main():
    env = dict(os.environ)
    guard(env)
    os.umask(0o077)
    cipher = verify_cipher(Path(env['RUNNER_TEMP']) / 'aura-recovery-input')
    child = {k: v for k, v in env.items() if k not in {'AURA_BACKUP_PASSPHRASE', 'AURA_STAGING_DB_PASSWORD',
              'PGPASSWORD', 'GH_TOKEN', 'GITHUB_TOKEN', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS',
              'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'}}
    with tempfile.TemporaryDirectory(prefix='aura-recovery-private-', dir=env['RUNNER_TEMP']) as tmp:
        root = Path(tmp)
        log = root / 'decrypt.private.log'
        child['GNUPGHOME'] = str(root / 'gnupg')
        Path(child['GNUPGHOME']).mkdir(mode=0o700)
        print('Phase: frozen ciphertext and private decryption', flush=True)
        backup.safe_process(['gpg', '--batch', '--no-symkey-cache', '--pinentry-mode', 'loopback', '--passphrase-fd', '0',
                             '--output', str(root / 'backup.tar'), '--decrypt', str(cipher)], child, log,
                            stdin=(env['AURA_BACKUP_PASSPHRASE'] + '\n').encode(), timeout=120)
        unpack(root / 'backup.tar', root)
        cluster = Cluster(root, child)
        try:
            print('Phase: pinned compatible database image', flush=True)
            cluster.docker('pull', SERVER_IMAGE)
            print('Phase: new offline empty cluster', flush=True)
            cluster.start()
            print('Phase: all roles and full archive restoration', flush=True)
            cluster.restore()
            print('Phase: schema data permissions and external-dependency verification', flush=True)
            cluster.verify()
        finally:
            cluster.close()
    print('PASS: complete database archive restored offline; schema/data roundtrip matches. Cloud/Auth service recovery and nutrition activation remain pending.')


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        allowed = {'CONTEXT_INVALID', 'SOURCE_NOT_APPROVED', 'KEY_INVALID', 'UNNECESSARY_DB_SECRET',
                   'ARTIFACT_FILES_INVALID', 'CIPHER_INVALID', 'CIPHER_HASH_MISMATCH', 'CHECKSUM_FILE_INVALID',
                   'ARCHIVE_FILES_INVALID', 'ARCHIVE_MEMBER_INVALID', 'MANIFEST_INVALID', 'MANIFEST_FILES_INVALID',
                   'ARCHIVE_HASH_MISMATCH', 'BOOTSTRAP_ROLE_COLLISION', 'CONTAINER_ID_INVALID',
                   'DESTINATION_NOT_ISOLATED', 'LOCAL_DATABASE_NOT_READY', 'DESTINATION_NOT_EMPTY',
                   'SCHEMA_ROUNDTRIP_MISMATCH', 'DATA_ROUNDTRIP_MISMATCH', 'EXTERNAL_RECOVERY_REQUIRED',
                   'BASELINE_NOT_SEVENTEEN', 'DUMP_SQL_UNTERMINATED', 'ROLES_ROUNDTRIP_MISMATCH'}
        code = str(error) if isinstance(error, RecoveryFailure) and str(error) in allowed else 'PRIVATE_RECOVERY_FAILED'
        print('Recovery stopped [' + code + ']. No remote SQL or migration was performed.')
        raise SystemExit(1)
