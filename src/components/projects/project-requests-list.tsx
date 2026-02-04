"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, CheckCircle, XCircle, Eye, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

interface ProjectRequest {
  id: string;
  request_number: string;
  name: string;
  description: string | null;
  project_type: string | null;
  priority: string;
  status: string;
  requested_start_date: string | null;
  requested_end_date: string | null;
  estimated_budget_min: number | null;
  estimated_budget_max: number | null;
  created_at: string;
  requested_by: string;
  requester: {
    id: string;
    email: string;
    profiles: { name: string | null } | null;
  } | null;
}

interface ProjectRequestsListProps {
  requests: ProjectRequest[];
  canReview: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  under_review: { label: "Under Review", variant: "default" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  converted: { label: "Converted", variant: "default" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "text-slate-600 bg-slate-100" },
  medium: { label: "Medium", className: "text-blue-600 bg-blue-100" },
  high: { label: "High", className: "text-orange-600 bg-orange-100" },
  urgent: { label: "Urgent", className: "text-red-600 bg-red-100" },
};

export function ProjectRequestsList({ requests, canReview }: ProjectRequestsListProps) {
  const [selectedRequest, setSelectedRequest] = useState<ProjectRequest | null>(null);
  const [actionDialog, setActionDialog] = useState<"view" | "approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleAction = async (action: "approve" | "reject") => {
    if (!selectedRequest) return;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updateData: any = {
        status: action === "approve" ? "approved" : "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };

      if (action === "reject" && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase.from("project_requests").update(updateData).eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: action === "approve" ? "Request Approved" : "Request Rejected",
        description:
          action === "approve" ? "The project request has been approved." : "The project request has been rejected.",
      });

      setActionDialog(null);
      setSelectedRequest(null);
      setRejectionReason("");
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (request: ProjectRequest) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("project_requests").update({ status: "cancelled" }).eq("id", request.id);

      if (error) throw error;

      toast({
        title: "Request Cancelled",
        description: "Your project request has been cancelled.",
      });
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatBudget = (min: number | null, max: number | null) => {
    if (!min && !max) return "-";
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `From $${min.toLocaleString()}`;
    if (max) return `Up to $${max.toLocaleString()}`;
    return "-";
  };

  if (requests.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No project requests yet.</div>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => {
              const status = statusConfig[request.status] || statusConfig.pending;
              const priority = priorityConfig[request.priority] || priorityConfig.medium;
              const requesterName = request.requester?.profiles?.name || request.requester?.email || "Unknown";

              return (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{request.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {request.request_number} &middot; {requesterName}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm capitalize">{request.project_type?.replace(/_/g, " ") || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${priority.className}`}
                    >
                      {priority.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatBudget(request.estimated_budget_min, request.estimated_budget_max)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedRequest(request);
                            setActionDialog("view");
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {canReview && (request.status === "pending" || request.status === "under_review") && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedRequest(request);
                                setActionDialog("approve");
                              }}
                            >
                              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedRequest(request);
                                setActionDialog("reject");
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4 text-red-600" />
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                        {!canReview && (request.status === "pending" || request.status === "under_review") && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleCancel(request)} className="text-red-600">
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel Request
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* View Details Dialog */}
      <Dialog open={actionDialog === "view"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Project Request Details</DialogTitle>
            <DialogDescription>{selectedRequest?.request_number}</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Project Name</Label>
                <p className="font-medium">{selectedRequest.name}</p>
              </div>
              {selectedRequest.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{selectedRequest.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Project Type</Label>
                  <p className="capitalize">{selectedRequest.project_type?.replace(/_/g, " ") || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <p className="capitalize">{selectedRequest.priority}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Requested Start</Label>
                  <p>{selectedRequest.requested_start_date || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Target Completion</Label>
                  <p>{selectedRequest.requested_end_date || "-"}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Budget Range</Label>
                <p>{formatBudget(selectedRequest.estimated_budget_min, selectedRequest.estimated_budget_max)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <Badge variant={statusConfig[selectedRequest.status]?.variant || "secondary"} className="mt-1">
                  {statusConfig[selectedRequest.status]?.label || selectedRequest.status}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={actionDialog === "approve"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Project Request</DialogTitle>
            <DialogDescription>Are you sure you want to approve this project request?</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="font-medium">{selectedRequest?.name}</p>
            <p className="text-sm text-muted-foreground">{selectedRequest?.request_number}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={() => handleAction("approve")} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog === "reject"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Project Request</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="font-medium">{selectedRequest?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedRequest?.request_number}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="Explain why this request is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => handleAction("reject")} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <XCircle className="mr-2 h-4 w-4" />
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
