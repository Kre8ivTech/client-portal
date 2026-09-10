import type { DashboardRole } from "@/lib/require-role";

export const ORG_INTEGRATIONS_HREF = "/dashboard/settings/integrations";
export const ADMIN_INTEGRATIONS_HREF = "/dashboard/admin/settings/integrations";
export const PLATFORM_INTEGRATIONS_HREF = "/dashboard/integrations";

export function getHrefsForRole(role: DashboardRole, isAccountManager: boolean): string[] {
  const projectPages = [
    "/dashboard/projects/tasks",
    "/dashboard/projects/timeline",
    "/dashboard/projects/communication",
  ];

  // Base client navigation
  const servicesClient = [
    "/dashboard/service",
    "/dashboard/tickets",
    "/dashboard/services/current",
  ];
  const projectsClient = [
    "/dashboard/projects",
    "/dashboard/projects/tasks",
    "/dashboard/projects/timeline",
    "/dashboard/projects/communication",
  ];
  const filesClient = [
    "/dashboard/contracts",
    "/dashboard/files",
  ];
  const communicationsClient = [
    "/dashboard/messages",
  ];
  const supportClient = [
    "/dashboard/tickets",
    "/dashboard/kb",
  ];
  const supportAdminStaff = [
    ...supportClient,
    "/dashboard/user-guide",
  ];
  const accountBase = [
    "/dashboard/profile",
    "/dashboard/billing",
    "/dashboard/invoices",
    "/dashboard/invoices#proposals",
    "/dashboard/vault",
  ];
  // Account items without invoices (for non-account-manager staff)
  const accountBaseNoInvoices = [
    "/dashboard/profile",
    "/dashboard/billing",
    "/dashboard/vault",
  ];
  const settingsBase = [
    "/dashboard/settings",
    "/dashboard/settings/security",
    "/dashboard/settings/notifications",
    "/dashboard/settings/file-storage",
  ];
  const whiteLabel = "/dashboard/settings/white-label";
  const emailTemplates = "/dashboard/settings/email-templates";
  const services = "/dashboard/services";
  const capacity = "/dashboard/capacity";
  
  const adminStaff = [
    "/dashboard/users",
    "/dashboard/plans",
    "/dashboard/financials",
    "/dashboard/financials/invoicing",
    "/dashboard/financials/receivables",
    "/dashboard/financials/time-tracking",
    "/dashboard/financials/subscriptions",
    "/dashboard/financials/cash-flow",
    "/dashboard/financials/budgeting",
    "/dashboard/financials/reports",
    "/dashboard/reports",
    "/dashboard/time",
    "/dashboard/forms",
  ];

  switch (role) {
    case "super_admin":
      return [
        "/dashboard",
        ...servicesClient,
        services,
        ...projectsClient,
        ...filesClient,
        ...communicationsClient,
        ...supportAdminStaff,
        ...accountBase,
        ...settingsBase,
        whiteLabel,
        emailTemplates,
        ORG_INTEGRATIONS_HREF,
        capacity,
        "/dashboard/clients",
        "/dashboard/projects",
        ...projectPages,
        ...adminStaff,
        "/dashboard/admin/staff-management",
        "/dashboard/admin/permissions",
        "/dashboard/admin/services",
        "/dashboard/admin/contracts",
        "/dashboard/admin/notifications",
        "/dashboard/admin/settings/sla",
        "/dashboard/admin/settings/auth",
        ADMIN_INTEGRATIONS_HREF,
        PLATFORM_INTEGRATIONS_HREF,
        "/dashboard/admin/ai-usage",
        "/dashboard/tenants",
        "/dashboard/audit",
        "/dashboard/admin/error-logs",
      ];
    case "staff":
      // Staff with account manager flag sees invoices, otherwise they don't
      return [
        "/dashboard",
        ...servicesClient,
        services,
        ...projectsClient,
        ...filesClient,
        ...communicationsClient,
        ...supportAdminStaff,
        ...(isAccountManager ? accountBase : accountBaseNoInvoices),
        "/dashboard/settings/email-templates",
        "/dashboard/projects",
        ...projectPages,
        ...settingsBase,
        emailTemplates,
        ...(isAccountManager ? [ORG_INTEGRATIONS_HREF] : []),
        capacity,
        "/dashboard/clients",
        ...adminStaff,
        "/dashboard/admin/staff-management",
        "/dashboard/admin/services",
        "/dashboard/admin/contracts",
        "/dashboard/admin/notifications",
        "/dashboard/admin/ai-usage",
      ];
    case "partner":
      return [
        "/dashboard",
        "/dashboard/partner-overview",
        "/dashboard/partner-overview/clients",
        "/dashboard/partner-overview/ads",
        "/dashboard/partner-overview/sites",
        "/dashboard/partner-overview/financials",
        "/dashboard/partner-overview/projects",
        "/dashboard/google-ads",
        ...servicesClient,
        services,
        ...projectsClient,
        ...filesClient,
        ...communicationsClient,
        ...supportClient,
        ...accountBase,
        ...settingsBase,
        ORG_INTEGRATIONS_HREF,
        whiteLabel,
        "/dashboard/clients",
        "/dashboard/projects",
        ...projectPages,
        "/dashboard/plans",
        "/dashboard/reports",
      ];
    case "partner_staff":
      return [
        "/dashboard",
        "/dashboard/partner-overview",
        "/dashboard/partner-overview/clients",
        "/dashboard/partner-overview/ads",
        "/dashboard/partner-overview/sites",
        "/dashboard/partner-overview/financials",
        "/dashboard/partner-overview/projects",
        "/dashboard/google-ads",
        ...servicesClient,
        ...projectsClient,
        ...filesClient,
        ...communicationsClient,
        ...supportClient,
        "/dashboard/projects",
        ...projectPages,
        "/dashboard/invoices",
        "/dashboard/settings",
        "/dashboard/settings/file-storage",
        "/dashboard/profile",
        "/dashboard/settings#security",
        "/dashboard/settings#notifications",
      ];
    case "client":
      return [
        "/dashboard",
        ...servicesClient,
        ...projectsClient,
        ...filesClient,
        ...communicationsClient,
        ...supportClient,
        ...accountBase,
        ...settingsBase,
      ];
    default:
      return [];
  }
}

