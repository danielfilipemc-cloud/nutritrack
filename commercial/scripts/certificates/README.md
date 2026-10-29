# Supabase public root certificate

Public CA certificate, not a private key or credential. Retrieved29-10-2026 over verified HTTPS from the Supabase download bucket:

https://supabase-downloads.s3.ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Supabase's official guidance requires its database CA for verify-full, including shared poolers:

- https://supabase.com/docs/guides/platform/ssl-enforcement
- https://supabase.com/docs/guides/database/psql

Subject/issuer: Supabase Root2021CA, SupabaseInc. Valid28-04-2021→26-04-2031. Certificate DER SHA256 fingerprint:

807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA

Exact reviewed PEM file SHA256:

700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7

The client verifies that hash, appends this CA to the runner's existing system roots in a temporary bundle and mounts the bundle read-only into the PostgreSQL client. sslmode=verify-full and hostname verification stay enabled. A missing/tampered certificate fails closed; renewal requires review and updated tests/hash, never a runtime download or TLS bypass.

Credential-free CI performs a PostgreSQL SSLRequest and verified TLS handshake to the fixed staging pooler, then closes without authenticating or issuing SQL. This checks transport only, not the database password or backup/recovery.
