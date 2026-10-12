# NutriTrack Business — product roadmap (draft)

## Product positioning
SaaS for personal trainers and independent fitness studios. Differentiation: fast physical evaluations + longitudinal progress and nutrition follow-up.
Avoid copying the competitor's protected assets or proprietary implementation.

## Implemented in saas-foundation
- New commercial Next.js scaffold, independent from the original static app.
- Multi-tenant organizations, membership, clients, RLS read access.
- Opt-in additive SQL for demo assessment records and authorized member client creation.
- Authenticated assessment entry and recent-history UI.

## Security release gates (NOT YET PASSED)
- CI build and real authenticated browser smoke test.
- Run new SQL in isolated staging project and exercise tenant A/B access denial.
- Confirm auth provisioning, role privileges, no data-exfiltration paths.
- Enforce controlled invitations, user lifecycle, revocation, staff assignments.
- Private health-data storage and deletion/export retention procedures.
- Data processing contracts, privacy notices, lawful basis and DPIA where required.
- Audit trail and correction flow, backups and recovery exercises.
- Rate limits and abuse defenses; supply-chain and dependency review.
- No production data until all above are satisfied.

## Next increments
1. Build & RLS integration tests in staging with synthetic identities.
2. Role-aware invitation and user provisioning.
3. Structured measurements/templates and historical charts.
4. Client self-service portal with explicitly limited permissions.
5. Nutrition and meal logging extraction from the original NutriTrack.
6. Subscription billing, branding and onboarding.

## Branding
NutriTrack Business is an internal placeholder, not an approved commercial name. Validate EU/Portugal trademarks and domains before launch.
