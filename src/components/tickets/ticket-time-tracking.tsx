"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, Loader2, Trash2, Edit2, Timer, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface TimeEntry {
  id: string;
  description: string;
  hours: number;
  entry_date: string;
  billable: boolean;
  work_type?: string;
  profile_id: string;
  created_at: string;
  user?: {
    name: string | null;
  };
}

interface TicketTimeTrackingProps {
  ticketId: string;
  organizationId: string;
  userId: string;
  isStaff: boolean;
}

export function TicketTimeTracking({ ticketId, organizationId, userId, isStaff }: TicketTimeTrackingProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  // Form state
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [billable, setBillable] = useState(true);
  const [workType, setWorkType] = useState<string>("support");

  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    fetchTimeEntries();
  }, [ticketId]);

  const fetchTimeEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("time_entries")
        .select(
          `
          *,
          user:user_profiles!time_entries_profile_id_fkey(name)
        `,
        )
        .eq("ticket_id", ticketId)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error("Failed to fetch time entries:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setHours("");
    setMinutes("");
    setDescription("");
    setEntryDate(format(new Date(), "yyyy-MM-dd"));
    setBillable(true);
    setWorkType("support");
    setEditingEntry(null);
  };

  const openEditDialog = (entry: TimeEntry) => {
    const h = Math.floor(entry.hours);
    const m = Math.round((entry.hours - h) * 60);
    setHours(h.toString());
    setMinutes(m.toString());
    setDescription(entry.description);
    setEntryDate(entry.entry_date);
    setBillable(entry.billable);
    setWorkType(entry.work_type || "support");
    setEditingEntry(entry);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const h = parseFloat(hours) || 0;
    const m = parseFloat(minutes) || 0;
    const totalHours = h + m / 60;

    if (totalHours <= 0) {
      toast({ title: "Error", description: "Please enter valid time", variant: "destructive" });
      return;
    }

    if (!description.trim()) {
      toast({ title: "Error", description: "Please enter a description", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      if (editingEntry) {
        // Update existing entry
        const { error } = await supabase
          .from("time_entries")
          .update({
            hours: totalHours,
            description: description.trim(),
            entry_date: entryDate,
            billable,
            work_type: workType,
          })
          .eq("id", editingEntry.id);

        if (error) throw error;
        toast({ title: "Success", description: "Time entry updated" });
      } else {
        // Create new entry
        const { error } = await supabase.from("time_entries").insert({
          ticket_id: ticketId,
          organization_id: organizationId,
          profile_id: userId,
          hours: totalHours,
          description: description.trim(),
          entry_date: entryDate,
          billable,
          work_type: workType,
        });

        if (error) throw error;
        toast({ title: "Success", description: "Time entry added" });
      }

      resetForm();
      setIsDialogOpen(false);
      fetchTimeEntries();
    } catch (err: any) {
      console.error("Failed to save time entry:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to save time entry",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this time entry?")) return;

    try {
      const { error } = await supabase.from("time_entries").delete().eq("id", entryId);

      if (error) throw error;
      toast({ title: "Success", description: "Time entry deleted" });
      fetchTimeEntries();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete time entry",
        variant: "destructive",
      });
    }
  };

  // Calculate totals
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const billableHours = entries.reduce((sum, e) => (e.billable ? sum + e.hours : sum), 0);

  const formatHours = (h: number) => {
    const hours = Math.floor(h);
    const minutes = Math.round((h - hours) * 60);
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Time Tracking
          </CardTitle>
          {isStaff && (
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Log Time
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingEntry ? "Edit Time Entry" : "Log Time"}</DialogTitle>
                  <DialogDescription>Record time spent working on this ticket.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hours</Label>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        placeholder="0"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Minutes</Label>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="0"
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Work Type</Label>
                    <Select value={workType} onValueChange={setWorkType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="dev">Development</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="What did you work on?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="billable"
                      checked={billable}
                      onChange={(e) => setBillable(e.target.checked)}
                      className="rounded border-gray-300"
                      aria-label="Mark as billable time"
                    />
                    <Label htmlFor="billable" className="cursor-pointer">
                      Billable time
                    </Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingEntry ? "Update" : "Log Time"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
              <Clock className="h-4 w-4" />
              Total Time
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatHours(totalHours)}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
              <DollarSign className="h-4 w-4" />
              Billable
            </div>
            <div className="text-2xl font-bold text-green-700">{formatHours(billableHours)}</div>
          </div>
        </div>

        {/* Entries list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No time logged yet</p>
            {isStaff && <p className="text-xs mt-1">Click "Log Time" to track your work</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border group">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{formatHours(entry.hours)}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {entry.work_type || "support"}
                    </Badge>
                    {entry.billable ? (
                      <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">
                        Billable
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-slate-400">
                        Non-billable
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{entry.description}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{entry.user?.name || "Unknown"}</span>
                    <span>•</span>
                    <span>{format(parseISO(entry.entry_date), "MMM d, yyyy")}</span>
                  </div>
                </div>
                {isStaff && entry.profile_id === userId && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(entry)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
