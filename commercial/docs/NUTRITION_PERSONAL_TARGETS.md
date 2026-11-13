# Private daily references — local candidate

Depends on the own-account access candidate in PR #86. Generated prepared SQL:
`supabase/prepared/20261113225825_nutrition_personal_targets.sql`. Outside the
canonical installer; no remote migration or activation. No clinical data in tests.

Each account has explicit manual reference values for an exact calendar day in
its own organization/client scope. No automatic deficit, lactation multiplier,
prescription, inheritance from another person or implied zero. Missing references
and individual unknown nutrients remain null. Copying references to another day
or sharing them is not implicit. Daily scope avoids silently rewriting references
for earlier records through a global profile setting.

The command V1 contains requestId, expectedRevision, targetDate, manual references
and a mandatory reason. Identity derives from the live session and active link.
Header/version/receipt insertion is atomic, the header is locked and immutable
apart from the next revision, and versions/receipts are append-only. Server
checks enforce the same bounded positive-or-null values as TypeScript. Catalogue
or automatic recommendation metadata is rejected, as are forged actors.

Professional assignments grant no access. RLS on both public reference tables uses
a minimal visibility boolean, with no public/anonymous execution; direct DML is
revoked. Reads, history and receipts recheck own access, live sessions and MFA;
archived clients retain read access and cannot write. RequestId reuse with another
command conflicts. CAS prevents a second device overwriting a newer revision.

RPCs: `aura_student_nutrition_targets_{read,save,history,request_status}`; fixed
INVOKER wrappers around restricted private entrypoints. The frontend adapter
validates day/revision/receipt binding and complete contiguous history pages;
missing/malformed responses cannot imply successful persistence. Network loss
after a write means uncertain, retaining requestId until receipt reconciliation.

Tests include exact-day isolation, source/units/ownership negatives, personal
versus staff separation, revocation without refreshing claims, revisions/history,
idempotence and a simulated lost acknowledgement over embedded PostgreSQL. This
is distinct from real GoTrue/PostgREST and independent-connection concurrency.

The candidate does not provide a legal retention/export policy or account/MFA
recovery. Comprehensive private export, remote configuration, operational restore
and all high security/privacy gates remain open. No pilot or real-data use is
authorized. UI and real local integration are separate increments.
