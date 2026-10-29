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
tls_spec = importlib.util.spec_from_file_location('tlscheck', Path(__file__).resolve().parents[1] / 'scripts/staging-backup-tls-check.py')
tlscheck = importlib.util.module_from_spec(tls_spec)
tls_spec.loader.exec_module(tlscheck)


def environment(tmp):
    return {'GITHUB_ACTIONS': 'true', 'GITHUB_REPOSITORY': backup.REPOSITORY, 'GITHUB_REF': backup.BRANCH,
            'GITHUB_EVENT_NAME': 'push', 'GITHUB_SHA': 'a' * 40, 'AURA_BACKUP_APPROVED_SHA': 'a' * 40,
            'AURA_STAGING_DB_PASSWORD': 'fictional-db-password', 'AURA_BACKUP_PASSPHRASE': 'fictional-test-key-' + 'x' * 40,
            'RUNNER_TEMP': tmp, 'PATH': os.environ['PATH']}


class BackupTests(unittest.TestCase):
    def test_tls_probe_sends_only_ssl_request_and_checks_fixed_hostname(self):
        import ssl
        import struct
        sent = []

        class Stream:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def sendall(self, value): sent.append(value)
            def recv(self, size): return b'S'
            def version(self): return 'TLSv1.3'

        class Context:
            check_hostname = True
            verify_mode = ssl.CERT_REQUIRED
            minimum_version = None

            def wrap_socket(self, stream, *, server_hostname):
                self.hostname = server_hostname
                return Stream()

        context = Context()
        with patch.object(tlscheck.ssl, 'create_default_context', return_value=context), patch.object(tlscheck.socket, 'create_connection', return_value=Stream()) as connect:
            result = tlscheck.probe(Path('/fictional-ca.pem'))
        connect.assert_called_once_with((backup.HOST, 5432), timeout=20)
        self.assertEqual(sent, [struct.pack('!II', 8, 80877103)])
        self.assertEqual(context.hostname, backup.HOST)
        self.assertEqual(context.minimum_version, ssl.TLSVersion.TLSv1_2)
        self.assertFalse(result['authenticationAttempted'])
        self.assertFalse(result['sqlExecuted'])

    def test_tls_probe_refuses_unverified_context_before_network(self):
        import ssl
        context = type('Context', (), {'check_hostname': False, 'verify_mode': ssl.CERT_REQUIRED})()
        with patch.object(tlscheck.ssl, 'create_default_context', return_value=context), patch.object(tlscheck.socket, 'create_connection') as connect:
            with self.assertRaises(RuntimeError):
                tlscheck.probe(Path('/fictional-ca.pem'))
        connect.assert_not_called()

    def test_tls_probe_has_no_local_or_private_secret_execution(self):
        for env in [{}, {'GITHUB_ACTIONS': 'true', 'GITHUB_REPOSITORY': backup.REPOSITORY, 'AURA_STAGING_DB_PASSWORD': 'private-canary'}]:
            with patch.dict(os.environ, env, clear=True), patch.object(tlscheck, 'probe') as probe, contextlib.redirect_stdout(io.StringIO()) as capture:
                self.assertEqual(tlscheck.main(), 1)
            probe.assert_not_called()
            self.assertNotIn('private-canary', capture.getvalue())

    def test_reviewed_certificate_bundle_preserves_system_roots_and_rejects_tampering(self):
        import ssl
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            system = root / 'system.pem'
            system.write_bytes(b'# synthetic system root sentinel\n')
            combined = backup.build_ca_bundle(root / 'combined.pem', system)
            self.assertTrue(combined.read_bytes().startswith(system.read_bytes()))
            context = ssl.create_default_context(cafile=str(combined))
            self.assertTrue(context.check_hostname)
            self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
            corrupted = root / 'changed.pem'
            corrupted.write_bytes(backup.SUPABASE_CA.read_bytes() + b'changed')
            with patch.object(backup, 'SUPABASE_CA', corrupted):
                with self.assertRaises(backup.BackupFailure) as raised:
                    backup.build_ca_bundle(root / 'bad.pem', system)
            self.assertEqual(raised.exception.code, 'CA_CERTIFICATE_INVALID')
            self.assertFalse((root / 'bad.pem').exists())

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
                if 'run' in args:
                    ca = next(a for a in args if a.endswith(',dst=/run/aura-ca.pem,readonly'))
                    self.assertIn('trusted-ca.pem', ca)
                    self.assertNotIn('src=/etc/ssl/', ca)
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
                self.assertEqual(manifest['supabaseRootCertificateSha256'], backup.SUPABASE_CA_SHA256)
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
