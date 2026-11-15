# Private plan consultation, adjustments and feedback

Scope: existing private participant portal only. The `NEXT_PUBLIC_AURA_PERSONAL_PLAN=1` build flag adds a plan tab; it does not confer authorization. No professional portal, shared dietitian prescription, automatic recommendations or consumption is created by consulting or editing this plan.

## Incremental contract

Depends on PR #91 (read-only reference) and the already installed canonical19 + three private access/reference/export candidates. The additional prepared source is `20261115004835_nutrition_personal_plan_changes.sql`; it is not part of the canonical migration bundle and must never be included in the original empty-destination installer.

An authenticated participant may revise an **existing available own plan**, or append private feedback against its exact current revision. Each command has a V1 body, UUID request identity, expected revision, operation and bounded reason/comment. Only frozen manual gram-based composition is accepted. Recipe publication, food imports, nutrition prescriptions and cross-participant sharing remain outside this contract.

The initial reference and every subsequent plan version remain immutable. A personal adjustment has a distinct source label and cannot overwrite the original source. Feedback records the plan version it concerns; it neither changes the version nor sends a message to anyone. Feedback visibility is owner-only, including when a professional belongs to the organization.

## Authorization and concurrency

New tables remain in `app_private`, have RLS enabled and have no direct browser grants. Public wrappers are `SECURITY INVOKER` with empty `search_path`; tightly scoped private entrypoints check live ownership, verified account, session existence/expiry and recent organization-required MFA. No user-supplied actor or owner is accepted.

A scoped advisory transaction lock serializes competing commands. Row locks on the live link, client, Auth session/user and organization MFA policy serialize writes against link revocation, client archival, session removal and policy changes. Authorization is checked before request replay as well. An old JWT cannot recover a receipt after its underlying session/link is revoked. A request starting before a concurrent revocation can finish before that revocation acquires its lock; this is transaction ordering, not a guarantee of cancelling an already authorized operation.

The entry is also the idempotency receipt: same request/payload returns its committed result, different payload using that identity fails. Stale expected revision fails without creating a version or feedback. Updates/deletes of history are refused, including operator SQL. Audit events contain action/scope, not food text or feedback content.

## Drafts and failures

The editor reuses the existing plan/food editors in manual-only mode. Individual meal editors collapse on mobile. Drafts remain in component memory across portal tabs and background Auth/read refreshes, and are hidden when access cannot be revalidated. They are not written to browser storage. Link changes, route departure, reload and logout use the existing draft navigation guard. Pending or unconfirmed mutations block departure unless the user explicitly acknowledges leaving an uncertain operation.

Conflicts never replace the draft automatically. Reloading the baseline requires explicit discard confirmation. A lost/malformed acknowledgement blocks another write and exposes the existing receipt-check flow; an absent receipt does not prove cancellation. Only a matching receipt clears the submitted draft. Feedback can be explicitly attached to a new current plan revision after the user reviews it.

## Export, privacy and recovery boundaries

Plan versions and adjustments/feedback have separate clearly named exports. Both are one-statement stable snapshots, validate contiguous history, refuse partial results and have explicit count/size bounds (1,000 records and 8 MiB). Their checksum describes the returned JSONB, not a signature or legal certification. Exceeding the bounds requires an assisted complete export.

No new legal retention period, consent basis, deletion policy or clinical approval is inferred. Feedback and version history must be included in future assisted access/deletion reviews and operational recovery tests. No automated hard deletion is added. Full cloud restoration and account/MFA recovery remain open operational requirements.

## Controlled private activation

Only `ivwrvaycolqlpsjvdaod` / `aura-business-private` and Render `srv-dbrqt061egvs73bvnvg0` may be targeted under the participant's request to put their plan online. Verify canonical checksums and the installed three-source manifest before installation; reject a partial/pre-existing installation. Apply each new source transactionally and record its normalized digest. Verify tables, functions, grants and advisors before enabling the public build flag. Provision personal content separately by the existing authorized own scope, with an empty-plan precondition. Keep content, email, identifiers and provisioning SQL outside Git.

After CI, advance only `release/aura-private` by fast-forward. Confirm the exact branch revision immediately before triggering the existing Free Render service (auto-deploy remains off), then confirm the deploy commit and LIVE status. Smoke the private login, portal assets, manifest and response headers; anonymous RPCs must remain refused. User login/password/TOTP must never be collected by an administrative runner.

If UI publication fails, retain the previous private build and all append-only history. If a new endpoint must be frozen, revoke only the new entrypoints in a separate controlled action; do not drop tables, alter installed historical sources or restore old unfiltered readers. Existing cloud data is not a test fixture.

High gates remain open: compromised-password protection, global sessions/JWT policy, complete cloud recovery, complete account/MFA recovery and RGPD/legal/retention decisions. This personal trial does not authorize a commercial pilot or certify security. Android hardware, TalkBack, native zoom, Safari and Firefox are not covered by Chromium viewport tests.
