"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  Zap,
  ExternalLink,
  AlertCircle,
  TestTube,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const eventTypes = [
  { value: "ticket.created", label: "Ticket Created" },
  { value: "ticket.updated", label: "Ticket Updated" },
  { value: "ticket.closed", label: "Ticket Closed" },
  { value: "invoice.created", label: "Invoice Created" },
  { value: "invoice.paid", label: "Invoice Paid" },
  { value: "invoice.overdue", label: "Invoice Overdue" },
  { value: "contract.created", label: "Contract Created" },
  { value: "contract.signed", label: "Contract Signed" },
  { value: "contract.completed", label: "Contract Completed" },
  { value: "message.received", label: "Message Received" },
  { value: "form.submitted", label: "Form Submitted" },
];

export function ZapierIntegration() {
  const queryClient = useQueryClient();
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [showNewWebhookDialog, setShowNewWebhookDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvent, setWebhookEvent] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  // Fetch API keys
  const { data: keysData } = useQuery({
    queryKey: ["zapier-keys"],
    queryFn: async () => {
      const response = await fetch("/api/zapier/keys");
      if (!response.ok) throw new Error("Failed to fetch API keys");
      return response.json();
    },
  });

  // Fetch webhooks
  const { data: webhooksData } = useQuery({
    queryKey: ["zapier-webhooks"],
    queryFn: async () => {
      const response = await fetch("/api/zapier/webhooks");
      if (!response.ok) throw new Error("Failed to fetch webhooks");
      return response.json();
    },
  });

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch("/api/zapier/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Failed to create API key");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["zapier-keys"] });
      setNewApiKey(data.api_key);
      setNewKeyName("");
    },
  });

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/zapier/keys/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete API key");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zapier-keys"] });
    },
  });

  // Create webhook mutation
  const createWebhookMutation = useMutation({
    mutationFn: async (data: { url: string; event_type: string }) => {
      const response = await fetch("/api/zapier/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create webhook");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zapier-webhooks"] });
      setShowNewWebhookDialog(false);
      setWebhookUrl("");
      setWebhookEvent("");
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/zapier/webhooks/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete webhook");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zapier-webhooks"] });
    },
  });

  // Test webhook mutation
  const testWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/zapier/webhooks/${id}/test`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to test webhook");
      return response.json();
    },
  });

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCreateKey = () => {
    if (newKeyName.trim()) {
      createKeyMutation.mutate(newKeyName.trim());
    }
  };

  const handleCreateWebhook = () => {
    if (webhookUrl && webhookEvent) {
      createWebhookMutation.mutate({
        url: webhookUrl,
        event_type: webhookEvent,
      });
    }
  };

  const keys = keysData?.data || [];
  const webhooks = webhooksData?.data || [];

  return (
    <div className="space-y-6">
      {/* API Keys Section */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Key className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">API Keys</CardTitle>
                <CardDescription>
                  Authenticate Zapier with your KT-Portal account
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => setShowNewKeyDialog(true)}
              size="sm"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New API Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No API keys yet. Create one to get started with Zapier.
            </p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key: any) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {key.key_prefix}...
                        </code>
                      </TableCell>
                      <TableCell>
                        {key.is_active ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {key.last_used_at
                          ? new Date(key.last_used_at).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteKeyMutation.mutate(key.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Alert className="mt-4">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Use these API keys to authenticate Zapier with your account. Keep them secure and never share them publicly.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Webhooks Section */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Zap className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Webhooks</CardTitle>
                <CardDescription>
                  Receive real-time notifications when events occur
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => setShowNewWebhookDialog(true)}
              size="sm"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No webhooks configured. Add one to receive real-time events.
            </p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook: any) => (
                    <TableRow key={webhook.id}>
                      <TableCell>
                        <Badge variant="secondary">
                          {eventTypes.find((e) => e.value === webhook.event_type)?.label || webhook.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {webhook.url}
                      </TableCell>
                      <TableCell>
                        {webhook.is_active ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                            <XCircle className="w-3 h-3 mr-1" />
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {webhook.last_triggered_at
                          ? new Date(webhook.last_triggered_at).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => testWebhookMutation.mutate(webhook.id)}
                          >
                            <TestTube className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Alert className="mt-4">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Webhooks are automatically disabled after 10 consecutive failures. Check your webhook URL and re-enable if needed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Documentation Link */}
      <Card className="border-border shadow-sm bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <ExternalLink className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Getting Started with Zapier</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Connect KT-Portal to thousands of apps with Zapier. Create workflows that automatically trigger actions when events occur in your portal.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://zapier.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  Visit Zapier
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key to authenticate Zapier with your account.
            </DialogDescription>
          </DialogHeader>

          {newApiKey ? (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>
                  API key created successfully! Copy it now - you won't be able to see it again.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex gap-2">
                  <Input
                    value={newApiKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={() => handleCopyKey(newApiKey)}
                    variant="outline"
                    size="sm"
                  >
                    {copiedKey ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  placeholder="My Zapier Key"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {newApiKey ? (
              <Button
                onClick={() => {
                  setShowNewKeyDialog(false);
                  setNewApiKey(null);
                }}
              >
                Done
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowNewKeyDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim() || createKeyMutation.isPending}
                >
                  Create Key
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Webhook Dialog */}
      <Dialog open={showNewWebhookDialog} onOpenChange={setShowNewWebhookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Webhook</DialogTitle>
            <DialogDescription>
              Configure a webhook to receive real-time notifications when events occur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-event">Event Type</Label>
              <Select value={webhookEvent} onValueChange={setWebhookEvent}>
                <SelectTrigger id="webhook-event">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((event) => (
                    <SelectItem key={event.value} value={event.value}>
                      {event.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewWebhookDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWebhook}
              disabled={!webhookUrl || !webhookEvent || createWebhookMutation.isPending}
            >
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
