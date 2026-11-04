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


def guard(env):
    if (env.get('GITHUB_ACTIONS') != 'true' or env.get('GITHUB_REPOSITORY') != REPOSITORY
            or env.get('GITHUB_REF') != BRANCH or env.get('GITHUB_EVENT_NAME') != 'push'):
        raise ValueError('This job only runs on the approved staging operations branch.')
    approved = env.get('AURA_BACKUP_APPROVED_SHA', '')
    if len(approved) != 40 or any(c not in '0123456789abcdef' for c in approved) or approved != env.get('GITHUB_SHA'):
        raise ValueError('Approved source SHA is missing or differs from this job.')
    password = env.get('AURA_STAGING_DB_PASSWORD', '')
    passphrase = env.get('AURA_BACKUP_PASSPHRASE', '')
    if not password or any(c in password for c in '\x00\r\n'):
        raise ValueError('Staging database password is missing or malformed.')
    if len(passphrase) < 32 or any(c in passphrase for c in '\x00\r\n') or passphrase == password:
        raise ValueError('Use a separate backup passphrase of at least 32 characters.')


def safe_process(args, env, log, *, stdin=None, output=None, timeout=300):
    # Never emit raw subprocess errors: connection failures can contain secrets.
    with log.open('ab') as errors:
        target = output.open('wb') if output else errors
        try:
            result = subprocess.run(args, env=env, input=stdin, stdout=target, stderr=errors,
                                    timeout=timeout, check=False)
            if result.returncode:
                raise RuntimeError('Private backup phase failed; no migration was run.')
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
                raise RuntimeError('Unexpected staging PostgreSQL major version.')
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
    except BaseException:
        # No traceback or exception payload: runner logs are public in this repo.
        print('Backup not completed. No remote schema change or recovery was performed.')
        raise SystemExit(1)
