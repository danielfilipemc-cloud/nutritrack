# AURA Business — white label
AURA Business is a provisional commercial label pending trademark/domain clearance.

Current scope:
- Organizations can store display_name and primary_color.
- Only org owner/admin can edit branding via database RLS.
- Any authenticated org member can read their org's branding.
- Branding preview page at /marca, no untrusted image URLs rendered.
- No custom domains, arbitrary HTML/CSS, file upload, DNS verification, or native branded apps yet.

Before launch:
- Check trademarks and register domains.
- Test owner/admin/coach access and tenant isolation in staging.
- Build approved logo upload to private storage with safe MIME handling and access policies.
- Custom domains require ownership proof, CNAME verification, TLS provisioning, anti-takeover controls.
- PWA manifests must be tenant-aware and cache-segregated; prevent cross-tenant leakage.
