# AURA identity integration — preparation

## Scope and source

Base: `saas-foundation`, `f2a5e90cb8592043f839de2281c0a9c5cdf0ff0a`.
Isolated branch: `chore/aura-branding-preparation`. Nutrition activation
planning is excluded. No application changes, migrations or remote operations
are part of this preparation.

The requested vector ZIP and Final 1/Final 2 visual references have not yet
been supplied. Fidelity, final assets and after screenshots remain pending.
Do not substitute an invented logo or approve the identity without these inputs.

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
- No branding implementation or after captures yet. Login baseline capture,
  full regression and final CI remain pending with the actual vector kit.
