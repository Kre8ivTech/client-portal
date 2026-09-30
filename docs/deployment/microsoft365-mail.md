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
- Microsoft 365 provider revision `b75f062` is deployed on AWS with server-only credentials. Application authentication succeeds. Exchange mailbox authorization and real delivery remain blocked as described below.
- Verify provider acceptance, Exchange message trace, and receipt in an explicitly authorized test mailbox. Do not report inbox delivery based solely on HTTP 202.

References:

- https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac
- https://learn.microsoft.com/en-us/graph/api/user-sendmail

## Deployment verification, 2026-09-18

- Twelve targeted tests, TypeScript, production build, and GitHub checks passed. Lint: zero errors, 13 existing warnings.
- AWS image: `kre8ivtech-client-portal:microsoft-mail`, runtime ID `sha256:0bd6a9eb4e5492eca8ee9da064435967656783a24c20e29eb084df3ce894abcc`. Archive SHA-256: `1ee442710a70cd267174fd875fc56d7aafc49d494e35b802b2a56f631cbd2712`. Local and AWS filesystem layers match.
- Container: `kre8ivtech-client-portal-candidate`, same localhost port, 512 MB memory, 0.5 CPU and 384 MB Node heap. Public health passes, login returns 200, unauthenticated dashboard redirects, and signed-in dashboard loads.
- Rollback container: `kre8ivtech-client-portal-before-mail`; runtime backup: `/opt/kre8ivtech-client-portal/runtime.before-microsoft-mail.env`.
- Dedicated app: `Kre8ivTech Portal Mail`, client ID `5b0a247d-bfa3-4818-9a5a-711828459f01`. Credential expiry: 2027-09-18. No tenant-wide API permissions granted.

## Exchange authorization blocker

The shared mailbox and Exchange service-principal pointer exist. The management scope and Application Mail.Send role assignment were not created.

`Get-OrganizationConfig` reports `IsDehydrated=False`, `IsUpdatingServicePlan=False`, `IsUpgradingOrganization=False`. Explicit `Enable-OrganizationCustomization` returns: "This operation is not required. Organization is already enabled for customization." Yet repeated `New-ManagementScope` with the exact primary SMTP filter fails: "The command you tried to run isn't currently allowed in your organization. To run this command, you first need to run the command: Enable-OrganizationCustomization."

Microsoft must resolve this inconsistent state, or it must propagate, before authorization can finish. Do not grant unrestricted tenant-wide mail permissions as a workaround. A Microsoft support request was drafted, not submitted. No real email was sent.
