# Mobile installation and nutrition preparation — 2026-11-13

## Effective scope

Candidate based on PR #84, `e5dd884f86074553084ac375a3d3f1e5f17b495c`.
The private-account/synchronization route was selected over a local-only health
store. No personal measurements, names, dietary targets or meal plans were added
to the repository. The UI and tests use invented inputs only.

This increment does not activate personal nutrition, synchronize targets, create
accounts, execute SQL, install a service worker or publish an application.
Native nutrition remains behind the existing build opt-in and server permissions.

## Implemented

- `app/manifest.ts`: institutional PWA manifest, scope `/`, start `/`, standalone,
  AURA theme and local raster icons. No identity, organization or authentication
  parameters in URLs. Existing tenant CSS and branding are preserved.
- `/instalar`: Android/Chrome instructions, optional browser install prompt,
  cancellation/error/installed states, keyboard navigation and 320px layout.
  Links from login and settings. Installation does not imply authorization to use
  real data. This is an online application; offline mode is not advertised.
- `public/brand/aura-install-{192,512}.png`: rasterizations of the existing
  approved institutional app icon, generated with the installed Sharp dependency.
  No new package, external asset, font or analytics endpoint.
- `NutritionPlanningTools`: a disclosure within the **existing authorized diary**,
  with manual reference values, product/brand/preparation, composition per100g,
  portion preview and one-nutrient quantity solver. No automatic energy target,
  clinical recommendation, breastfeeding deficit or food substitution algorithm.
- Explicit transfer of a product to the existing meal draft; consumption is only
  declared by the existing save operation. The old V1 command persists the manual
  composition snapshot and product/brand/preparation in its label. No new command
  fields or installed database contracts.
- Reuse of previously recorded snapshots from the **loaded current-day records**
  for the selected client. Different compositions remain distinct. This is not a
  global product catalogue, brand database, barcode lookup or MyFitnessPal API.
- Pure manual-reference V1 validation, no implicit null-to-zero conversion,
  signed differences, no daily balance for paginated reads (even after the last
  page: concurrent edits are not a pinned snapshot), no records or unknown
  composition. A single-page read is a statement-time snapshot, not a continuing
  guarantee that another device has not since changed it. Per100ml labels are
  explicitly unsupported; no implicit density.

## Drafts and authorization

Planning is an in-memory draft, explicitly labelled as unsaved/unsynchronized.
It participates in the existing outer profile/navigation/beforeunload guard.
It survives a meal save and a diary refresh. Changing day asks before discarding
planning; cancellation leaves all drafts untouched. Identity/tenant/client keys
mount a fresh context. A denied refresh hides/disables the tools without silently
throwing the draft away; successful authorization in the same context restores it.
Known uncertain writes keep the existing receipt-based flow and prevent transfer.

No target is accepted as an automatic clinical prescription. Shared meal recipes
may have individually weighed quantities; copying another account's daily target
or using a fixed multiplier is not the proposed personalized model.

## Caching and installation boundaries

The existing `Cache-Control: no-store` response policy is unchanged. There is no
worker or CacheStorage interception: authenticated responses, RPCs, tokens and
health data are never added to an offline cache by this increment. No browser
localStorage/IndexedDB health store was introduced. Existing session behavior is
unchanged. The manifest is public metadata only.

The in-browser install event tests are simulations. Actual Android installation,
OS update/uninstall behavior, hardware keyboards, TalkBack, native zoom, iOS,
Safari and Firefox require real-device/manual validation. A local Chromium
viewport is not evidence that those checks passed. HTTPS publication and a
reviewed private data environment remain separate gates.

## Validation commands

Use Node22.23.3. On Windows set `AURA_TEST_PYTHON` to a usable Python3 interpreter
for the existing backup test, and ensure GPG is available (or use its existing
WSL/Linux test procedure); do not disable the backup test.

```sh
npm run check
npm audit --audit-level=moderate
npm run test:e2e
```

`test:e2e` builds a synthetic native opt-in artifact for the nutrition tests,
then restores and tests the normal disabled-by-default artifact. All browser
mutations are intercepted fixtures. Domain tests include embedded PostgreSQL/RLS;
these are distinct from real GoTrue/PostgREST and cloud/device evidence. No real
Auth test result from an older revision should be represented as a new run.

Screenshots (local, synthetic): `.aura-integration/mobile-install-{320,desktop}.png`
and `.aura-integration/nutrition-planning-{320,desktop}.png`.

## Required before private synchronized use

See `PRIVATE_NUTRITION_SYNC_PLAN.md`. In particular, students are intentionally
denied the professional nutrition RPCs today. Installation and this planning tool
do not replace the missing self-service contracts or close any security/legal
gate. Production, staging, protected databases and service plans remain unchanged.

High blockers remain open: compromised-password protection, effective session/JWT
policy, account/MFA recovery, operational cloud restore and legal/privacy/retention
decisions. No real-data pilot is authorized by this code increment.
