# NutriTrack Business — SaaS foundation

A new commercial application in a **separate directory/branch**. The original NutriTrack app on main remains unchanged.

## Scope
- Multi-tenant organization, staff and client data model
- Read-only authenticated dashboard and client directory
- Supabase RLS: members only see their organization's clients
- No public tenant/member creation until invitations and checks are implemented
- No health data migration or production rollout

## Develop
1. `cd commercial`
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill with a **new Supabase project** URL and publishable key (never service-role).
4. Review and execute `supabase/schema.sql` in the **new project only**, after running DB tests.
5. `npm run dev`
6. Create organizations and memberships with trusted server-side administrative provisioning only. Never give users SQL editor access.

## Important
The database in this foundation is *not* connected to the previous personal NutriTrack Supabase project. This is intentional to avoid impacting existing users.
Deployment is disabled until RLS allow/deny tests, consent/data-protection review, audit logging, backups and permission review are complete.
No invoices, payments, exercise prescriptions or clinical assessments are implemented in this initial foundation.

## Roadmap
1. Access/invite flow and tenant isolation tests (including cross-tenant denial).
2. Client onboarding with consent and access roles, evaluation data model.
3. Measurements, history and charts, then selected NutriTrack nutritional routines.
4. Plans, reports, billing, white label and tenant administration.
