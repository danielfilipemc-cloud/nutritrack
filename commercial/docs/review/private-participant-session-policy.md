# Private participant sessions: daily use and recent authorization

Decision: the private participant chose **up to thirty days per signed-in browser/app session**, with recent MFA retained for exports and security changes. This is an explicit opt-in for one participant/organization/client link. No membership, professional capability, sharing rule, global organization MFA setting or Supabase Auth configuration is changed. Commercial, legal and global session-policy gates remain open.

## Effective authorization

Normal own plan consultation/adjustment, food diary, manual daily references, private feedback/history and shared student measurements may use that scoped daily session. All endpoints still check the current link and Auth session in the database. A fresh sign-in using only a password is insufficient: the signed JWT must be AAL2 and its TOTP method must refer to this session's lifetime; the live `auth.sessions` row must also be AAL2 and linked to a currently verified TOTP factor belonging to the same account. The account must be confirmed and not banned. JWT expiry, provider `not_after`, link/session revocation and the absolute session limit are enforced on each request.

Thirty days counts from `auth.sessions.created_at`, not the latest token refresh or MFA confirmation. JWT access tokens remain short-lived and refresh normally. New MFA within an already thirty-day-old session cannot extend its daily access; the user must sign out and sign in again. The limit can end earlier on provider expiry, revocation or factor removal. This is application authorization, not a claim that Supabase's paid session-timeout settings have been enabled. Supabase's [session documentation](https://supabase.com/docs/guides/auth/sessions) distinguishes these controls from JWT lifetime and describes the live `session_id` binding.

Existing seven-day opt-ins retain their limit. The second incremental candidate permits thirty days and records subsequent assisted policy revisions in a private immutable history. A baseline flag distinguishes existing policy snapshots captured during upgrade from later complete changes. Neither schema source automatically inserts or extends a participant's policy.

Complete nutrition, plan and feedback exports keep the original recent-MFA check (ten minutes). Historical implementations are renamed to owner-only cores with authenticated grants removed; public wrappers remain invoker. Professional operations, access administration, privacy-review actions and security settings retain their original recent-MFA authorization. There is no new browser policy writer.

The recent-export check is an operation control, not data-loss prevention: an authorized own-data reader can copy the information they are permitted to view. A retained session increases exposure on a stolen/unlocked device or after token theft; thirty days is the participant's chosen convenience/security tradeoff for this private trial. It is not approval for professional or cross-participant access or a commercial rollout.

## UI and history

The private shell reports the effective scope's duration and tells the user whether MFA confirmation or a new sign-in is needed. Privacy/export operations retain recent-MFA guidance. Failed or out-of-order checks do not establish permission; the database remains authoritative. Existing drafts, receipt reconciliation, conflicts, origin and scope guards are preserved.

Daily feedback history has a separate bounded endpoint (20 immutable entries per page, descending revision cursor). It never invokes the complete-export RPC on mount. Concurrent newer entries do not change older pages already being browsed; refreshing starts a new view. This paginated view does not claim complete export. The existing contiguous complete export contract remains separate and refuses truncation.

## Validation boundaries

PostgreSQL cases cover old MFA within a daily session, AAL1, expired JWT, other users/scopes, revoked links/sessions, missing factor, banned accounts, absolute expiry, legacy policy fallback, historical grants, professional step-up, cursor gaps and concurrent history additions. UI fixtures cover mobile, malformed/failed checks, late A→B responses and the separation between history and export.

The guarded local Auth runner uses only invented accounts and localhost. After legitimate TOTP enrollment/verification, it **simulates age exclusively in the synthetic local Auth fixture** (session 29 days, MFA twenty minutes), refreshes through GoTrue, then verifies signed-token daily reads and rejected recent exports. At 31 days the same authenticated session is rejected. This is not a month-long clock test or modification of real Auth records. Browser password/TOTP, two sessions, history, exports and logout are tested separately with real local GoTrue/PostgREST. Evidence hashes include the SQL, runner and UI. Chromium viewport tests do not certify Android hardware, TalkBack, native zoom, Safari or Firefox.

## Controlled activation and reversal

Prepare with `npx tsx scripts/private-daily-session-activation.ts --prepare`. The schema packet targets only `ivwrvaycolqlpsjvdaod`, verifies all nineteen canonical checksums plus the five installed private sources, rejects a partial/repeated installation and enables no participant policy. All new tables are private, RLS-enabled and without browser grants. No personal content or account identifiers enter Git.

After CI, inspect the private service `srv-dbrqt061egvs73bvnvg0`, retain Free/auto-deploy off, fast-forward only `release/aura-private` and deploy the exact validated head with `NEXT_PUBLIC_AURA_PRIVATE_DAILY_SESSION=1`. Verify the LIVE artifact and RPC/grant inventory. Only then enable the explicitly authorized own link, using a separate private scope-bound script that refuses an existing policy, requires a legitimate recent participant TOTP verification and appends an assisted audit event and policy revision. Never change MFA timestamps, mint participant JWTs, collect codes/passwords or relax the organization policy to make activation pass.

If activation fails, leave the policy absent: legacy recent MFA remains effective. If reversal becomes necessary, first disable only this scope's opt-in with an expected policy revision and reason; this restores the original recent-MFA gate without deleting any history. Then roll back only the private UI artifact if needed. Do not drop tables, run historical installers, alter protected projects or restore an unfiltered reader.

Open high gates: compromised-password protection, complete global JWT/session policy, operational cloud restore, full account/MFA recovery, RGPD, lawful basis and retention. This change does not close or certify any of them.
