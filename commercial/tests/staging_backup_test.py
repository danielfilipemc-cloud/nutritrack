import importlib.util
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('backup', Path(__file__).resolve().parents[1] / 'scripts/staging-private-backup.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


def environment(tmp):
    return {'GITHUB_ACTIONS': 'true', 'GITHUB_REPOSITORY': backup.REPOSITORY, 'GITHUB_REF': backup.BRANCH,
            'GITHUB_EVENT_NAME': 'push', 'GITHUB_SHA': 'a' * 40, 'AURA_BACKUP_APPROVED_SHA': 'a' * 40,
            'AURA_STAGING_DB_PASSWORD': 'fictional-db-password', 'AURA_BACKUP_PASSPHRASE': 'fictional-test-key-' + 'x' * 40,
            'RUNNER_TEMP': tmp, 'PATH': os.environ['PATH']}


class BackupTests(unittest.TestCase):
    def test_rejects_other_repository_refs_events_missing_secret_and_unapproved_code(self):
        env = environment('/tmp')
        backup.guard(env)
        for key, values in {'GITHUB_REF': ['refs/heads/main', 'refs/heads/integration/aura-staging', 'refs/pull/71/merge'],
                            'GITHUB_REPOSITORY': ['foreign/nutritrack'], 'GITHUB_EVENT_NAME': ['pull_request', 'workflow_dispatch'],
                            'AURA_BACKUP_APPROVED_SHA': ['', 'b' * 40], 'AURA_BACKUP_PASSPHRASE': ['', env['AURA_STAGING_DB_PASSWORD']],
                            'AURA_STAGING_DB_PASSWORD': ['', 'bad\npassword']}.items():
            for value in values:
                with self.assertRaises(backup.BackupFailure):
                    backup.guard({**env, key: value})

    def test_safe_failure_codes_distinguish_configuration_tls_auth_routing_and_network(self):
        args = ['docker', '--host=unix:///var/run/docker.sock', 'run', 'psql']
        cases = {'password authentication failed for user "private"': 'DB_AUTH_FAILED',
                 'SASL authentication failed': 'DB_AUTH_FAILED',
                 'FATAL: Tenant or user not found': 'DB_POOLER_ROUTING_FAILED',
                 'Too many authentication failures': 'DB_AUTH_RATE_LIMIT',
                 'SSL error: certificate verify failed': 'DB_TLS_FAILED',
                 'root certificate file is not accessible': 'DB_TLS_FAILED',
                 'could not translate host name': 'DB_DNS_FAILED',
                 'connection refused': 'DB_NETWORK_FAILED',
                 'permission denied for table': 'DB_PERMISSION_DENIED',
                 'unrecognized arbitrary secret payload': 'PRIVATE_COMMAND_FAILED'}
        for private, code in cases.items():
            self.assertEqual(backup.classify_failure(args, private.encode()), code)
        self.assertEqual(backup.classify_failure(['docker', '--host=unix:///var/run/docker.sock', 'pull', 'image'], b'anything'), 'CLIENT_IMAGE_FAILED')
        env = environment('/tmp')
        for key, value, expected in [('AURA_STAGING_DB_PASSWORD', '', 'BACKUP_DB_SECRET_INVALID'),
                                     ('AURA_BACKUP_PASSPHRASE', 'short', 'BACKUP_KEY_INVALID')]:
            with self.assertRaises(backup.BackupFailure) as raised:
                backup.guard({**env, key: value})
            self.assertEqual(raised.exception.code, expected)

    def test_public_diagnostics_never_include_raw_errors_or_secret_values(self):
        private = 'do-not-print-password-123'
        errors = [RuntimeError(private), backup.BackupFailure(private),
                  backup.BackupFailure('DB_AUTH_FAILED'), subprocess.TimeoutExpired(private, 1)]
        for error in errors:
            with contextlib.redirect_stdout(io.StringIO()) as capture:
                backup.report_failure(error)
            self.assertNotIn(private, capture.getvalue())
            self.assertNotIn('Traceback', capture.getvalue())

    def test_process_classifies_only_its_error_tail_and_does_not_echo_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / 'private.log'
            log.write_text('password authentication failed from a previous command\n')
            script = 'import sys;sys.stderr.write("FATAL: Tenant or user not found private-canary");sys.exit(1)'
            with contextlib.redirect_stdout(io.StringIO()) as capture:
                with self.assertRaises(backup.BackupFailure) as raised:
                    backup.safe_process([sys.executable, '-c', script], dict(os.environ), log)
                backup.report_failure(raised.exception)
            self.assertEqual(raised.exception.code, 'DB_POOLER_ROUTING_FAILED')
            self.assertNotIn('private-canary', capture.getvalue())

    def test_real_encryption_roundtrip_and_cleanup_with_synthetic_remote_commands(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = environment(tmp)
            original = backup.safe_process
            commands = []

            def synthetic(args, child_env, log, **kwargs):
                if args[0] == 'gpg':
                    self.assertNotIn('PGPASSWORD', child_env)
                    return original(args, child_env, log, **kwargs)
                commands.append(args)
                self.assertEqual(args[:2], ['docker', '--host=unix:///var/run/docker.sock'])
                self.assertNotIn(env['AURA_STAGING_DB_PASSWORD'], ' '.join(args))
                if 'pg_dump' in args:
                    mount = next(a for a in args if a.startswith('type=bind,src=') and a.endswith(',dst=/backup'))
                    root = Path(mount.removeprefix('type=bind,src=').removesuffix(',dst=/backup'))
                    (root / 'staging.dump').write_bytes(b'PGDMP-synthetic-private-data')
                if kwargs.get('output'):
                    output = kwargs['output']
                    output.write_text('170011\n' if 'psql' in args else '-- synthetic metadata\n')

            with patch.dict(os.environ, env, clear=True), patch.object(backup, 'safe_process', synthetic):
                backup.main()
            output = Path(tmp) / 'aura-encrypted-backup'
            self.assertEqual(sorted(p.name for p in output.iterdir()), ['SHA256.txt', 'aura-staging-private-backup.tar.gpg'])
            self.assertFalse(list(Path(tmp).glob('aura-private-*')))
            cipher = output / 'aura-staging-private-backup.tar.gpg'
            self.assertNotIn(b'synthetic-private-data', cipher.read_bytes())
            keyring = Path(tmp) / 'decrypt-keyring'
            keyring.mkdir(mode=0o700)
            result = subprocess.run(['gpg', '--batch', '--pinentry-mode', 'loopback', '--homedir', str(keyring),
                                     '--passphrase-fd', '0', '--decrypt', str(cipher)], input=(env['AURA_BACKUP_PASSPHRASE'] + '\n').encode(),
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            with tarfile.open(fileobj=io.BytesIO(result.stdout)) as archive:
                manifest = json.load(archive.extractfile('manifest.json'))
                self.assertFalse(manifest['recoveryVerified'])
                self.assertEqual(manifest['project'], backup.PROJECT)
                self.assertEqual(archive.extractfile('staging.dump').read(), b'PGDMP-synthetic-private-data')
            remote = [a for a in commands if '--dbname=' + backup.CONNECTION in a]
            self.assertEqual(len(remote), 3)
            self.assertTrue(all('sslmode=verify-full' in ' '.join(a) for a in remote))
            self.assertTrue(all(any(c in a for c in ['psql', 'pg_dump', 'pg_dumpall']) for a in remote))

    def test_partial_ciphertext_and_raw_temporary_files_removed_on_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            def fail(*args, **kwargs):
                raise RuntimeError('synthetic failure')
            with patch.dict(os.environ, environment(tmp), clear=True), patch.object(backup, 'safe_process', fail):
                with self.assertRaises(RuntimeError):
                    backup.main()
            self.assertEqual(list(Path(tmp).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
