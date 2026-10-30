import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('recovery', Path(__file__).resolve().parents[1] / 'scripts/staging-private-recovery.py')
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class RecoveryTests(unittest.TestCase):
    def test_rejects_remote_context_unapproved_source_and_unnecessary_db_secret(self):
        env = {'GITHUB_ACTIONS': 'true', 'GITHUB_REPOSITORY': recovery.backup.REPOSITORY,
               'GITHUB_REF': recovery.backup.BRANCH, 'GITHUB_EVENT_NAME': 'push',
               'GITHUB_SHA': 'a'*40, 'AURA_BACKUP_APPROVED_SHA': 'a'*40,
               'AURA_BACKUP_PASSPHRASE': 'fictional-key-'+'x'*40}
        recovery.guard(env)
        for key, value in [('GITHUB_REF','refs/heads/main'),('GITHUB_REF','refs/heads/integration/aura-staging'),
                           ('GITHUB_EVENT_NAME','pull_request'),('GITHUB_REPOSITORY','foreign/repo'),
                           ('AURA_BACKUP_APPROVED_SHA','b'*40),('AURA_BACKUP_PASSPHRASE','short'),
                           ('AURA_STAGING_DB_PASSWORD','must-not-be-injected')]:
            with self.assertRaises(recovery.RecoveryFailure): recovery.guard({**env,key:value})

    def test_cipher_pinned_to_actual_backup_and_rejects_extra_or_changed_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            cipher=root/'aura-staging-private-backup.tar.gpg'
            cipher.write_bytes(b'fixture')
            digest=recovery.hashlib.sha256(b'fixture').hexdigest()
            (root/'SHA256.txt').write_text(digest+'  '+cipher.name+'\n')
            with patch.object(recovery,'CIPHER_SHA',digest):
                self.assertEqual(recovery.verify_cipher(root),cipher)
                cipher.write_bytes(b'changed')
                with self.assertRaises(recovery.RecoveryFailure): recovery.verify_cipher(root)
                cipher.write_bytes(b'fixture')
                (root/'unexpected.sql').write_text('private')
                with self.assertRaises(recovery.RecoveryFailure): recovery.verify_cipher(root)

    def test_archive_rejects_traversal_links_duplicates_and_bad_manifest(self):
        for name, kind in [('../escape',tarfile.REGTYPE),('roles.sql',tarfile.SYMTYPE),('roles.sql',tarfile.REGTYPE)]:
            with tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp)
                archive=root/'archive.tar'
                with tarfile.open(archive,'w') as t:
                    for filename in recovery.FILES:
                        member=tarfile.TarInfo(filename)
                        content=b'{}'
                        member.size=len(content)
                        t.addfile(member,io.BytesIO(content))
                    member=tarfile.TarInfo(name)
                    member.type=kind
                    t.addfile(member)
                with self.assertRaises(recovery.RecoveryFailure): recovery.unpack(archive,root)
                self.assertFalse((root.parent/'escape').exists())

    def test_sql_comparison_preserves_acl_function_bodies_and_copy_data(self):
        a=b'-- header\n\\restrict Ab123\nSET x = 1;\nCREATE FUNCTION f() RETURNS text AS $$\n-- meaningful body\n\\restrict abc\n$$ LANGUAGE sql;\nCOPY public.a (x) FROM stdin;\n-- actual data\n\\restrict abc\n\\.\n\\unrestrict Ab123\n'
        b=a.replace(b'-- header',b'-- other header').replace(b'Ab123',b'Zz456')
        self.assertEqual(recovery.canonical_dump(a),recovery.canonical_dump(b))
        for old,new in [(b'-- meaningful body',b'-- changed body'),(b'-- actual data',b'-- changed data'),
                        (b'SET x = 1;',b'SET x = 2;')]:
            self.assertNotEqual(recovery.canonical_dump(a),recovery.canonical_dump(a.replace(old,new)))

    def test_workflow_has_no_remote_secret_upload_or_automatic_activation(self):
        workflow=(Path(__file__).resolve().parents[2]/'.github/workflows/aura-staging-recovery.yml').read_text()
        for forbidden in ['secrets.AURA_STAGING_DB_PASSWORD','upload-artifact','apply_migration','workflow_dispatch']:
            self.assertNotIn(forbidden,workflow)
        for required in ['environment: aura-staging-backup','artifact-ids: \'12932542971\'',
                         'run-id: \'40930304863\'','AURA_BACKUP_APPROVED_SHA','[recovery-only]']:
            self.assertIn(required,workflow)

    def test_sql_comparison_preserves_multiline_strings_identifiers_and_escapes(self):
        samples = ["COMMENT ON TABLE t IS 'a\n-- original\nb';",
                   "COMMENT ON TABLE t IS E'a\\'\n-- original\nb';",
                   'CREATE TABLE "a\n-- original\nb" (id int);',
                   "COMMENT ON TABLE t IS '$$\n-- original\n$$';",
                   "/* block\n-- original\n*/ SELECT 1;"]
        for sample in samples:
            with self.subTest(sample=sample):
                self.assertNotEqual(recovery.canonical_dump(sample.encode()),
                                    recovery.canonical_dump(sample.replace('original','changed').encode()))
        with self.assertRaises(recovery.RecoveryFailure):
            recovery.canonical_dump(b"COMMENT ON TABLE t IS 'unterminated")

    def test_bootstrap_reconciliation_preserves_every_other_role_statement(self):
        source = '-- CREATE ROLE supabase_admin; in a comment\nCREATE ROLE supabase_admin;\nALTER ROLE supabase_admin WITH SUPERUSER LOGIN;\nCREATE ROLE anon;\nGRANT pg_read_all_settings TO pg_monitor WITH INHERIT TRUE GRANTED BY supabase_admin;\n'
        actual = recovery.restore_roles_sql(source)
        self.assertIn("oid=10 AND rolname='supabase_admin' AND rolsuper",actual)
        self.assertEqual(source.split('\n')[:1]+source.split('\n')[2:],actual.split('\n')[:1]+actual.split('\n')[2:])
        for bad in [source.replace('CREATE ROLE supabase_admin;\n',''),
                    source+'CREATE ROLE supabase_admin;\n',source.replace('WITH SUPERUSER','WITH NOSUPERUSER')]:
            with self.assertRaises(recovery.RecoveryFailure): recovery.restore_roles_sql(bad)

    def test_sqlstate_diagnostics_are_fixed_codes_and_do_not_reuse_previous_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            cluster=recovery.Cluster(Path(tmp),{})
            cluster.log.write_bytes(b'ERROR: 42710 previous-secret\n')
            def failure(*args,**kwargs):
                with cluster.log.open('ab') as out: out.write(b'ERROR: 42501 private-canary-not-for-logs\n')
                raise recovery.backup.BackupFailure('PRIVATE_COMMAND_FAILED')
            with patch.object(recovery.backup,'safe_process',side_effect=failure):
                with self.assertRaises(recovery.RecoveryFailure) as error: cluster.call(['fictional'])
            self.assertEqual(str(error.exception),'RESTORE_PERMISSION_DENIED')
            self.assertNotIn('private-canary',str(error.exception))
            def unknown(*args,**kwargs):
                with cluster.log.open('ab') as out: out.write(b'ERROR: XX000 another-private-canary\n')
                raise recovery.backup.BackupFailure('PRIVATE_COMMAND_FAILED')
            with patch.object(recovery.backup,'safe_process',side_effect=unknown):
                with self.assertRaises(recovery.backup.BackupFailure): cluster.call(['fictional'])


if __name__ == '__main__': unittest.main()
