# Own-account nutrition — local candidate

Base: PR #85, `952229392417f4651e6f83c2707fa16873695206`.
No remote SQL, account provisioning or publication. The canonical installer,
its19 registered checksums and the previous water/document candidates are unchanged.

## Effective contract

`supabase/prepared/20261113225824_nutrition_personal_access.sql` is generated with
the pinned local CLI and deliberately kept outside migrations/. Apply only in a
discardable synthetic local test database after the canonical19, pending review.

It adds nullable `nutrition_meals.personal_user_id`: old professional entries
remain null, preserving existing data and idempotency hashes. New personal entries
bind to the authenticated account permanently; relinking a client to another
account cannot transfer them. A trigger forbids changing ownership. The same
meal/version/item/request/audit tables remain the single journal engine.

The professional writer/diary/history/receipt entrypoints now delegate to an
owner-only shared core with a fixed professional scope. New student entrypoints
use a fixed personal scope. Professional capabilities/assignment never authorize
private rows. RLS on all three journal tables follows the same rule; policies
are replaced, not extended with another permissive policy. Original professional
history, receipts and the exact professional command hash remain valid.

Self access requires a confirmed email account, active exact client_users link,
live auth.sessions row belonging to auth.uid(), unexpired JWT/session, and the
effective organization MFA policy. Archived clients keep own history/receipts
but cannot write. Identity and ownership come from the server; V1 does not accept
actor, user or organization fields inside commands. Revocation is checked on
every operation, including a replay and receipt lookup. Writes use the existing
organization lock, a head lock and authorization recheck after waiting.

`aura_student_nutrition_{context,meal_save,diary,history,request_status}` are
INVOKER wrappers around restricted private DEFINER entrypoints with empty
search_path. The scoped cores, projection, identity and ownership helpers are
not callable by authenticated/anonymous clients. The RLS visibility boolean has
the minimal authenticated execute grant needed by its policies.

`lib/nutrition-student-persistence.ts` reuses the existing V1 validators,
pagination checks, abort/deadline and uncertain-save behavior. Its fixed mapping
never falls back to professional RPCs. Context is separately validated and never
assumes read permission implies write permission.

## Privacy and operational boundaries

Personal diary sharing with professionals, household access and personal target
sharing are **not implemented**; default is no such sharing. This is a technical
least-privilege default, not legal approval of consent or retention. The existing
generic privacy export does not include these new private records: comprehensive
export/retention/deletion remain required before real use. No automatic erasure.

This does not change the global session/JWT policy of existing modules; their
high operational gates remain open. It does not activate personal water or
recipe/document access, supply food databases or prescribe targets. Real Auth,
database locks with independent connections and the new student UI are validated
separately from embedded PostgreSQL tests; older evidence is not a new run.

Tests: `tests/nutrition-personal.test.ts`; fixture creates only invented accounts,
sessions and two client links in fresh PGlite. Scope includes owner/admin/coach/
unassigned/another student, professional raw/RPC negatives, old hashes, relinking,
MFA changes, missing/expired sessions and append-only revision/receipt behavior.

Future cloud activation requires exact destination authorization, effective SQL
inventory/checksums, synthetic manifests, new real Auth/browser validation and
recovery/rollback planning. Do not run historical cloud mutators or grant the
student professional capabilities to bypass a missing installation.
