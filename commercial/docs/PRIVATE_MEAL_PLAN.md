# Private meal-plan consultation — candidate, not activated

The existing private release has a journal and exact-day manual references. It
does not yet have a personal meal plan. This increment adds a separate **O meu
plano** section inside the existing student area, behind
`NEXT_PUBLIC_AURA_PERSONAL_PLAN=1` and the existing personal-nutrition flag.
Both remain separate from declaring consumption. Merely viewing a plan or choosing
an alternative never writes a meal, references, measurements or a prescription.

## Contracts and authorization

Reuse `PlanBody`, frozen per-100 g composition, grams-only quantities and the
existing nutritional calculator. Primary options and alternatives are displayed
separately; only the option being consulted enters the displayed planned totals.
Unknown remains unknown. Food state belongs in the label and preparation notes;
no raw/cooked, mass/volume or household-unit conversion is inferred.

The new scope-bound reader validates organization, client and authenticated user,
revision, source and body before rendering. Old responses cannot cross identity or
organization changes. Focus, Auth changes and explicit refresh clear old content
before revalidation. Existing journal drafts remain mounted when changing sections.
No demo or professional-RPC fallback exists.

Prepared SQL, **outside the canonical installer**:
`20261114234627_nutrition_personal_plan_reference.sql`. It adds one private table
with immutable versions, reasons and assisted audit events. Direct table privileges
are denied and RLS remains enabled. The public read/export wrappers are INVOKER;
private DEFINER entrypoints have empty search paths and require the existing live
own link, confirmed identity/session and effective recent MFA checks. There is no
browser write grant, automatic planner or professional capability shortcut.

Assisted insertions require an active exact personal link and a mandatory-MFA
policy, serialize revisions, reject gaps and validate the same bounded manual
portions used by the journal. Withdrawal appends a version; it does not erase
earlier content or reactivate a revoked link.

## Privacy and release limits

`aura_student_nutrition_plan_export` reads all own versions, including withdrawals,
from one STABLE snapshot. More than 1,000 versions or 8 MiB requires an assisted
complete export and produces no partial download. The JSONB SHA256 is an integrity
value, not a signature. Client validation checks exact scope and contiguous full
history. The file is separate from the journal export and is not a cloud backup,
restoration procedure or complete account export.

Personal documents, contacts, measurements, energy estimates and meal proposals
stay outside Git and public screenshots/fixtures. Tests and CI use invented data.
Source dates and composition provenance must distinguish an original professional
document from a subsequently adapted personal proposal. Generic-food estimates
must not be presented as verified brand labels or as a clinician-approved plan.

No hosted migration, dataset import, service configuration or deployment is
performed by this PR. Canonical19 and the three already authorized personal
candidates are unchanged. The initial empty-project activation bundle **must not**
be rerun now that accounts exist. Before private activation, review a separate
incremental package with the exact destination, existing source checksums, grants,
scope-bound provisioning manifest, negative tests and fail-closed withdrawal plan.
Never roll back by dropping history or restoring old unscoped readers.

Open high gates remain compromised-password protection, global JWT/session policy,
full account/MFA recovery, operational cloud restoration/RPO/RTO and legal privacy/
retention decisions. This candidate does not authorize real health records or a
commercial pilot. Native Android, TalkBack, Safari and Firefox are not certified
by desktop Chromium emulation. Real Auth/PostgREST evidence must be reported
separately from fixture browser tests and PGlite authorization simulations.
