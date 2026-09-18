# Microsoft 365 portal mail

The production sender is `info@kre8ivtech.com`, an existing shared mailbox in the Castillo Collective Microsoft 365 tenant. Keep shared-mailbox sign-in blocked.

The server supports Microsoft Graph client-credentials delivery after configured SMTP and before Resend. Both SMTP and Microsoft failures remain failures; sends are not retried through a second provider. Graph HTTP 202 means accepted for processing, not confirmed inbox delivery.

## Dedicated application setup

1. Create a single-tenant application named `Kre8ivTech Portal Mail` with a service principal. Do not reuse unrelated file/calendar integrations.
2. Configure Exchange Online Application RBAC with `Application Mail.Send`, scoped only to the mailbox with primary SMTP address `info@kre8ivtech.com`. Do not also grant tenant-wide Microsoft Graph Mail.Send application permission: Entra and Exchange grants are additive.
3. Validate the intended mailbox is in scope and an unrelated mailbox is out of scope with `Test-ServicePrincipalAuthorization`.
4. Store a dedicated client secret in the server's protected runtime configuration; never in source control, browser variables, logs, or this document. Track its expiry in the credential-management process.

Required server-only variables:

- `MICROSOFT_MAIL_TENANT_ID`: directory UUID
- `MICROSOFT_MAIL_CLIENT_ID`: dedicated application UUID
- `MICROSOFT_MAIL_CLIENT_SECRET`: dedicated application secret
- `MICROSOFT_MAIL_SENDER`: `info@kre8ivtech.com`
- `MICROSOFT_MAIL_FROM_NAME`: `Kre8ivTech` (optional)

Templates control content and optional reply-to, but cannot change the Graph sending mailbox. Partial configuration fails visibly. Tokens and provider response bodies are never logged.

## Verification and current status

- Restored missing production SMTP table with migration `20260317000005`, followed atomically by `20260918000001_restrict_smtp_credentials`. Anonymous and authenticated database roles have no direct table access; authorized server routes use the service role.
- Microsoft 365 provider is implemented locally. Application authorization, runtime credentials, deployment, and real delivery remain pending.
- Verify provider acceptance, Exchange message trace, and receipt in an explicitly authorized test mailbox. Do not report inbox delivery based solely on HTTP 202.

References:

- https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac
- https://learn.microsoft.com/en-us/graph/api/user-sendmail
