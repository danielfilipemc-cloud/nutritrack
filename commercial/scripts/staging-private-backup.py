"""Staging-only, opt-in GitHub job. Creates an encrypted backup, NOT recovery proof.

Only pg_dump/pg_dumpall/psql version lookup touch the remote database. No SQL
files are executed there. Raw dumps/errors stay in a private temp dir and are
removed. Public Actions artifacts must contain ciphertext only.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone

PROJECT = 'vgbwmamntjmhzrpvhxzb'
REPOSITORY = 'danielfilipemc-cloud/nutritrack'
BRANCH = 'refs/heads/ops/aura-staging-backup'
IMAGE = 'postgres@sha256:eee6c6e1b0894fa4fe0075eb054af9fd1cf39a35321c2d4110626cfe506411fb'
CONNECTION = ('host=aws-0-eu-west-1.pooler.supabase.com port=5432 dbname=postgres '
              'user=postgres.' + PROJECT + ' sslmode=verify-full '
              'sslrootcert=/run/aura-ca.pem connect_timeout=20 application_name=aura_private_backup')

# Public logs receive only one of these constants. Never interpolate exception
# payloads, stderr, command arguments, secret lengths or values into diagnostics.
ERRORS = {
    'BACKUP_CONTEXT_INVALID': 'Run only on the approved staging operations branch and push event.',
    'BACKUP_SHA_MISMATCH': 'The approved code SHA does not match this run.',
    'BACKUP_DB_SECRET_INVALID': 'The database secret is missing or contains forbidden line breaks.',
    'BACKUP_KEY_INVALID': 'Use a separate single-line backup passphrase with at least 32 characters.',
    'DB_AUTH_FAILED': 'PostgreSQL or the pooler rejected authentication.',
    'DB_POOLER_ROUTING_FAILED': 'The pooler could not locate the specified tenant or database user.',
    'DB_AUTH_RATE_LIMIT': 'The server is temporarily refusing authentication attempts; do not retry blindly.',
    'DB_TLS_FAILED': 'TLS certificate verification failed; keep verification enabled.',
    'DB_DNS_FAILED': 'The configured database hostname could not be resolved.',
    'DB_NETWORK_FAILED': 'The configured database endpoint could not be reached.',
    'DB_PERMISSION_DENIED': 'The database role cannot perform the requested read operation.',
    'DB_VERSION_UNEXPECTED': 'The server did not report the expected PostgreSQL major version.',
    'CLIENT_IMAGE_FAILED': 'The pinned PostgreSQL client image could not be prepared.',
    'LOCAL_TOOL_MISSING': 'A required runner program is unavailable.',
    'COMMAND_TIMEOUT': 'A bounded command timed out.',
    'PRIVATE_COMMAND_FAILED': 'A private command failed; its raw output was not published.',
    'UNEXPECTED_BACKUP_FAILURE': 'The runner could not complete the private backup.',
}


class BackupFailure(RuntimeError):
    def __init__(self, code):
        self.code = code if code in ERRORS else 'PRIVATE_COMMAND_FAILED'
        super().__init__(self.code)


def classify_failure(args, private_stderr):
    if args[:3] == ['docker', '--host=unix:///var/run/docker.sock', 'pull']:
        return 'CLIENT_IMAGE_FAILED'
    text = private_stderr.decode('utf-8', errors='replace').lower()
    # This examines only the private command's bounded error tail; none of that
    # text is returned. Precedence keeps routing/rate-limit distinct from auth.
    patterns = [
        ('DB_AUTH_RATE_LIMIT', ['too many authentication failures', 'circuit breaker open', 'too many login attempts']),
        ('DB_POOLER_ROUTING_FAILED', ['tenant or user not found', 'tenant not found']),
        ('DB_AUTH_FAILED', ['password authentication failed', 'sasl authentication failed', 'password is incorrect']),
        ('DB_TLS_FAILED', ['certificate verify failed', 'root certificate file', 'server certificate for', 'ssl error', 'server does not support ssl']),
        ('DB_DNS_FAILED', ['could not translate host name', 'name or service not known', 'temporary failure in name resolution']),
        ('DB_NETWORK_FAILED', ['connection timed out', 'timeout expired', 'network is unreachable', 'no route to host', 'connection refused']),
        ('DB_PERMISSION_DENIED', ['permission denied', 'must be superuser']),
    ]
    for code, needles in patterns:
        if any(needle in text for needle in needles):
            return code
    return 'PRIVATE_COMMAND_FAILED'


def report_failure(error):
    code = error.code if isinstance(error, BackupFailure) and error.code in ERRORS else 'UNEXPECTED_BACKUP_FAILURE'
    print('Backup stopped [' + code + ']: ' + ERRORS[code])
    print('No recovery or remote schema change was performed.')


def guard(env):
    if (env.get('GITHUB_ACTIONS') != 'true' or env.get('GITHUB_REPOSITORY') != REPOSITORY
            or env.get('GITHUB_REF') != BRANCH or env.get('GITHUB_EVENT_NAME') != 'push'):
        raise BackupFailure('BACKUP_CONTEXT_INVALID')
    approved = env.get('AURA_BACKUP_APPROVED_SHA', '')
    if len(approved) != 40 or any(c not in '0123456789abcdef' for c in approved) or approved != env.get('GITHUB_SHA'):
        raise BackupFailure('BACKUP_SHA_MISMATCH')
    password = env.get('AURA_STAGING_DB_PASSWORD', '')
    passphrase = env.get('AURA_BACKUP_PASSPHRASE', '')
    if not password or any(c in password for c in '\x00\r\n'):
        raise BackupFailure('BACKUP_DB_SECRET_INVALID')
    if len(passphrase) < 32 or any(c in passphrase for c in '\x00\r\n') or passphrase == password:
        raise BackupFailure('BACKUP_KEY_INVALID')


def safe_process(args, env, log, *, stdin=None, output=None, timeout=300):
    # Never emit raw subprocess errors: connection failures can contain secrets.
    with log.open('ab') as errors:
        error_start = errors.tell()
        target = output.open('wb') if output else errors
        try:
            result = subprocess.run(args, env=env, input=stdin, stdout=target, stderr=errors,
                                    timeout=timeout, check=False)
            if result.returncode:
                errors.flush()
                with log.open('rb') as private:
                    private.seek(max(error_start, log.stat().st_size - 65536))
                    tail = private.read(65536)
                raise BackupFailure(classify_failure(args, tail))
        except FileNotFoundError:
            raise BackupFailure('LOCAL_TOOL_MISSING') from None
        except subprocess.TimeoutExpired:
            raise BackupFailure('COMMAND_TIMEOUT') from None
        finally:
            if output:
                target.close()


def encrypt(archive, output, passphrase, log, env):
    safe_process(['gpg', '--batch', '--yes', '--no-symkey-cache', '--pinentry-mode', 'loopback', '--passphrase-fd', '0',
                  '--symmetric', '--cipher-algo', 'AES256', '--s2k-count', '65011712',
                  '--output', str(output), str(archive)], env, log,
                 stdin=(passphrase + '\n').encode(), timeout=120)


def main():
    env = dict(os.environ)
    guard(env)
    os.umask(0o077)
    output_dir = Path(env['RUNNER_TEMP']) / 'aura-encrypted-backup'
    output_dir.mkdir(mode=0o700, exist_ok=False)
    output = output_dir / 'aura-staging-private-backup.tar.gpg'
    child_env = dict(env)
    for key in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH',
                'AURA_STAGING_DB_PASSWORD', 'AURA_BACKUP_PASSPHRASE']:
        child_env.pop(key, None)
    child_env['PGPASSWORD'] = env['AURA_STAGING_DB_PASSWORD']
    try:
        with tempfile.TemporaryDirectory(prefix='aura-private-', dir=env['RUNNER_TEMP']) as tmp:
            root = Path(tmp)
            log = root / 'private-errors.log'
            # Use the ephemeral runner's local daemon only. No configurable host,
            # database, connection URL, project, image or output destination.
            docker = ['docker', '--host=unix:///var/run/docker.sock']
            print('Phase: pinned PostgreSQL client image', flush=True)
            safe_process(docker + ['pull', IMAGE], child_env, log)
            base = docker + ['run', '--rm', '--network', 'bridge', '-e', 'PGPASSWORD',
                             '--mount', 'type=bind,src=/etc/ssl/certs/ca-certificates.crt,dst=/run/aura-ca.pem,readonly',
                             '--mount', 'type=bind,src=' + str(root) + ',dst=/backup', IMAGE]
            print('Phase: staging connection and PostgreSQL version', flush=True)
            safe_process(base + ['psql', '--dbname=' + CONNECTION, '-XAt', '--no-password',
                                 '-c', 'show server_version_num'], child_env, log, output=root / 'version.txt')
            version = (root / 'version.txt').read_text().strip()
            if not version.isdigit() or not 170000 <= int(version) < 180000:
                raise BackupFailure('DB_VERSION_UNEXPECTED')
            print('Phase: database dump', flush=True)
            safe_process(base + ['pg_dump', '--dbname=' + CONNECTION, '--no-password', '--format=custom',
                                 '--lock-wait-timeout=10s', '--file=/backup/staging.dump'], child_env, log)
            print('Phase: role metadata without passwords', flush=True)
            safe_process(base + ['pg_dumpall', '--dbname=' + CONNECTION, '--no-password',
                                 '--roles-only', '--no-role-passwords'], child_env, log, output=root / 'roles.sql')
            print('Phase: archive catalogue validation (not restoration)', flush=True)
            safe_process(base + ['pg_restore', '--list', '/backup/staging.dump'], child_env, log,
                         output=root / 'archive-list.txt')
            files = ['staging.dump', 'roles.sql', 'archive-list.txt']
            manifest = {'project': PROJECT, 'createdAt': datetime.now(timezone.utc).isoformat(),
                        'sourceCodeSha': env['GITHUB_SHA'], 'serverVersion': version, 'clientImage': IMAGE,
                        'archiveCatalogueVerified': True, 'recoveryVerified': False,
                        'limitations': ['Storage objects are separate', 'Role passwords are excluded',
                                        'Vault recovery and platform configuration not verified',
                                        'Dump and role metadata are separate snapshots'],
                        'files': {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in files}}
            (root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
            with tarfile.open(root / 'private.tar', 'w') as archive:
                for name in files + ['manifest.json']:
                    archive.add(root / name, arcname=name)
            encryption_env = {k: v for k, v in child_env.items() if k != 'PGPASSWORD'}
            encryption_env['GNUPGHOME'] = str(root / 'gnupg')
            Path(encryption_env['GNUPGHOME']).mkdir(mode=0o700)
            print('Phase: private archive encryption', flush=True)
            encrypt(root / 'private.tar', output, env['AURA_BACKUP_PASSPHRASE'], log, encryption_env)
            (output_dir / 'SHA256.txt').write_text(hashlib.sha256(output.read_bytes()).hexdigest() + '  ' + output.name + '\n')
        print('Encrypted staging backup created. Archive catalogue checked. Recovery remains UNVERIFIED.')
    except BaseException:
        shutil.rmtree(output_dir, ignore_errors=True)
        raise


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        # Only allowlisted constants, never raw errors or traceback, are public.
        report_failure(error)
        raise SystemExit(1)
