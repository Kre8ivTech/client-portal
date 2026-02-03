import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Ticket,
  FileText,
  Users,
  MessageSquare,
  BookOpen,
  BarChart3,
  Clock,
  FileEdit,
  History,
  UserCog,
  Plug,
  Layers,
  Building2,
  DollarSign,
  LineChart,
  ClipboardList,
  Wrench,
  Shield,
  Bell,
  Palette,
  CreditCard,
  Lock,
  User,
  Home,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Database } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata = {
  title: "Admin & Staff User Guide | KT-Portal",
  description: "Complete guide for administrators and staff members",
};

// Type for the user_profiles view
type UserProfile = Database["public"]["Views"]["user_profiles"]["Row"];

export default async function UserGuidePage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Get user role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, is_account_manager")
    .eq("id", user.id)
    .single<Pick<UserProfile, "role" | "is_account_manager">>();

  const role = profile?.role || "client";
  const isAccountManager = profile?.is_account_manager || false;

  // Only allow super_admin and staff to access this guide
  if (role !== "super_admin" && role !== "staff") {
    redirect("/dashboard");
  }

  const isSuperAdmin = role === "super_admin";

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin & Staff User Guide</h1>
        <p className="text-muted-foreground text-lg">
          Complete reference for managing the KT-Portal system
        </p>
      </div>

      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Your Role</AlertTitle>
        <AlertDescription>
          You are logged in as{" "}
          <Badge variant="default" className="ml-1">
            {isSuperAdmin ? "Super Admin" : "Staff"}
            {isAccountManager && " (Account Manager)"}
          </Badge>
          . This guide shows features available to you.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Getting Started
              </CardTitle>
              <CardDescription>
                Welcome to the KT-Portal admin and staff guide
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">What is KT-Portal?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  KT-Portal is a comprehensive multi-tenant client portal designed for Kre8ivTech
                  to manage client relationships, support tickets, invoicing, contracts, and more.
                  It serves white-label partners and direct clients with complete customization
                  capabilities.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Your Responsibilities</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {isSuperAdmin ? (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>
                          <strong>Full System Access:</strong> Manage all tenants, users, and
                          system settings
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>
                          <strong>Tenant Management:</strong> Create and configure partner
                          organizations
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>
                          <strong>User Administration:</strong> Manage staff, partners, and client
                          accounts
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>
                          <strong>System Configuration:</strong> Configure services, forms, and
                          global settings
                        </span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>
                          <strong>Support Tickets:</strong> Handle and resolve client support
                          requests
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>
                          <strong>Service Requests:</strong> Process and manage new service
                          requests
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>
                          <strong>Time Tracking:</strong> Log time spent on client work
                        </span>
                      </li>
                      {isAccountManager && (
                        <li className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>
                            <strong>Financial Management:</strong> Handle invoices and billing as
                            an account manager
                          </span>
                        </li>
                      )}
                    </>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Quick Navigation</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Use the sidebar to navigate between different sections. Key shortcuts:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm">
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">Cmd/Ctrl</kbd>
                    <span>+</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">K</kbd>
                    <span className="text-muted-foreground">Global Search</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dashboard Overview</CardTitle>
              <CardDescription>Your command center for daily operations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                The dashboard provides real-time insights into:
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                <li className="flex items-start gap-2 text-sm">
                  <Ticket className="h-4 w-4 mt-0.5 text-primary" />
                  <div>
                    <strong>Active Tickets</strong>
                    <p className="text-muted-foreground">Unresolved support requests</p>
                  </div>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 mt-0.5 text-primary" />
                  <div>
                    <strong>Live Chat</strong>
                    <p className="text-muted-foreground">Active chat sessions</p>
                  </div>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <FileText className="h-4 w-4 mt-0.5 text-primary" />
                  <div>
                    <strong>Recent Invoices</strong>
                    <p className="text-muted-foreground">Pending payments and drafts</p>
                  </div>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Clock className="h-4 w-4 mt-0.5 text-primary" />
                  <div>
                    <strong>Time Tracking</strong>
                    <p className="text-muted-foreground">Today&apos;s logged hours</p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Support Tickets
              </CardTitle>
              <CardDescription>
                Manage and resolve client support requests with queue-based prioritization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Ticket Management</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Support tickets are the primary way clients request help. Each ticket has:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Unique ID:</strong> Auto-generated (e.g., KT-1001)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Priority Levels:</strong> Low, Medium, High, Critical
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Status:</strong> New, Open, In Progress, Pending Client, Resolved,
                      Closed
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Queue Position:</strong> Real-time position in the support queue
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>SLA Tracking:</strong> Response and resolution time tracking
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">How to Handle Tickets</h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>
                    <strong>Review:</strong> Check ticket details, priority, and client history
                  </li>
                  <li>
                    <strong>Assign:</strong> Claim or assign to appropriate team member
                  </li>
                  <li>
                    <strong>Update Status:</strong> Change from &quot;New&quot; to &quot;In Progress&quot;
                  </li>
                  <li>
                    <strong>Communicate:</strong> Add comments and updates for the client
                  </li>
                  <li>
                    <strong>Track Time:</strong> Log time spent working on the ticket
                  </li>
                  <li>
                    <strong>Resolve:</strong> Mark as &quot;Resolved&quot; when complete
                  </li>
                  <li>
                    <strong>Close:</strong> Automatically closed after client confirmation
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Best Practices</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Respond to Critical tickets within 1 hour</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Keep clients informed with regular updates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Use internal notes for team communication</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Link related tickets together</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Always log your time accurately</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Service Requests
              </CardTitle>
              <CardDescription>
                Process new work requests and convert to projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Request Types</h3>
                <ul className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>New website development</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Website maintenance/updates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Hosting setup</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Plugin development</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>SEO services</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Design work</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Custom integrations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Consulting/strategy</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Service Request Workflow</h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Client submits service request with requirements</li>
                  <li>Review request and gather additional details if needed</li>
                  <li>Create quote with line items and pricing</li>
                  <li>Send quote to client for approval</li>
                  <li>Generate contract once approved</li>
                  <li>Convert to project and begin work</li>
                  <li>Create invoice upon completion</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Contracts & Proposals
              </CardTitle>
              <CardDescription>
                Create, send, and manage client contracts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Contract Types</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Service proposals</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Project contracts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Maintenance agreements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Retainer agreements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>NDAs and custom types</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Creating Contracts</h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Navigate to Admin → Manage Contracts</li>
                  <li>Click &quot;New Contract&quot; or use a template</li>
                  <li>Fill in client details and contract terms</li>
                  <li>Add deliverables and milestones</li>
                  <li>Review and preview the contract</li>
                  <li>Send to client for e-signature</li>
                  <li>Track signature status</li>
                  <li>Download signed PDF once complete</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">E-Signature Features</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Built-in signature capture (draw/type)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Complete audit trail (IP, timestamp, hash)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Automatic PDF generation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Email notifications for all parties</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Capacity Management
              </CardTitle>
              <CardDescription>
                Monitor team workload and resource allocation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The capacity view helps you understand team availability and workload distribution:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>View staff assignments and current workload</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Track hours allocated vs. available</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Identify overloaded or underutilized team members</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Balance work distribution across the team</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Plan ahead for new project assignments</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages & Live Chat
              </CardTitle>
              <CardDescription>
                Communicate with clients in real-time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Async Messaging</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Direct 1:1 conversations with clients</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Group conversations for project teams</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Threaded discussions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>File sharing and attachments</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>@mentions for notifications</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Live Chat Features</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Real-time chat sessions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Queue management for incoming chats</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Canned responses for common questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Insert KB articles during chat</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Convert chat to ticket if needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Transfer to another agent</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Knowledge Base
              </CardTitle>
              <CardDescription>
                Create and manage help articles for clients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Managing Articles</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  The Knowledge Base helps clients self-serve and reduces support load:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Create articles with rich text, images, and videos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Organize into categories (up to 3 levels deep)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Set access levels: Public, Partner, Internal, Client-specific</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Tag articles for better discoverability</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Track article views and feedback</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Articles auto-suggest during ticket creation</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Best Practices</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Write clear, concise titles</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Include screenshots and step-by-step instructions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Keep articles up to date</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Review poorly rated articles</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Client Management
              </CardTitle>
              <CardDescription>
                Manage client accounts and relationships
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Client Overview</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  The Clients page provides a central hub for managing all client accounts:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>View all clients and their status</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Access client details, contacts, and history</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>View client&apos;s active tickets and requests</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Check billing status and payment history</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Manage client plans and subscriptions</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Adding New Clients</h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Navigate to Clients section</li>
                  <li>Click &quot;Add New Client&quot;</li>
                  <li>Enter organization details</li>
                  <li>Set up primary contact</li>
                  <li>Assign a plan (if applicable)</li>
                  <li>Configure white-label branding (for partners)</li>
                  <li>Send welcome email with login instructions</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage users across all organizations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">User Roles</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Super Admin:</strong> Full system access (Kre8ivTech management)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Staff:</strong> Kre8ivTech team members with assigned work
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Partner:</strong> White-label agency owners with client management
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Partner Staff:</strong> Agency team members with limited access
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Client:</strong> End customers with access to their own data
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">User Management Tasks</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Create new user accounts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Assign roles and permissions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Reset passwords</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Enable/disable accounts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>View user activity and last login</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Manage 2FA settings</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Tenant Management
                </CardTitle>
                <CardDescription>
                  Manage partner organizations and their configurations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">What are Tenants?</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Tenants are separate organizations (partners) that use the portal. Each tenant
                    has:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Complete data isolation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Custom branding and white-label options</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Their own clients and users</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Separate billing and invoicing</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Managing Tenants</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Create new partner organizations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Configure white-label branding</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Set up custom domains</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>View tenant activity and statistics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Suspend or archive tenants</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          {(isSuperAdmin || isAccountManager) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Management
                </CardTitle>
                <CardDescription>
                  Create and manage client invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Creating Invoices</h3>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Navigate to Admin → Manage Invoices</li>
                  <li>Click &quot;New Invoice&quot;</li>
                  <li>Select client/organization</li>
                    <li>Add line items with descriptions and amounts</li>
                    <li>Apply taxes and discounts if needed</li>
                    <li>Set payment terms (Net 15, 30, 45, etc.)</li>
                    <li>Preview and send to client</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Invoice Features</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Sequential invoice numbering per tenant</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Multiple line items with quantity and rates</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Tax calculations (configurable rates)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Discounts (percentage or fixed amount)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Status tracking: Draft, Sent, Viewed, Paid, Overdue</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Stripe payment integration</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Automatic reminders and late fees</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>PDF generation and download</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Payment Terms</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Admins can configure default payment terms and client-specific overrides:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Preset terms: Net 15, Net 30, Net 45, Net 60, Due on Receipt</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Custom terms for specific clients</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Late fee configuration (percentage or fixed)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Grace period settings</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Plans Management
              </CardTitle>
              <CardDescription>
                Manage client plans and subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">What are Plans?</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Plans define service packages with included hours and features:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Monthly retainer hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Priority support levels</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Feature access controls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Hourly rates and pricing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Rollover policies</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Managing Plans</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Create new plan templates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Assign plans to clients</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Track hour usage and remaining balance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Handle plan upgrades/downgrades</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>View plan analytics and utilization</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financials Overview
                </CardTitle>
                <CardDescription>
                  Monitor financial performance and revenue
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground mb-3">
                  The Financials dashboard provides insights into:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Monthly recurring revenue (MRR)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Annual recurring revenue (ARR)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Outstanding invoices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Collection rates and aging</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Revenue by client and partner</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Profit margins and expenses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Financial trends and forecasting</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Reports
              </CardTitle>
              <CardDescription>
                Generate insights and analytics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Available Reports</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Ticket volume and resolution times</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>SLA compliance reports</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Staff productivity and time tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Client satisfaction (CSAT) scores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Revenue and billing reports</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Partner work volume tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Knowledge base usage analytics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>System usage and engagement</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Exporting Reports</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  All reports can be exported to:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>CSV for spreadsheet analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Excel format</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>PDF for sharing</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Tab */}
        <TabsContent value="admin" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Tracking
              </CardTitle>
              <CardDescription>
                Log and track time spent on client work
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Why Track Time?</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Time tracking helps with:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Accurate billing and invoicing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Plan hour allocation and usage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Staff productivity analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Project cost estimation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Resource planning and allocation</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">How to Log Time</h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Navigate to Time Tracking</li>
                  <li>Click &quot;Log Time&quot; or use the quick entry widget</li>
                  <li>Select the ticket, project, or task</li>
                  <li>Enter hours worked</li>
                  <li>Add a brief description of work done</li>
                  <li>Mark as billable/non-billable</li>
                  <li>Save the time entry</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Best Practices</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Log time daily, not in batches</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Be accurate - don&apos;t round up significantly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Include meaningful descriptions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Link time to specific tickets or tasks</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileEdit className="h-5 w-5" />
                Forms Builder
              </CardTitle>
              <CardDescription>
                Create custom forms for data collection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Form Capabilities</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  The form builder supports 25+ field types:
                </p>
                <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
                  <ul className="space-y-1">
                    <li>• Text (single/multi-line)</li>
                    <li>• Email & Phone</li>
                    <li>• Number & Currency</li>
                    <li>• Date, Time, DateTime</li>
                    <li>• Dropdown & Multi-select</li>
                    <li>• Radio & Checkboxes</li>
                    <li>• File & Image upload</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>• Signature capture</li>
                    <li>• Rating & Slider</li>
                    <li>• Address fields</li>
                    <li>• URL & Color picker</li>
                    <li>• Matrix/Grid questions</li>
                    <li>• Section headers</li>
                    <li>• Hidden fields</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Advanced Features</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Conditional logic (show/hide based on answers)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Multi-page forms with progress indicators</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Validation rules (required, min/max, regex)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Save draft capability for long forms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Form templates and cloning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Submission limits and scheduling</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Completion and drop-off analytics</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Use Cases</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Project intake forms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Client onboarding questionnaires</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Feedback and satisfaction surveys</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Service request details</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Manage Services
              </CardTitle>
              <CardDescription>
                Configure available services and pricing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-3">
                The Services section lets you define what services clients can request:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Create service catalog with descriptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Set pricing (fixed, hourly, or custom quote)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Define included deliverables</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Attach dynamic forms for requirements gathering</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Set estimated timelines</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Enable/disable services by client type</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                Integrations
              </CardTitle>
              <CardDescription>
                Connect with external services and tools
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Available Integrations</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Stripe:</strong> Payment processing and subscriptions
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Google OAuth:</strong> Sign in with Google
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Microsoft OAuth:</strong> Sign in with Microsoft
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>Apple OAuth:</strong> Sign in with Apple
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>DocuSign:</strong> Advanced e-signature workflows (future)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>
                      <strong>QuickBooks/Xero:</strong> Accounting sync (future)
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Configuring Integrations</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Navigate to Settings → Integrations to:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Connect/disconnect services</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Configure API keys and credentials</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Test connections</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>View integration logs</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {isSuperAdmin && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Audit Log
                  </CardTitle>
                  <CardDescription>
                    Track system changes and user activity
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">What&apos;s Logged?</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      The audit log tracks all sensitive actions:
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>User login/logout events</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Role and permission changes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Data access (who viewed what)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Configuration changes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Financial transactions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Data exports</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Security events</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Retention Policy</h3>
                    <p className="text-sm text-muted-foreground">
                      Audit logs are retained for 30 days. Logs can be exported before they expire
                      for long-term storage.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Using the Audit Log</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Filter by user, action type, or date range</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Search for specific events</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Export logs for compliance or investigation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Set up alerts for suspicious activity</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Assistant
                  </CardTitle>
                  <CardDescription>
                    Configure AI-powered features
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    The AI Assistant helps automate and enhance various workflows:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Automatic ticket triage and categorization</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Suggested responses based on KB articles</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Sentiment analysis on client communications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Smart KB article recommendations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Automated follow-up suggestions</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Settings
              </CardTitle>
              <CardDescription>
                System security and configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Security Features</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Two-factor authentication (2FA)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Session management and timeout</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>IP allowlisting/blocklisting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Password policies and requirements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>API rate limiting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Data encryption (at rest and in transit)</span>
                  </li>
                </ul>
              </div>

              {isSuperAdmin && (
                <div>
                  <h3 className="font-semibold mb-2">White-Label Branding</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Customize the portal appearance for partners:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Upload custom logo and favicon</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Customize color scheme (primary, secondary, accent)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Select typography (Google Fonts)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Custom CSS for advanced styling</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Branded email templates</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Custom portal name and tagline</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Support contact information</span>
                    </li>
                  </ul>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Notification Settings</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Configure how and when you receive notifications:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Email, push, in-app, or SMS channels</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Per-notification-type preferences</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Digest options: Real-time, Hourly, Daily, Weekly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Quiet hours to avoid interruptions</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Knowledge Base</p>
              <p className="text-sm text-muted-foreground">
                Search our comprehensive documentation
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Support Team</p>
              <p className="text-sm text-muted-foreground">
                Contact support if you need assistance with any feature
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Team Collaboration</p>
              <p className="text-sm text-muted-foreground">
                Reach out to other admins and staff for best practices
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
