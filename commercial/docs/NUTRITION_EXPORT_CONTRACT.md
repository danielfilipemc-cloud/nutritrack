# Nutrition export V1 — bounded immutable snapshot

Candidate contract; no remote endpoint, migration, activation or legal approval.
The producer implemented here is **synthetic only**. Existing diary/history RPCs
must not be adapted by concatenating pages and labelling that a complete export.

## Scope

One organization, one pupil and an inclusive date range. Rows represent **all
versions whose own consumption date falls within the range**, including voided
versions and their retained item snapshots. A version moved outside the period
is excluded; an earlier version within it remains included. This is neither a
current-consumption total nor an assertion that the diary records all intake.
No staff identity, private request hash, audit event or Auth data is included.
An access-rights response may need other records; this is not a complete RGPD
subject-access package or a portability eligibility decision.

## Consistency and transport

Capture an authorized set once, normalize and copy it synchronously before any
await, then freeze pages. Sort by meal UUID and numeric revision. A manifest pins
scope, snapshot identity, capture time, version/item counts, ordered page counts
and SHA-256 digests. Pages are transport slices of that immutable set, never new
queries against live heads. Unknown nutrients stay null, known zero stays zero.
Consumers validate the expected scope, every page index/count/hash, unique
version keys, order and aggregate counts before releasing any output. Empty
exports have an explicit empty manifest. Missing, mixed, duplicated, truncated
or modified pages fail closed. Overflow fails; there is no partial-success flag.

SHA-256 detects transport corruption/mixing; it is not a signature or proof that
an untrusted producer included all database rows. The manifest must come from
the same trusted authorized snapshot producer. Counts alone do not prove source
completeness. Synthetic tests prove immutable transport under source mutations,
not cloud completeness or authorization.

## Required future database producer — deliberately not installed

Use one bounded SQL statement with a single MVCC snapshot to derive authorized
versions, item snapshots and source counts together, or materialize a private
snapshot in one transaction. Do not page ordinary READ COMMITTED queries or hold
a repeatable-read transaction open across HTTP calls. Keep authorization at
capture and each delivery, respecting current organization membership,
assignment, profile/nutrition capability and sensitive-session/AAL2 policy.
Revocation must block future delivery, even with an old access token; data
already delivered cannot be recalled. Define the treatment of in-flight capture
explicitly and test its linearization against revocation.

Any future SQL/manifest storage requires a separately reviewed incremental PR:
minimal grants, invoker public wrapper, reviewed private implementation, RLS,
limits, retention, private expiry, retry identity and failure recovery. No direct
table grants or service-role browser access. Capture more than the configured
bound to detect overflow, return an error instead of truncating, and reconcile
source counts and hashes before serving. A fresh authorization must not silently
reuse a snapshot of another actor, tenant, pupil or scope.

Required native PostgreSQL evidence before cloud: independent writer inserts,
moves dates, edits and voids while capture is running; independently verify the
snapshot set against a transaction-consistent oracle, including >20 versions,
empty ranges and overflow. Then test the actual producer with GoTrue/PostgREST
under the separate approved synthetic matrix. Until that producer exists, real
nutritional export completeness and persistence activation remain blocked.
