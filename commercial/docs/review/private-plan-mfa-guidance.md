# Private plan: recent second-factor guidance

An AAL2 session can remain signed in after the existing ten-minute sensitive-read window expires. The account-security page previously described the technical AAL2 level as “segundo fator confirmado”, while a denied plan read offered a generic error without a direct route to revalidate. Refreshing the page or the session does not substitute a new TOTP challenge and verification.

The private security page now explains that distinction and links back to the plan. A denied plan read offers a direct link to Security and describes the exact confirmation action. It does not promise that MFA restores a revoked link or grant new permissions. The plan remains hidden on denial; an authorized retry removes the guidance and shows only the returned, validated scope. Existing draft-navigation guards continue to govern leaving the page.

No SQL, policy, grants, MFA/session configuration, time limit, food content or personal data is changed. The local real-Auth browser rehearsal exercises the verification button and return link, and its evidence includes the security component hash. Browser fixtures cover denial, absence of plan data, actionable recovery guidance and an authorized retry without a consumption write.

Positive cloud access still requires the participant to complete verification in their own browser/app session. No operator-generated JWT, session impersonation, MFA timestamp modification, factor reset or privileged credential is used. Existing authentication, recovery and RGPD gates remain open; technical tests do not establish commercial-pilot readiness.
