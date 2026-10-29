"""Non-private, synthetic PG17 recovery integration test (no remote services).

Default uses the production rehearsal's pinned Supabase image. --portable uses
the smaller pinned PG17 image for constrained local executors; this does NOT
prove Supabase extension compatibility. No decryption key or live data is used.
"""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile

spec = importlib.util.spec_from_file_location('recovery', Path(__file__).with_name('staging-private-recovery.py'))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


def main():
    r.require(sys.argv[1:] in [[], ['--portable']], 'CONTEXT_INVALID')
    env = {k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS',
           'DOCKER_TLS_VERIFY','DOCKER_CERT_PATH','AURA_BACKUP_PASSPHRASE','AURA_STAGING_DB_PASSWORD','PGPASSWORD']}
    image = r.backup.IMAGE if '--portable' in sys.argv else r.SERVER_IMAGE
    with tempfile.TemporaryDirectory(prefix='aura-recovery-fiction-') as tmp:
        root=Path(tmp)
        source=r.Cluster(root,env,image=image)
        target=None
        try:
            source.docker('pull',image)
            source.start()
            source.sql("""create role postgres superuser login; create role anon;
              create schema auth; create schema app_private; create schema storage; create schema vault;
              create table auth.users(id int primary key, encrypted_password text);
              insert into auth.users values (1,'fictional-hash');
              create table public.samples(id int primary key,note text);
              insert into public.samples values(1,'fictitious data');
              alter table public.samples enable row level security;
              create policy no_anonymous on public.samples for select to anon using(false);
              create table storage.objects(id int); create table storage.buckets(id int);
              create table vault.secrets(id int);
              create table app_private.aura_migrations(name text primary key,checksum text);
              create function public.fixture_text() returns text language sql as $$
              -- preserved function body
              select 'fictitious';
              $$; revoke all on function public.fixture_text() from public;
              """)
            baseline=json.loads(Path(__file__).with_name('staging-recovery-baseline.json').read_text())
            values=','.join("('"+row['name']+"','"+row['checksum']+"')" for row in baseline)
            source.sql('insert into app_private.aura_migrations values '+values+';')
            source.docker('exec',source.cid,'pg_dump','-h','/tmp','-U',r.BOOTSTRAP,'-d','postgres','--format=custom',output=root/'staging.dump')
            source.docker('exec',source.cid,'pg_dumpall','-h','/tmp','-U',r.BOOTSTRAP,'--roles-only','--no-role-passwords',output=root/'roles.full.sql')
            roles=(root/'roles.full.sql').read_text()
            # Only this synthetic fixture was authored by the bootstrap role.
            # The actual recovery script refuses this role in the source archive.
            (root/'roles.sql').write_text('\n'.join(l for l in roles.splitlines() if not l.startswith((
                'CREATE ROLE '+r.BOOTSTRAP+';', 'ALTER ROLE '+r.BOOTSTRAP+' WITH')))+'\n')
            source.close()
            target=r.Cluster(root,env,image=image)
            target.start()
            target.restore()
            target.verify()
            try:
                target.restore()
                raise AssertionError('Populated destination was accepted')
            except r.RecoveryFailure as error:
                assert str(error)=='DESTINATION_NOT_EMPTY'
            target.sql("update public.samples set note='changed';")
            try:
                target.verify()
                raise AssertionError('Changed data was accepted')
            except r.RecoveryFailure as error:
                assert str(error)=='DATA_ROUNDTRIP_MISMATCH'
            print(json.dumps({'fictionalFixture':True,'fullRestore':True,'schemaDataRoundtrip':True,
                              'populatedTargetRefused':True,'changedDataRefused':True,
                              'supabaseImage':image==r.SERVER_IMAGE,'cloudRecoveryVerified':False}))
        except BaseException:
            # This harness creates only the hard-coded fictional fixture above;
            # it never reads a private backup or accepts credentials.
            print((root/'restore.private.log').read_text()[-4000:], file=sys.stderr)
            raise
        finally:
            source.close()
            if target: target.close()


if __name__=='__main__': main()
