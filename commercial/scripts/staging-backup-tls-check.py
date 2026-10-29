"""Fixed staging TLS handshake only. No password, login, SQL or backup.

Run in the credential-free GitHub CI job, not from restricted local networks.
Uses the exact reviewed CA-bundle builder consumed by the private dump client.
"""
import importlib.util
import json
import os
from pathlib import Path
import socket
import ssl
import struct
import sys
import tempfile
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('staging-private-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


def probe(bundle):
    context = ssl.create_default_context(cafile=str(bundle))
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    if not context.check_hostname or context.verify_mode != ssl.CERT_REQUIRED:
        raise RuntimeError('Unverified TLS context refused')
    with socket.create_connection((backup.HOST, 5432), timeout=20) as stream:
        stream.sendall(struct.pack('!II', 8, 80877103))  # PostgreSQL SSLRequest only.
        if stream.recv(1) != b'S':
            raise RuntimeError('TLS not accepted')
        with context.wrap_socket(stream, server_hostname=backup.HOST) as secured:
            return {'verified': True, 'hostname': backup.HOST, 'tlsVersion': secured.version(),
                    'authenticationAttempted': False, 'sqlExecuted': False}


def main():
    if os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('GITHUB_REPOSITORY') != backup.REPOSITORY:
        print('TLS probe requires the configured GitHub CI context; no network attempted.')
        return 1
    # This job must not receive the private backup secrets at all.
    if os.environ.get('AURA_STAGING_DB_PASSWORD') or os.environ.get('AURA_BACKUP_PASSPHRASE'):
        print('TLS probe refuses a private-secret context; no network attempted.')
        return 1
    try:
        with tempfile.TemporaryDirectory(prefix='aura-public-tls-') as tmp:
            result = probe(backup.build_ca_bundle(Path(tmp) / 'ca.pem'))
        print(json.dumps(result))
        return 0
    except ssl.SSLCertVerificationError as error:
        # Numeric OpenSSL verification code only; no raw exception or payload.
        print(json.dumps({'verified': False, 'certificateVerifyCode': error.verify_code,
                          'authenticationAttempted': False, 'sqlExecuted': False}))
    except BaseException:
        print(json.dumps({'verified': False, 'authenticationAttempted': False, 'sqlExecuted': False}))
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
