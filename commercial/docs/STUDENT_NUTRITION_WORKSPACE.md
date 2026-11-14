# Own-account workspace and local synchronization evidence

Depends on PR #86 (private own-account journal) and #87 (private daily references),
on top of #85. No merge, cloud SQL, account provisioning or publication authorized.

## Effective UI

`NEXT_PUBLIC_AURA_PERSONAL_NUTRITION=1` opts into nutrition in `/aluno`. Default0
preserves the deployed student area. This build flag is not an authorization
boundary; remote SQL activation is a separate reviewed decision.

The existing diary/editor is reused with the separate fixed student RPC adapter.
Professional capabilities are never requested or inferred. Links are explicitly
filtered by auth user in addition to RLS, so a manager opening the student area
does not receive a selector containing managed students. Each context is keyed by
account/organization/client. Organization-A replies cannot re-enable editing or
introduce private references after switching to organizationB.

Private nutrition, shared measurements and privacy have separate navigation.
Switching areas keeps drafts mounted; changing context, route, day, reload or
logout participates in the existing pending/draft guard. A fresh signed-out or
different-account context cannot retain the previous authorized projection.

Daily manual references have explicit save, reason, version, history and receipt
reconciliation. They do not represent consumption or prescribe calorie deficits.
The balance uses only the loaded saved reference version and a complete single
diary read. Editing a draft cannot change that balance. Missing records/values or
paginated diary data cannot silently become zero or a complete daily total.

Conflicts preserve the draft, show the current stored values, and require an
explicit review acknowledgement before rebasing. A further server conflict is
still enforced by CAS. Lost acknowledgement retains requestId, blocks duplicate
saves and resolves only through its matching receipt. Revocation hides controls
without discarding the in-memory draft; refresh revalidates authority.

Product labels/gram calculations reuse #85; no duplicate draft targets appear in
the private planner. Committed references remain separate. Per100ml products,
catalogue/barcode licensing and persisted global product search are not supplied.
Private water, recipes/plans and own measurement writes need their own contracts;
the professional modules were not granted to students. Generic privacy export
does not yet include private nutrition; the UI states that limitation explicitly.

## Real local proof

`scripts/start-local-validation-wsl.sh personal --keep-alive` starts a named
synthetic-only stack `aura-personal-nutrition-local`, API62321, PostgreSQL62322,
Mailpit62324. The original573xx baseline and613xx nutrition sandbox are separate.
Local ports must effectively bind to127.0.0.1; no remote URLs/DSNs or Docker-host
override is accepted. The10GiB storage guard and pinned CLI2.120.0 remain intact.

`AURA_PERSONAL_AUTH_CONFIRM=aura-personal-nutrition-local` is required by the runner:

```sh
npx tsx scripts/personal-nutrition-auth-local.ts --prepare
npx tsx scripts/personal-nutrition-auth-local.ts --run
```

Preparation requires a new empty Auth/database, applies17→19 with the historical
records unchanged, then the two explicit prepared candidates. It refuses reset,
cleanup, arbitrary SQL files, dotenv or a remote target. Subsequent runs append
fresh synthetic fixtures; pre-existing accounts must have the synthetic marker.
Credentials/passwords/tokens/TOTP seeds are never included in published evidence.

Eleven real GoTrue/PostgREST groups passed locally: effective canonical checksums,
INVOKER wrappers/RLS/grants; own/foreign scopes; two independently usable private
accounts; assigned-professional denial; two real sessions with concurrent
idempotent meals; synchronized references and concurrent CAS; revocation committed
while a target writer waits on a head lock (no version/receipt); unchanged-JWT
link revocation; archived read-only; real TOTP/AAL2; global logout rejecting the
same old AAL2 JWT. `docs/review/personal-nutrition-local-auth-evidence.json` is
sanitized and test-bound to the current runner and SQL hashes.

These are real local API tests, not a real authenticated browser journey, cloud
validation, operational recovery or security certification. Chromium uses separate
intercepted fixtures for UX, drafts, concurrency and responsive screenshots.
Android hardware installation/TalkBack, native zoom, screen readers, Safari and
Firefox remain unverified. The public PWA installer is not a private data release.

## Release gates

Safe rollback must preserve ownership filters. Never reapply the old professional
writer/read functions or permissive policies over a database containing private
entries: that could expose private rows to assigned staff. Preserve the personal
owner column and all versions/receipts. A separately reviewed emergency freeze
can revoke authenticated execution of both new personal save entrypoints and
their public wrappers, while retaining restricted read/history access. Merely
setting the UI flag to0 does not freeze APIs. No such freeze or rollback was
executed. Operational restore must retain the current policies/RPC definitions as
well as data; restoring only old canonical schema with new rows is not valid.

All three PRs require independent review in order. Canonical19 migrations and the
previously approved17-migration cloud baseline remain unchanged. Do not run these
candidates remotely through a historical runner or enable the UI against cloud
before exact-destination SQL/auth/integrity/recovery validation and authorization.

High blockers remain open: compromised-password protection, global session/JWT
policy, account/MFA recovery, operational cloud restore and legal/privacy/retention
decisions. Comprehensive private export is still required before real data. The
user's and another participant's real information was not used in code, fixtures,
test evidence or databases. No paid resource or new service plan was created.
