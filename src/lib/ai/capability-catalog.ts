export const AI_ROLES = ["super_admin", "staff", "partner", "partner_staff", "client"] as const;

export type AiRole = (typeof AI_ROLES)[number];

export type AiSkill = {
  slug: string;
  name: string;
  description: string;
};

export type AiTask = {
  slug: string;
  name: string;
  starterPrompt: string;
};

export type AiCapabilityAgent = {
  slug: string;
  name: string;
  description: string;
  instruction: string;
  href: string;
  roles: AiRole[];
  skills: AiSkill[];
  tasks: AiTask[];
};

export const CAPABILITY_AGENTS: AiCapabilityAgent[] = [
  {
    slug: "tickets",
    name: "Tickets",
    description: "Open, track, and reply to support tickets.",
    instruction:
      "Help the user open a ticket, choose a priority, follow status, and reply in the thread. Do not invent ticket numbers or statuses.",
    href: "/dashboard/tickets",
    roles: ["client", "partner", "partner_staff", "staff", "super_admin"],
    skills: [
      { slug: "open-ticket", name: "Open a ticket", description: "Explain the fields needed to submit a support ticket." },
      { slug: "track-status", name: "Track status", description: "Point the user to the ticket list and status filters." },
      { slug: "reply", name: "Reply on a ticket", description: "Explain how to add a comment on an existing ticket." },
    ],
    tasks: [
      { slug: "submit-ticket", name: "Submit a ticket", starterPrompt: "How do I submit a support ticket?" },
      { slug: "ticket-status", name: "Check ticket status", starterPrompt: "Where do I see the status of my tickets?" },
    ],
  },
  {
    slug: "messages",
    name: "Messages",
    description: "Portal messages and live chat.",
    instruction:
      "Help the user find conversations and start a message. Live chat is the separate button at the bottom of the screen. Do not invent message contents.",
    href: "/dashboard/messages",
    roles: ["client", "partner", "partner_staff", "staff", "super_admin"],
    skills: [
      { slug: "find-messages", name: "Find messages", description: "Direct the user to the messages inbox." },
      { slug: "start-conversation", name: "Start a conversation", description: "Explain how to begin a new portal conversation." },
    ],
    tasks: [
      { slug: "open-inbox", name: "Open messages", starterPrompt: "Where are my messages?" },
      { slug: "message-team", name: "Message the team", starterPrompt: "How do I message my team?" },
    ],
  },
  {
    slug: "projects",
    name: "Projects",
    description: "Project dashboard, tasks, timeline, and forum.",
    instruction:
      "Help the user open projects, project tasks, the timeline, and the project forum. Do not invent task owners or dates.",
    href: "/dashboard/projects",
    roles: ["client", "partner", "partner_staff", "staff", "super_admin"],
    skills: [
      { slug: "project-dashboard", name: "Project dashboard", description: "Open the project list and a project overview." },
      { slug: "project-tasks", name: "Project tasks", description: "Explain the project tasks page." },
      { slug: "timeline", name: "Timeline", description: "Point the user to the project timeline." },
      { slug: "forum", name: "Project forum", description: "Explain the project communication forum." },
    ],
    tasks: [
      { slug: "see-projects", name: "See projects", starterPrompt: "How do I see my projects?" },
      { slug: "project-tasks", name: "Project tasks and timeline", starterPrompt: "Where are project tasks and the timeline?" },
    ],
  },
  {
    slug: "contracts",
    name: "Contracts",
    description: "Review and sign contracts.",
    instruction:
      "Help the user find contracts and understand the signing flow. Do not draft legal terms or claim a contract is signed.",
    href: "/dashboard/contracts",
    roles: ["client", "partner", "partner_staff", "staff", "super_admin"],
    skills: [
      { slug: "find-contract", name: "Find a contract", description: "Open the contracts list." },
      { slug: "signing", name: "Signing status", description: "Explain where a user reviews and signs a contract." },
    ],
    tasks: [
      { slug: "review-contracts", name: "Review contracts", starterPrompt: "Where do I review my contracts?" },
      { slug: "sign-contract", name: "Sign a contract", starterPrompt: "How do I sign a contract?" },
    ],
  },
  {
    slug: "files",
    name: "Files",
    description: "Shared organization file storage.",
    instruction: "Help the user open file storage and upload or download files that belong to their organization.",
    href: "/dashboard/files",
    roles: ["client", "partner", "partner_staff", "staff", "super_admin"],
    skills: [
      { slug: "browse-files", name: "Browse files", description: "Open the storage page." },
      { slug: "upload-file", name: "Upload a file", description: "Explain how to add a file to storage." },
    ],
    tasks: [
      { slug: "shared-files", name: "Find shared files", starterPrompt: "Where are shared files?" },
      { slug: "upload", name: "Upload a file", starterPrompt: "How do I upload a file?" },
    ],
  },
  {
    slug: "knowledge-base",
    name: "Knowledge base",
    description: "Published help articles and the staff user guide.",
    instruction:
      "Point the user to published knowledge base articles. Staff and super admins can also use the user guide at /dashboard/user-guide.",
    href: "/dashboard/kb",
    roles: ["client", "partner", "partner_staff", "staff", "super_admin"],
    skills: [
      { slug: "search-articles", name: "Search articles", description: "Help the user look through the knowledge base." },
      { slug: "user-guide", name: "User guide", description: "Staff can open the in-app user guide for portal workflows." },
    ],
    tasks: [
      { slug: "open-kb", name: "Open the knowledge base", starterPrompt: "Where is the knowledge base?" },
      { slug: "find-article", name: "Find a help article", starterPrompt: "How do I find a help article?" },
    ],
  },
  {
    slug: "invoices",
    name: "Invoices",
    description: "Invoices and payment status.",
    instruction: "Help the user find invoices and payment status. Do not invent amounts, due dates, or payment results.",
    href: "/dashboard/invoices",
    roles: ["client", "partner", "partner_staff", "staff", "super_admin"],
    skills: [
      { slug: "find-invoice", name: "Find an invoice", description: "Open the invoice list." },
      { slug: "payment-status", name: "Payment status", description: "Explain where payment status is shown." },
    ],
    tasks: [
      { slug: "see-invoices", name: "See invoices", starterPrompt: "Where are my invoices?" },
      { slug: "pay-invoice", name: "Pay an invoice", starterPrompt: "How do I pay an invoice?" },
    ],
  },
  {
    slug: "billing",
    name: "Billing",
    description: "Billing and service plans for the account.",
    instruction: "Help the user open billing and plans. Do not change a subscription or quote a price that is not on the page.",
    href: "/dashboard/billing",
    roles: ["client", "partner", "staff", "super_admin"],
    skills: [
      { slug: "view-plan", name: "View plan", description: "Explain where the current plan is shown." },
      { slug: "billing-page", name: "Billing page", description: "Open billing and plan details." },
    ],
    tasks: [
      { slug: "see-plan", name: "See the plan", starterPrompt: "Where do I see my plan?" },
      { slug: "open-billing", name: "Open billing", starterPrompt: "How do I open billing?" },
    ],
  },
  {
    slug: "services",
    name: "Services",
    description: "Current services, requests, and the service catalog.",
    instruction:
      "Everyone can review current services and submit a service request. Partners and staff can also browse the service catalog and plans. Do not invent pricing.",
    href: "/dashboard/services/current",
    roles: ["client", "partner", "partner_staff", "staff", "super_admin"],
    skills: [
      { slug: "current-services", name: "Current services", description: "Open the services already assigned to the account." },
      { slug: "request-service", name: "Request a service", description: "Explain how to submit a service request." },
      { slug: "catalog", name: "Service catalog", description: "Partners and staff can browse the catalog of offered services." },
    ],
    tasks: [
      { slug: "my-services", name: "My services", starterPrompt: "What services do I have?" },
      { slug: "request", name: "Request a service", starterPrompt: "How do I request a service?" },
    ],
  },
  {
    slug: "vault",
    name: "Password vault",
    description: "Store shared logins for the organization.",
    instruction: "Help the user open the password vault. Never ask them to paste a password into chat and never repeat a secret.",
    href: "/dashboard/vault",
    roles: ["client", "partner", "staff", "super_admin"],
    skills: [
      { slug: "open-vault", name: "Open the vault", description: "Direct the user to the vault page." },
      { slug: "store-login", name: "Store a login", description: "Explain that logins are saved in the vault, not in chat." },
    ],
    tasks: [
      { slug: "find-vault", name: "Find the vault", starterPrompt: "Where is the password vault?" },
      { slug: "store-login", name: "Store a login", starterPrompt: "How should I store a login?" },
    ],
  },
  {
    slug: "profile",
    name: "Profile",
    description: "Profile details and account security.",
    instruction: "Help the user update their profile. Password and session security live at /dashboard/settings/security.",
    href: "/dashboard/profile",
    roles: ["client", "partner", "partner_staff", "staff", "super_admin"],
    skills: [
      { slug: "edit-profile", name: "Edit profile", description: "Explain how to update name and profile details." },
      { slug: "security", name: "Security settings", description: "Point the user to password and security settings." },
    ],
    tasks: [
      { slug: "update-profile", name: "Update profile", starterPrompt: "How do I update my profile?" },
      { slug: "change-password", name: "Change password", starterPrompt: "Where do I change my password?" },
    ],
  },
  {
    slug: "notifications",
    name: "Notifications",
    description: "Notification preferences.",
    instruction: "Help the user change notification preferences. Do not claim a notification was sent.",
    href: "/dashboard/settings/notifications",
    roles: ["client", "partner", "partner_staff", "staff", "super_admin"],
    skills: [
      { slug: "preferences", name: "Notification settings", description: "Open notification preferences." },
      { slug: "email-alerts", name: "Email alerts", description: "Explain that email alerts follow the preferences on that page." },
    ],
    tasks: [
      { slug: "change-notifications", name: "Change notifications", starterPrompt: "How do I change notification settings?" },
    ],
  },
  {
    slug: "white-label",
    name: "White label",
    description: "Partner brand for the partner team and their clients.",
    instruction:
      "Help a partner set the portal name, tagline, and colors that their team and child clients see after sign-in. A verified custom domain shows that brand on the agency hostname, including sign-in. Partner staff cannot edit the brand.",
    href: "/dashboard/settings/white-label",
    roles: ["partner", "super_admin"],
    skills: [
      { slug: "brand-identity", name: "Brand identity", description: "Explain name, tagline, logo, and primary color." },
      { slug: "custom-domain", name: "Custom domain", description: "Explain that a verified domain brands the sign-in host." },
    ],
    tasks: [
      { slug: "how-branding-works", name: "How branding works", starterPrompt: "How does white label branding work?" },
      { slug: "set-brand", name: "Set portal brand", starterPrompt: "Where do I set my portal name and colors?" },
    ],
  },
  {
    slug: "google-ads",
    name: "Google Ads",
    description: "Google Ads reporting for partner organizations.",
    instruction: "Help the user open Google Ads reporting. Do not invent spend, clicks, or campaign results.",
    href: "/dashboard/google-ads",
    roles: ["partner", "partner_staff"],
    skills: [
      { slug: "ads-overview", name: "Ads overview", description: "Open the partner ads overview and Google Ads page." },
      { slug: "campaign-questions", name: "Campaign questions", description: "Explain which screens show campaign reporting." },
    ],
    tasks: [
      { slug: "open-ads", name: "Open Google Ads", starterPrompt: "Where do I see Google Ads?" },
      { slug: "ads-overview", name: "Ads overview", starterPrompt: "What does the ads overview include?" },
    ],
  },
  {
    slug: "partner-overview",
    name: "Partner overview",
    description: "Portfolio of child clients, sites, ads, financials, and projects.",
    instruction:
      "Help the partner use the portfolio: clients, ads, site monitoring, client financials, and the project board. Do not invent client metrics.",
    href: "/dashboard/partner-overview",
    roles: ["partner", "partner_staff"],
    skills: [
      { slug: "client-portfolio", name: "Client portfolio", description: "Open the list of child clients." },
      { slug: "site-monitoring", name: "Site monitoring", description: "Open monitored sites." },
      { slug: "client-financials", name: "Client financials", description: "Open financials for child clients." },
    ],
    tasks: [
      { slug: "portfolio", name: "Client portfolio", starterPrompt: "Where is my client portfolio?" },
      { slug: "sites", name: "Site monitoring", starterPrompt: "How do I open site monitoring?" },
    ],
  },
  {
    slug: "financials",
    name: "Financials",
    description: "Invoicing, receivables, time, subscriptions, cash, budgets, and reports.",
    instruction:
      "Help staff open invoicing, receivables, time and utilization, subscriptions, cash, budgets, and financial reports. Do not invent revenue figures.",
    href: "/dashboard/financials",
    roles: ["staff", "super_admin"],
    skills: [
      { slug: "invoicing", name: "Invoicing", description: "Open invoicing and revenue." },
      { slug: "receivables", name: "Receivables", description: "Open accounts receivable." },
      { slug: "time", name: "Time and utilization", description: "Open time tracking and utilization." },
      { slug: "reports", name: "Reports", description: "Open financial reports." },
    ],
    tasks: [
      { slug: "reports", name: "Financial reports", starterPrompt: "Where are financial reports?" },
      { slug: "receivables", name: "Accounts receivable", starterPrompt: "How do I open accounts receivable?" },
    ],
  },
  {
    slug: "platform-integrations",
    name: "Platform integrations",
    description: "Stripe, AI providers, email, calendars, storage, and Zapier.",
    instruction:
      "Help a super admin connect Stripe, AI providers, email, calendars, storage, and Zapier. Never ask them to paste a live secret into chat. Tell them to enter keys on the integrations page.",
    href: "/dashboard/integrations",
    roles: ["super_admin"],
    skills: [
      { slug: "ai-providers", name: "AI providers", description: "Configure OpenRouter, Anthropic, OpenAI, or Gemini." },
      { slug: "payments", name: "Payments", description: "Connect Stripe for invoices." },
      { slug: "email", name: "Email", description: "Configure SMTP or Resend for notifications." },
      { slug: "storage", name: "Storage", description: "Configure S3 for files and contracts." },
    ],
    tasks: [
      { slug: "configure-ai", name: "Configure AI providers", starterPrompt: "Where do I configure AI providers?" },
      { slug: "connect-stripe", name: "Connect Stripe", starterPrompt: "How do I connect Stripe?" },
    ],
  },
  {
    slug: "organization-integrations",
    name: "Organization integrations",
    description: "Organization connections such as QuickBooks.",
    instruction:
      "Help connect organization integrations such as QuickBooks. Account-manager staff, partners, and super admins use this page. Platform-wide keys stay on the platform integrations page.",
    href: "/dashboard/settings/integrations",
    roles: ["partner", "staff", "super_admin"],
    skills: [
      { slug: "quickbooks", name: "QuickBooks", description: "Open the organization integration settings for accounting." },
    ],
    tasks: [
      { slug: "org-integrations", name: "Organization integrations", starterPrompt: "Where do I connect QuickBooks?" },
    ],
  },
  {
    slug: "clients",
    name: "Clients",
    description: "Client organizations in the user's scope.",
    instruction:
      "Help the user open the client list in their scope. Partners see their child clients. Do not invent client records.",
    href: "/dashboard/clients",
    roles: ["partner", "staff", "super_admin"],
    skills: [
      { slug: "client-list", name: "Client list", description: "Open the clients the user is allowed to see." },
      { slug: "client-access", name: "Client access", description: "Explain that visibility follows the user's organization and role." },
    ],
    tasks: [
      { slug: "manage-clients", name: "Manage clients", starterPrompt: "Where do I manage clients?" },
    ],
  },
  {
    slug: "email-templates",
    name: "Email templates",
    description: "Notification and invoice email templates.",
    instruction: "Help staff find and edit email templates. Do not send email from chat.",
    href: "/dashboard/settings/email-templates",
    roles: ["staff", "super_admin"],
    skills: [
      { slug: "find-template", name: "Find a template", description: "Open the email template list." },
      { slug: "edit-copy", name: "Edit template copy", description: "Explain that template content is edited on that page." },
    ],
    tasks: [
      { slug: "open-templates", name: "Open email templates", starterPrompt: "Where are email templates?" },
    ],
  },
];

