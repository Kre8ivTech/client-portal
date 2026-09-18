# Microsoft 365 calendar connections

The portal uses a separate multitenant Entra application, **Kre8ivTech Portal Integrations**, for delegated calendar authorization by staff and clients in other Microsoft 365 organizations. It does not share credentials or permissions with the background email sender.

- Application ID: `0b72b608-17cd-4673-8495-880d7db51216`
- Audience: `AzureADMultipleOrgs`; authorization authority: `organizations`.
- Web redirect: `https://clients.kre8ivtech.com/api/integrations/microsoft/callback`
- Delegated permissions: `openid profile email offline_access User.Read Calendars.ReadWrite`.
- No application calendar permissions or tenant-wide consent were granted during registration.
- Client credential expiration: 2027-09-18. Rotate before expiration.

Runtime configuration stays on the server: `MICROSOFT_CALENDAR_CLIENT_ID`, `MICROSOFT_CALENDAR_CLIENT_SECRET`, `OAUTH_STATE_SECRET`, and the existing `ENCRYPTION_SECRET`. The calendar client variables fall back to the legacy Microsoft variables for existing installations. Do not set generic Microsoft variables for this calendar-only app: OneDrive uses its own existing generic configuration and redirect.

Users connect through Settings > General. The callback verifies signed, expiring state, the initiating browser's PKCE verifier, the signed-in portal user, token expiry/calendar scope, and a successful Graph profile lookup. Tokens use the existing AES-256-GCM encryption key and a versioned `enc:v1:` envelope in the OAuth table. Never rotate the encryption key without migrating encrypted data. The UI receives only connection metadata. Only staff/admin connections are mirrored into staff capacity configuration.

This release establishes account authorization. It does not implement event synchronization, automatic appointment blocking, or a refresh-token worker. A connected badge does not prove events are syncing. Client tenants may require their own administrator approval or publisher verification before users can consent. An external-tenant consent test remains required before describing cross-organization use as verified.

Validation: unit regressions cover PKCE browser/session mismatch, encrypted storage and tampering, rejected Graph profiles, client organization association, and staff-only capacity mirroring. Complete a live user consent and callback test after deployment; registration and a successful build alone do not prove a connected calendar.
