# Codex implementation handoff — AURA Business
Repository: danielfilipemc-cloud/nutritrack
Working branch: saas-foundation
Path: commercial/
DO NOT alter legacy NutriTrack files on main, and do not migrate real user data.

Goal: Take existing commercial MVP scaffolding from committed code to a verified, locally working prototype.

## Execution
1. Inspect entire commercial/ folder; validate Next.js/React/TypeScript compatibility.
2. Run npm install inside commercial/, commit package-lock.json; pin suitable compatible versions if build errors appear.
3. Run npm run typecheck, npm run build; fix failures.
4. Add tests for meaningful domain logic, validations and race conditions. CI workflow using npm ci with lockfile.
5. Create an isolated development Supabase project only if securely available; never reuse legacy NutriTrack project.
6. Review SQL migration order: schema.sql -> 002_assessments.sql -> 003_branding.sql; improve repeatability and backwards safety.
7. Verify Postgres security with two organizations (A and B), two independent staff users; each must not read/create data for the other tenant. Verify unassigned user and anonymous denial; owner/admin can change only own branding, coach cannot. Include SQL/integration test harness and clear run instructions; never assume tests pass without execution.
8. Verify branded identity on /, /avaliacoes and /marca. Ensure changing org clears stale data and prevents late request results from appearing in wrong tenant.
9. Add accessible loading and error states; real form validation; remove needless exposures of health data. Do not add public signup, server secret, or production deployment until secured.
10. Update README/ROADMAP with actual test evidence; commit changes in incremental commits to the branch. Do not merge into main without explicit review.

Product direction: **AURA Business**, deep teal #137F79, white-label per organization. Trademark not yet cleared.
Prioritize security and correctness over feature count.
