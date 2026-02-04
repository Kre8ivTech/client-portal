"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

const PROJECT_TYPES = [
  { value: "website", label: "Website Development" },
  { value: "mobile_app", label: "Mobile App" },
  { value: "custom_software", label: "Custom Software" },
  { value: "ecommerce", label: "E-Commerce Solution" },
  { value: "api_integration", label: "API / Integration" },
  { value: "maintenance", label: "Maintenance & Support" },
  { value: "consulting", label: "Consulting / Strategy" },
  { value: "design", label: "UI/UX Design" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low - Flexible timeline" },
  { value: "medium", label: "Medium - Standard timeline" },
  { value: "high", label: "High - Priority delivery" },
  { value: "urgent", label: "Urgent - ASAP" },
];

const BUDGET_FLEXIBILITY = [
  { value: "fixed", label: "Fixed Budget" },
  { value: "flexible", label: "Somewhat Flexible" },
  { value: "negotiable", label: "Open to Discussion" },
];

interface RequestProjectDialogProps {
  organizationId: string;
}

export function RequestProjectDialog({ organizationId }: RequestProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    project_type: "",
    priority: "medium",
    requested_start_date: "",
    requested_end_date: "",
    estimated_budget_min: "",
    estimated_budget_max: "",
    budget_flexibility: "flexible",
    requirements: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Project name is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("project_requests").insert({
        organization_id: organizationId,
        requested_by: user.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        project_type: formData.project_type || null,
        priority: formData.priority,
        requested_start_date: formData.requested_start_date || null,
        requested_end_date: formData.requested_end_date || null,
        estimated_budget_min: formData.estimated_budget_min ? parseFloat(formData.estimated_budget_min) : null,
        estimated_budget_max: formData.estimated_budget_max ? parseFloat(formData.estimated_budget_max) : null,
        budget_flexibility: formData.budget_flexibility,
        requirements: formData.requirements.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: "Your project request has been submitted for review. We'll get back to you soon!",
      });

      setOpen(false);
      setFormData({
        name: "",
        description: "",
        project_type: "",
        priority: "medium",
        requested_start_date: "",
        requested_end_date: "",
        estimated_budget_min: "",
        estimated_budget_max: "",
        budget_flexibility: "flexible",
        requirements: "",
      });
      router.refresh();
    } catch (error: any) {
      console.error("Error submitting project request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit project request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FolderPlus className="mr-2 h-4 w-4" />
          Request New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Request a New Project</DialogTitle>
            <DialogDescription>Tell us about your project and we'll get back to you with a proposal.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Company Website Redesign"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Project Type */}
            <div className="space-y-2">
              <Label htmlFor="project_type">Project Type</Label>
              <Select
                value={formData.project_type}
                onValueChange={(value) => setFormData({ ...formData, project_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Brief Description</Label>
              <Textarea
                id="description"
                placeholder="Give us a brief overview of what you're looking to build..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Desired Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.requested_start_date}
                  onChange={(e) => setFormData({ ...formData, requested_start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Target Completion</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.requested_end_date}
                  onChange={(e) => setFormData({ ...formData, requested_end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Budget */}
            <div className="space-y-2">
              <Label>Estimated Budget Range (Optional)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="Min"
                    className="pl-7"
                    value={formData.estimated_budget_min}
                    onChange={(e) => setFormData({ ...formData, estimated_budget_min: e.target.value })}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    className="pl-7"
                    value={formData.estimated_budget_max}
                    onChange={(e) => setFormData({ ...formData, estimated_budget_max: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Budget Flexibility */}
            <div className="space-y-2">
              <Label>Budget Flexibility</Label>
              <Select
                value={formData.budget_flexibility}
                onValueChange={(value) => setFormData({ ...formData, budget_flexibility: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_FLEXIBILITY.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Detailed Requirements */}
            <div className="space-y-2">
              <Label htmlFor="requirements">Detailed Requirements</Label>
              <Textarea
                id="requirements"
                placeholder="Please provide any specific requirements, features, or functionality you need..."
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
