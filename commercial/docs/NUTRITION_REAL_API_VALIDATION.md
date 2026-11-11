# GoTrue/PostgREST — prepared matrix, no remote execution

The machine-readable matrix is
`docs/review/nutrition-activation/real-api-test-matrix.json`. It deliberately has
no executor. Every case is **NOT RUN** until an approved window and evidence
exist. Offline/PGlite/native PostgreSQL/Chromium results must never fill the
real-API results column. This supplements the existing 18/19 activation plan;
it does not authorize migrations, provisioning or reuse of historical runners.

## Mandatory gates before a future run

1. Responsible person approves target, code SHA, schema checksums, private
   synthetic binding checksum, exact mutations, scope and maintenance window.
   Only `vgbwmamntjmhzrpvhxzb` is proposed. Any mismatch stops before login.
2. A separate approved migration window installs 18/19 and confirms all 19
   checksums, grants, RLS and invoker/definer inventory. Do not install missing
   functions as part of a test. Drift means STOP, not repair-in-place.
3. Bind all aliases to existing verified synthetic UUIDs in a private file;
   reject production/personal projects, unknown actors, fixture collisions,
   missing permissions and unbound rows. Public proposed UUIDs are not proof of
   ownership. No account creation, reset, MFA removal or secret collection.
4. Verify existing TOTP enrollment and AAL2 for the synthetic managers and
   professionals used by required-policy cases. A challenge failure blocks the
   case; do not lower policy. AAL claims alone are not a successful MFA test.
5. Identify the previously approved recovery evidence and a containment owner.
   No destructive cleanup, automatic restore, resource creation or cost change.
   Recovery gaps remain explicit blockers, not covered by a database export.

## Execution protocol for a future reviewed runner

Use fresh actor sessions from private authorized mechanisms; never use an admin
key to execute the business RPCs or impersonate end users. Pin the API host and
deny redirects/unexpected destinations. Set request timeouts and a bounded
concurrency budget. Disable raw HTTP/body/token logs. Use a random per-run
request namespace and keep IDs/receipts in the private fixture manifest.

Before each mutation verify the exact organization, pupil and actor binding.
Record only case ID, code SHA, schema manifest hash, timestamp, actor alias,
token fingerprint (one-way hash, no token), expected and actual HTTP/SQLSTATE,
counts and PASS/FAIL/BLOCKED. A timeout is UNKNOWN, never a pass or automatic
retry. Reconcile the original request ID with its actor's receipt before another
write. Return no raw meals, email addresses, MFA seeds or secrets in evidence.

For direct table reads, distinguish RLS-empty success from RPC access denial.
For DML, verify persisted state and audit counts, not just an HTTP status. Use
two independent authenticated sessions and explicit barriers for races; delays
alone are insufficient evidence of ordering. Keep an old token in memory while
an approved synthetic manager revokes access, then test before refreshing it.
Expired-JWT rejection and signout are different cases: do not infer instant
access-token invalidation from refresh-token revocation. H-02 stays open.

Stop further mutations on unexpected cross-tenant access, unauthorized writes,
history corruption, fixture mismatch or uncertain containment. Reconcile
in-flight requests and preserve evidence. Restrict only approved synthetic
competencies under the pre-authorized containment plan; never change global
Auth/RLS or delete history as emergency test cleanup. Remediation/restoration
needs independent review and its own authorization where not already approved.

## Results and limits

All 24 real-API cases are pending. X01 is additionally blocked by the absent
transactional export producer; synthetic transport checks do not unblock it.
Some required fixture roles may not exist: report BLOCKED instead of provisioning
them. Backend/session settings unavailable through public APIs require separate
read-only owner evidence, never guessed values. No new admin credential request
is part of this plan. Password protection, JWT/session policy, operational cloud
recovery, complete account/MFA recovery and legal requirements remain H-01–H-05.

Official references to recheck at execution time:
[sessions](https://supabase.com/docs/guides/auth/sessions),
[MFA](https://supabase.com/docs/guides/auth/auth-mfa),
[database functions](https://supabase.com/docs/guides/database/functions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
