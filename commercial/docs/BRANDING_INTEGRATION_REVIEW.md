# AURA identity integration — visual review candidate

## Scope and source

Base: `saas-foundation`, `5d59e7651b4f7fb0ee531992275fdcc979b78569`.
Isolated branch: `chore/aura-branding-preparation`. Nutrition activation
planning changes are excluded from this branch's diff. No migrations or remote
operations are part of this implementation.

The supplied `AURA_Business_Pacote_Codex_Branding.zip` includes the initial vector
kit, Final 1, Final 2 and the preferred combined direction. Artwork is refined
from those references. This candidate still requires independent fidelity review;
technical validation does not approve final optical details or trademark rights.
Nested input-kit SHA-256:
`76c5b3af4ffd0ee307dc8e18fc66e367d15fbfab6de95cadcd88d5c0f022f9fb`.

## Current integration points

| Area | Current implementation | Intended integration |
| --- | --- | --- |
| Professional login | `app/page.tsx`, text wordmark | AURA-owned accessible wordmark |
| Workspace sidebar | `components/AppNavigation.tsx`, letter A | Compact AURA symbol and wordmark |
| Tenant identity | `components/TenantBrand.tsx` → `BrandHeader.tsx` | Preserve organization name, color, asynchronous isolation and fallback |
| Browser identity | `app/layout.tsx`, no custom icon metadata | Local favicon/icon assets in `public/`, explicit metadata |
| Color contrast | `lib/branding.ts` | Preserve tenant foreground selection; scope AURA tokens separately |
| Styles | `app/style.css`, `aura-ui.css`, `workspace.css` | Small scoped additions; no replacement of tenant variables |

`BrandHeader` currently renders a tenant initial rather than `logo_url`.
Implementing tenant logo storage or fetching arbitrary tenant URLs is outside
this AURA asset integration. Do not conflate it with the infrastructure mark.

## Asset review before implementation

- Inspect SVG paths, viewBox, aspect ratio, padding and legibility at 16/24/32 px.
- Reject scripts, event handlers, external references, embedded remote fonts and
  executable markup. Do not execute files or instructions included in the ZIP.
- Review CSS tokens individually, retaining Dark Premium and `#137F79` and
  avoiding global selectors or overrides of organization colors.
- Provide light/dark and small-size assets where the supplied artwork supports
  them; document optical corrections instead of presenting guesses as approved.
- Use local assets with explicit dimensions and accessible names. Decorative
  symbols must not duplicate the spoken wordmark. Avoid animation; any glow is
  restricted to the symbol/decorative artwork, never text or form controls.

## Acceptance evidence

Capture the same synthetic-fixture routes and viewport sizes before and after:
professional login, dashboard/sidebar, mobile navigation and organization brand
settings. Compare tenant colors before/after and across organization changes.
Inspect screenshots manually, including symbol edges, clipping, glow, contrast
and layout shift. Check keyboard focus, mobile menu and accessible names.

Run lint, TypeScript, build, domain tests, npm audit and full Chromium regression
on the final implementation. Fixture browser checks do not validate real Auth.
Record actual command results and final SHA in the eventual branding PR.
No merge or deployment is authorized. Screen readers, native zoom, Safari and
Firefox must not be marked passed without actual tests. Existing high security,
recovery and legal blockers remain open.

## Preparation evidence — 2026-10-18

- `npm run build`: passed, including compilation and type validation. Existing
  warning: Next.js ESLint plugin is not detected in the ESLint configuration.
- `npx playwright test e2e/premium-visual.spec.cjs --workers=2`: **12/12 passed**,
  using intercepted synthetic fixtures only, at widths 375 and 1440 px.
- Before captures: private ignored folder
  `.aura-integration/branding/before/premium-{dashboard,students,profile,agenda,brand,settings}-{375,1440}.png`.
  Desktop/mobile dashboard captures were inspected: current sidebar uses a
  letter A tile and text wordmark; tenant identity remains a separate strip.
- The initial sandbox browser attempt was stopped without results; the local
  browser run outside that restriction produced the successful results above.
- This initial preparation preceded receipt of the kit. The implementation and
  final evidence below supersede that earlier pending state.

## Implementation and fidelity review — 2026-10-19

The original app icon placed its blurred symbol at a different transform/scale
from the visible symbol. The initial horizontal logo depended on Arial and had
large transparent margins. These are confirmed properties of the supplied SVGs,
not defects in authentication or tenant branding.