export function normalizeAiRole(role: string | null | undefined): AiRole {
  if (role === "admin") return "super_admin";
  if (role && (AI_ROLES as readonly string[]).includes(role)) return role as AiRole;
  return "client";
}

export function capabilitiesForRole(role: string | null | undefined): AiCapabilityAgent[] {
  const normalized = normalizeAiRole(role);
  return CAPABILITY_AGENTS.filter((agent) => agent.roles.includes(normalized));
}

export function suggestedTasksForRole(role: string | null | undefined, limit = 6): Array<AiTask & { agentName: string; href: string }> {
  const agents = capabilitiesForRole(role);
  const roleSpecific = agents.filter((agent) => !agent.roles.includes("client"));
  const shared = agents.filter((agent) => agent.roles.includes("client"));
  const tasks: Array<AiTask & { agentName: string; href: string }> = [];
  for (const agent of [...roleSpecific, ...shared]) {
    const task = agent.tasks[0];
    if (!task) continue;
    tasks.push({ ...task, agentName: agent.name, href: agent.href });
    if (tasks.length >= limit) break;
  }
  return tasks;
}

export function buildCapabilityPrompt(role: string | null | undefined): string {
  const agents = capabilitiesForRole(role);
  const lines = [
    "[Capability agents]",
    "You can help only with the capabilities listed below. Each capability has an agent, skills, and tasks.",
    "Answer using that agent's instruction, name the matching page, and do not describe capabilities missing from this list.",
    "Do not invent account data, payment results, campaign metrics, or secrets.",
    "",
  ];

  for (const agent of agents) {
    lines.push(`Agent: ${agent.name} (${agent.href})`);
    lines.push(`Instruction: ${agent.instruction}`);
    lines.push(`Skills: ${agent.skills.map((skill) => skill.name).join(", ")}`);
    lines.push(`Tasks: ${agent.tasks.map((task) => task.starterPrompt).join(" | ")}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}
