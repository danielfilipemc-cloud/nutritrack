# Private nutrition accounts and synchronization — implementation gates

Status: **preparation, not activated**. No real records or account identifiers in
this document. Selected approach: independent private accounts with server-side
synchronization, not an additional browser health-data store. The published public
demo and its fixtures are not a destination for private records.

## Existing behavior that must remain intact

The canonical bundle has 19 registered migrations; the remote staging baseline
has historically been 17 and must be inspected again before any future action.
Water and document candidates remain separate prepared SQL. This increment does
not change any of them. The new mobile manifest does not alter session semantics.

`app/aluno/page.tsx` already resolves live `client_users` links and shared physical
measurements. Professional nutrition uses explicit capabilities AND assignments.
Students are deliberately denied professional nutrition RPCs, even with a live
client link. **Do not grant professional access to make a personal diary work.**

## Small, separate implementation PRs

### S1 — Own nutrition access contract and consent boundary

Add reviewed incremental SQL in a disposable local environment, with separate
student RPCs. The authorization predicate derives `auth.uid()` from the session,
requires an active exact `(organization, client, user)` link, verifies live session
and the effective organization MFA policy, and rejects archived-client writes.
No actor/user identity is accepted in a command. Cross-organization and another
student's records must be denied independently of a client-supplied UUID.

Define explicitly which student-created meals may be read by an assigned
professional, who can grant/revoke that sharing, and whether a professional can
correct a student's declaration. Default to no new sharing or professional write
rights until the contract/decision is approved. Revocation must be checked from
the database on every operation, including receipt and history retrieval with an
old valid JWT. Do not expose professional notes, other students or full client
records in a self-service response.

Reuse validated V1 item snapshots and the existing transaction/history machinery
through reviewed internal factoring. Do not copy an independent meal store,
weaken `nutrition_allowed`, repurpose professional wrappers, use editable JWT
metadata or rely on a frontend-only filter. Lock rechecks, append-only history,
idempotent request receipts and optimistic revisions must survive the factoring.

### S2 — Individual references and reusable product catalogue

Persist explicit manual daily references with scope, author, validity dates,
revision and reason. No inferred energy deficit, automatic clinical goal or
fixed household multiplier. A breastfeeding case can use the same meal recipes
with individually reviewed amounts; it must not inherit another person's targets.
Missing references remain unknown. Keep planned quantities separate from consumed
quantities, and scope every draft to account/organization/client.

Add a private product catalogue with name/brand/preparation, stated source and
basis, immutable versions, units and explicit optional serving mass. A catalogue
edit must never change a previous diary entry. Label-derived products must be
distinguishable from curated generic foods and incomplete composition. Do not
claim a licensed third-party catalogue, official barcode lookup or MyFitnessPal
connection. External data requires a source/licence/freshness review first.

V1 currently supports grams only. Liquids whose labels are per100ml require a
reviewed versioned unit contract across parser, SQL, totals, history, exports and
UI. No implicit `1 ml = 1 g`; no silent carbohydrate/fibre convention mixing.
Preference/exclusion metadata must not fabricate nutritional equivalences.

### S3 — Self-service UI in the existing student area

Use the authenticated account and live links already resolved by `/aluno`.
Expose daily references, own diary, recipes/quantities, water and allowed shared
measurements through the S1/S2 contracts. Reuse the existing food editor, pure
arithmetic, pending/uncertain UI and navigation guards; no parallel application.
Keep each account independent. Sharing a recipe or household preparation must
be explicit and cannot grant access to another person's diary or health metrics.

Missing RPCs produce unavailable/denied states, never a synthetic diary fallback.
Changing user, client, day or organization aborts stale reads, clears authorized
projections and protects drafts. A denied write cannot silently discard edits.
Do not clear uncertain saves until a server receipt or an explicit reviewed
resolution; never automatically replay a mutation after a network stall.

### S4 — Synchronization acceptance and private activation

Rehearse the cumulative migration chain and all new SQL locally first, retaining
canonical checksums. Then run real local GoTrue/PostgREST plus authenticated
browser tests with synthetic accounts. Remote activation remains a separate
review and explicit exact-destination authorization. No mutable historical runner,
automatic seed, signup or backend switch from the mobile install page.

For two independent sessions of the same synthetic account: deviceA saves,
deviceB refreshes/focuses and sees the exact revision; competing edits yield one
success and one conflict with a preserved draft; lost acknowledgement resolves by
the same requestID receipt without creating another meal. Another synthetic
account sees none of these records. Test active link, removed link, archived
client, another organization, anonymous, unconfirmed account, changed MFA policy,
revoked session and stale JWT. Repeat after the real account changes identity on
one device. Account separation is not proven by testing two tabs with one token.

Only after those checks and operational gates can separate private accounts be
provisioned/invited through the authorized administrative mechanism. Credentials
remain private, no public signup assumption, shared password or personal-data
fixtures. Do not ask the user to put an administrative secret in chat.

## Decisions and evidence required before real use

| Requirement | Responsibility | Evidence to unblock |
| --- | --- | --- |
| Student/professional sharing and revocation | Product owner + privacy review | Approved scope, explicit sharing defaults, negative tests |
| Clinical appropriateness of individualized goals, including breastfeeding | User + qualified professional as appropriate | Reviewed individual references; no automatic prescription |
| Account owner authorization/consent for each participant | Each participant + responsible party | Separate account participation and approved information notice |
| Legal basis, sensitive-data handling, retention, export and deletion rights | Responsible party + legal/privacy adviser | Approved policy and tested rights workflow |
| Compromised-password protection | Platform owner + technical configuration | Effective configuration/advisor and negative/password tests |
| JWT/session lifetime, revocation and device logout | Technical implementation + owner policy | Real stale-token and live-session negatives |
| Account and MFA recovery | Owner process + technical rehearsal | Identity verification, audit, no bypass, recovery rehearsal |
| Cloud restore, RPO/RTO, Auth/config/Storage coverage | Owner objectives + technical rehearsal | Measured operational cloud restore, not only cloud-to-local proof |
| Android installation and private publication | Technical + separate release approval | Exact reviewed SHA, private destination, install/login/two-device tests |

No costs, resources, migrations, Auth/RLS configuration, cloud data, production or
staging were changed in preparing this plan. The current increment is a candidate
for independent review and synthetic testing; it is not authorization for real
health records or a commercial pilot.