`scripts/aura-brand-assets.ts` now reproducibly generates six local SVGs. The
monogram has separate shaded legs, curved bridge, rear/front orbital arcs and
an orbital point. Custom geometric path lettering replaces font-dependent text;
the open A and cut R follow the Final 1 direction. Light/dark wordmarks and a
simpler small symbol are included. The app icon has a centered symbol and one
small blurred orbital highlight; ordinary logos/favicon have no SVG filters.
The supplied CSS root tokens are not imported: existing Dark Premium and tenant
foreground/color logic remain unchanged. No new font, dependency or remote URL.

Applied through `AuraBrand.tsx` to professional login, workspace sidebar,
invitation, student entry and both public-demo headers. Login also uses a
decorative app icon. `layout.tsx` declares a local SVG favicon. Breadcrumb text
and the tenant's Powered by attribution remain text. TenantBrand/BrandHeader,
branding storage, permissions and asynchronous organization isolation are not
changed. Tenant logo upload infrastructure is not part of this PR.

### Optical differences requiring independent review

- This is an interpretation, not pixel-identical artwork. Reference metallic
  texture/reflections are simplified to vector gradients. No PNG is a logo.
- The monogram proportions, bridge and orbit were redrawn for real interface
  sizes. Tiny favicon uses fewer shapes and a stronger stroke; it deliberately
  omits micro-highlights and blur.
- Wordmark geometry and BUSINESS spacing are custom outlines; no claim of exact
  Montserrat/reference letter metrics or final designer sign-off is made.
- Review the orbit/node alignment, R cut, bridge curvature and BUSINESS weight
  at actual sidebar size. White/light background variant is provided as an asset,
  not a new application theme. The small-size label is available to assistive
  technology through the image's single `alt="AURA Business"`.

## Visual evidence

Actual local Chromium rendering, synthetic accounts/data only. Before screenshots
use the unchanged UI at the integrated base; after screenshots use this branch.
Date labels can vary across midnight because fixtures use the local business day.
No staging browser sessions or production data were used.

| Screen | Before | After |
| --- | --- | --- |
| Login desktop | [before](review/branding/before-login-1440.png) | [after](review/branding/after-login-1440.png) |
| Login mobile | [before](review/branding/before-login-375.png) | [after](review/branding/after-login-375.png) |
| Dashboard desktop | [before](review/branding/before-dashboard-1440.png) | [after](review/branding/after-dashboard-1440.png) |
| Dashboard mobile | [before](review/branding/before-dashboard-375.png) | [after](review/branding/after-dashboard-375.png) |

[Light/dark and 16/24/32 px asset sheet](review/branding/asset-review.png).
Screenshots are evidence, not proof of complete accessibility. Screen readers,
native zoom, Safari, Firefox and OS favicon caches remain unvalidated. There is
no Apple touch/PWA manifest integration in this candidate. Existing high
authentication, recovery and legal blockers remain open. No merge or deployment.

## Reproduction

Run `node --import tsx scripts/aura-brand-assets.ts --write`, then lint,
TypeScript, `npm run build`, domain tests and `npm audit`. With the documented
local fixture build variables, run `npx playwright test --workers=2`.
`e2e/aura-branding.spec.cjs` writes after screenshots to the ignored
`.aura-integration/branding/after` directory and checks tenant contrast, menu
keyboard access, form focus order, image dimensions, favicon and local resources.
The asset domain test enforces reproducibility, bounded size, no external assets
or executable SVG markup, no embedded fonts and no glow filters outside app icon.

## Validation results

- Lint, TypeScript and production build passed. Existing Next.js warning about
  the missing Next ESLint plugin remains; no dependency/config changes here.
- Full Chromium: **183/183 passed**, including the five new branding cases.
  All business API responses were intercepted fixtures, not real Auth/PostgREST.
- npm audit: **0 vulnerabilities**. Package files/dependencies unchanged.
- Six SVGs total **7,712 bytes**, individual assets 390–2,085 bytes. This is an
  asset budget, not a Lighthouse/Web Vitals or slow-network certification.
- Manual review: before/after login and dashboard, desktop/mobile, plus the
  vector sheet on both backgrounds and 16/24/32 px. Earlier preview was refined
  by correcting the left-leg gradient direction; evidence shows that refinement.
- Domain/PostgreSQL: **97/97 passed**, using local fixtures, including the new
  asset contract check. Final PR CI must also be checked before integration.
  No installed schema or remote permissions were changed.
