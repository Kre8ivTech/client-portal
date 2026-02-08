"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2 } from "lucide-react";
import {
  createProjectSchema,
  CreateProjectInput,
  PROJECT_STATUS_OPTIONS,
  PROJECT_PRIORITY_OPTIONS,
  PROJECT_MEMBER_ROLE_OPTIONS,
  PROJECT_ORG_ROLE_OPTIONS,
} from "@/lib/validators/project";

type StaffUser = {
  id: string;
  email: string;
  role: string;
  profiles: { name: string | null; avatar_url: string | null } | null;
};

type Organization = {
  id: string;
  name: string;
  type: string;
  status: string;
};

interface CreateProjectDialogProps {
  staffUsers: StaffUser[];
  organizations: Organization[];
  userOrganizationId: string | null;
}

type MemberSelection = {
  userId: string;
  role: string;
};

type OrgSelection = {
  organizationId: string;
  role: string;
};

export function CreateProjectDialog({ staffUsers, organizations, userOrganizationId }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<MemberSelection[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<OrgSelection[]>([]);
  const router = useRouter();
  const supabase = createClient();

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "planning",
      priority: "medium",
      start_date: null,
      target_end_date: null,
      tags: [],
    },
  });

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) => {
      const existing = prev.find((m) => m.userId === userId);
      if (existing) {
        return prev.filter((m) => m.userId !== userId);
      }
      return [...prev, { userId, role: "team_member" }];
    });
  };

  const updateMemberRole = (userId: string, role: string) => {
    setSelectedMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
  };

  const toggleOrg = (organizationId: string) => {
    setSelectedOrgs((prev) => {
      const existing = prev.find((o) => o.organizationId === organizationId);
      if (existing) {
        return prev.filter((o) => o.organizationId !== organizationId);
      }
      return [...prev, { organizationId, role: "client" }];
    });
  };

  const updateOrgRole = (organizationId: string, role: string) => {
    setSelectedOrgs((prev) => prev.map((o) => (o.organizationId === organizationId ? { ...o, role } : o)));
  };

  async function onSubmit(values: CreateProjectInput) {
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      // Create the project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: values.name,
          description: values.description || null,
          status: values.status,
          priority: values.priority,
          start_date: values.start_date || null,
          target_end_date: values.target_end_date || null,
          tags: values.tags || [],
          organization_id: userOrganizationId,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (projectError) throw projectError;

      // Add team members
      if (selectedMembers.length > 0) {
        const memberInserts = selectedMembers.map((m) => ({
          project_id: project.id,
          user_id: m.userId,
          role: m.role,
          assigned_by: user.id,
        }));

        const { error: membersError } = await supabase.from("project_members").insert(memberInserts);

        if (membersError) {
          console.error("Error adding members:", membersError);
        }
      }

      // Add organizations
      if (selectedOrgs.length > 0) {
        const orgInserts = selectedOrgs.map((o) => ({
          project_id: project.id,
          organization_id: o.organizationId,
          role: o.role,
          assigned_by: user.id,
        }));

        const { error: orgsError } = await supabase.from("project_organizations").insert(orgInserts);

        if (orgsError) {
          console.error("Error adding organizations:", orgsError);
        }
      }

      setOpen(false);
      form.reset();
      setSelectedMembers([]);
      setSelectedOrgs([]);
      router.refresh();
      router.push(`/dashboard/projects/${project.id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus size={18} />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>Set up a new project and assign team members and organizations.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 pb-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter project name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the project objectives and scope..."
                          className="min-h-[100px]"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROJECT_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROJECT_PRIORITY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="target_end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target End Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Team Members Section */}
                <div className="space-y-3">
                  <Label>Team Members</Label>
                  <p className="text-sm text-muted-foreground">Select team members to assign to this project.</p>
                  <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                    {staffUsers.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">No staff users available.</p>
                    ) : (
                      <div className="divide-y">
                        {staffUsers.map((user) => {
                          const isSelected = selectedMembers.some((m) => m.userId === user.id);
                          const selection = selectedMembers.find((m) => m.userId === user.id);
                          const displayName = user.profiles?.name ?? user.email;

                          return (
                            <div key={user.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={`member-${user.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleMember(user.id)}
                                />
                                <Label htmlFor={`member-${user.id}`} className="cursor-pointer font-normal">
                                  <span className="block">{displayName}</span>
                                  <span className="text-xs text-slate-500">{user.email}</span>
                                </Label>
                              </div>
                              {isSelected && (
                                <Select
                                  value={selection?.role ?? "team_member"}
                                  onValueChange={(value) => updateMemberRole(user.id, value)}
                                >
                                  <SelectTrigger className="w-[150px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PROJECT_MEMBER_ROLE_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Organizations Section */}
                <div className="space-y-3">
                  <Label>Organizations</Label>
                  <p className="text-sm text-muted-foreground">Assign client organizations to this project.</p>
                  <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                    {organizations.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">No organizations available.</p>
                    ) : (
                      <div className="divide-y">
                        {organizations.map((org) => {
                          const isSelected = selectedOrgs.some((o) => o.organizationId === org.id);
                          const selection = selectedOrgs.find((o) => o.organizationId === org.id);

                          return (
                            <div key={org.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={`org-${org.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleOrg(org.id)}
                                />
                                <Label htmlFor={`org-${org.id}`} className="cursor-pointer font-normal">
                                  <span className="block">{org.name}</span>
                                  <span className="text-xs text-slate-500 capitalize">{org.type}</span>
                                </Label>
                              </div>
                              {isSelected && (
                                <Select
                                  value={selection?.role ?? "client"}
                                  onValueChange={(value) => updateOrgRole(org.id, value)}
                                >
                                  <SelectTrigger className="w-[150px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PROJECT_ORG_ROLE_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
