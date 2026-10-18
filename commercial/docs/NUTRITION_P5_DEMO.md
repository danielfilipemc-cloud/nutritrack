# P5 — rehearsal inside the existing Nutrition area

Independent of the export-contract PR. Uses existing V1 command/composition
validation. No remote adapter, persistence flag, migration or food import.

The additional "Ensaiar registo" area is explicitly fictitious, separate from
both the pupil and the fixed example diary. One local example can be reviewed,
confirmed, corrected and logically voided. Earlier revisions remain visible in
the same in-memory session. Leaving the area discards the example history.

The reviewer can choose a simulated conflict or lost response. A conflict keeps
the draft and creates no revision. A lost response commits once in local memory,
blocks resubmission and offers a simulated receipt lookup without duplicating
the version. This is a UX rehearsal, not a test of backend idempotency, network
faults, server revision reconciliation or authorization. No capability is granted
by this interface; its buttons act only on invented data. Existing profile access
checks still gate mounting. It must not be relabelled as a live write workflow.

Dirty entry/review/conflict/uncertain states participate in the existing profile
navigation guards, organization changes, logout and beforeunload. Drafts are not
written to localStorage or copied between profiles. Keyboard and narrow desktop/
mobile browser tests cover the workflow; native zoom, screen readers, Safari and
Firefox remain untested. No automatic recommendations, targets or prescription.

Future persistent UI requires its own reviewed adapter, current nutrition access
checks, safe results for revoked access, CAS, fixed request identities across
timeouts, real receipt reconciliation, remote negative tests and explicit cloud
activation authorization. H-01–H-05 remain open; this PR authorizes no pilot.
