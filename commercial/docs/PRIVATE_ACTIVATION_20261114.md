# Private nutrition activation — actual state, 14 November 2026

Only `commercial/`. No personal health records or participant contacts in this
document. Participants' addresses remain in the private conversation/provisioning
channel, not fixtures, source, public PRs or test evidence.

## Separate destinations and authorization

The owner explicitly authorized a new free private environment in Aura Business,
eu-west-1, and a free Render service in Maryatchi hub. Created and checked:

- Supabase `ivwrvaycolqlpsjvdaod`, `aura-business-private`: healthy; zero Auth users
  and zero app tables before the attempted installation.
- Render `srv-dbrqt061egvs73bvnvg0`, `aura-business-private`, free, Frankfurt,
  auto-deploy off, branch `release/aura-private`.
- Initial deploy `dep-dbrqt0u1egvs73bvo190` is LIVE at
  `754158edbcc40fe140e8536e7eaa25f5d2d4d827`. `/`, `/aluno`, manifest and install
  icon returned200 with no-store/DENY. This is the older tested frontend, not the
  export/private-entry candidate in this PR, and not an activated data service.

The automatic approval reviewer **rejected** installing canonical19 remotely:
the resource-creation authorization did not specifically authorize remote schema,
RLS/functions/grants installation. No retry through SQL/API/CLI or other route.
The database remains uninstalled until explicit schema authorization is obtained.
The owner subsequently authorized package
`fb3d3181e2f037ec2ee591ae05e5a095c80d2525942466976a9113125a6c6fb2`,
canonical19 plus the three personal candidates, **conditional on final CI PASS**,
only in the new empty private project. No authorization to install in demo/staging
or to import personal records follows from that approval. Effective installation
and postchecks must be reported separately; this document is the prepared plan.

`scripts/private-nutrition-activation-plan.ts --prepare` prepares the exact bundle
and manifest under ignored `.aura-integration/private-activation/`. It has no
network or execution capability.19 canonical migrations keep historical checksums;
three prepared candidates add personal ownership/access, daily references and
complete export. A guard refuses any pre-existing Auth user or app table. All
installation runs in one transaction; a private source manifest remains in the DB.
The plan never creates accounts, imports health data or touches protected targets.

Excluded: `vfplbkfxipfictuwkkoe`, `vgbwmamntjmhzrpvhxzb`, `maipjryehnllaifxhunf`,
the demo/staging services, `main`, `saas-foundation`, personal NutriTrack and all
other connected projects. None was resumed, migrated or deployed.

## Own export and interface

`aura_student_nutrition_export` has a public INVOKER wrapper, restricted private
DEFINER with empty search_path, live verified identity/link/session/MFA checks and
fixed owner scope. A STABLE function uses one calling-statement MVCC snapshot,
including all own meals, versions, item composition, receipts/events, daily
references and their versions/receipts. Includes voided and superseded records.
No offset/date/UUID pagination can silently miss concurrent inserts or corrections.

The envelope carries format/version, exact scope, counts, snapshot timestamp and
SHA256 of the PostgreSQL JSONB representation of data. It is not a signature or a
hash of the pretty-printed downloaded file. The adapter checks scope, counts,
relationships, contiguous history and items before creating a JSON download.
Over20,000 aggregate rows or8MiB explicitly refuses the interactive export;
assisted complete export is then required. No partial file, cloud backup,
account recovery, import or automatic deletion is implied.

Only the separate opt-in `NEXT_PUBLIC_AURA_PRIVATE_PORTAL=1` selects own-area
entry/PWA start, private login copy and noindex headers. It is presentation, not
authorization. The normal professional build keeps this flag0. First private
entry still requires the live client link and effective MFA policy. The password
link uses the existing reviewed recovery flow; it does not remove MFA or change
any role. Never provision predictable shared/name-based passwords.

## Email and account provisioning still required

The owner reports saving Site URL/redirects for the new URL. This is user-reported,
not a successful real email-link test. MCP cannot read/update hosted Auth config;
the available browser connection also failed before dashboard access.

No SMTP provider exists yet. The Supabase default sender restricts delivery to
organization-team addresses. Do not grant database/dashboard roles to end users
to bypass this restriction. Free Brevo was proposed (300 emails/day); provider
account creation, sender verification, SMTP configuration and actual Hotmail
delivery remain external steps, not claimed successes. Do not buy a domain/plan,
put SMTP/admin secrets in Git/chat or turn off email confirmation to proceed.
The owner is unable to create the SMTP account at present. Continue development
and synthetic validation; do not interpret that as permission to bypass email
verification, use weak shared credentials or mark the two accounts activated.
Sources: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Brevo Free](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).

After configuration, invite the two users through the supported Auth admin UI/API.
No administrative Auth capability is exposed by this MCP connector; SQL inserts
into Auth or retrieving server-side secrets are not alternatives. Each participant
sets their own strong password through the verified email/recovery flow and
enrols/verifies their own TOTP. Prepare separate organizations/self links and
require sensitive AAL2 **before** releasing nutrition access. No professional
nutrition capabilities or cross-participant sharing are granted as a shortcut.
An invitation is not proof of delivery, password setup, consent or MFA activation.

## Tests and release gates

New PostgreSQL cases cover all history beyond a page, void snapshots, private
receipts/events, checksum, denied professional/other-user/tenant, archive read,
unconfirmed email, old JWT after link/session revocation, changed MFA policy,
complete refusal at volume limit and malformed/truncated/foreign manifests.
Chromium fixtures cover download, oversize error and a late A response after B.

The new guarded local browser runner uses only623xx synthetic Supabase,
preserves19 canonical records, checks source hashes and loopback binding, and
applies only the export candidate to the already prepared LOCAL instance.
It tests actual password login, TOTP/AAL2, two separate browser sessions,
independent mobile account, export and logout. No credentials, traces, videos or
authenticated screenshots enter public evidence. Published evidence binds SQL,
runner, browser test and affected UI hashes. This is not cloud validation.

Before activation: exact-destination authorization, final CI, schema/grants/RLS
inventory, configured Auth/SMTP, synthetic real cloud journeys and verified MFA.
Before health records: independent review and explicit privacy/retention/rights
decisions, with remaining high risks addressed or explicitly decided. Personal
testing does not authorize a commercial pilot.

Open high gates: compromised-password protection (not replaced by UI length/MFA),
global JWT/session policy, full account/MFA recovery, operational cloud restore
and measured RPO/RTO, legal/privacy/retention. A nutrition JSON export does not
close these. Free-service cold starts, quotas and pause behavior remain limitations.
Android hardware, TalkBack, native zoom, Safari and Firefox have not been tested.

Failure response: freeze new personal save RPCs using the separately reviewed
prepared freeze; preserve read/export, ownership filters, immutable history and
receipts. Do not reinstall old professional readers/RLS, delete history or run
historical staging mutators. Frontend rollback alone does not reverse schema or
data. A failed empty install rolls back atomically; do not drop populated schemas.
