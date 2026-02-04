"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

const qbAppConfigSchema = z.object({
  client_id: z.string().min(1, "Client ID is required"),
  client_secret: z.string().min(1, "Client Secret is required"),
  environment: z.enum(["sandbox", "production"]),
});

type QBAppConfigFormData = z.infer<typeof qbAppConfigSchema>;

interface QuickBooksAppConfigFormProps {
  existingConfig: any | null;
}

export function QuickBooksAppConfigForm({
  existingConfig,
}: QuickBooksAppConfigFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const router = useRouter();

  const form = useForm<QBAppConfigFormData>({
    resolver: zodResolver(qbAppConfigSchema),
    defaultValues: {
      client_id: existingConfig?.client_id || "",
      client_secret: existingConfig ? "••••••••••••••••" : "",
      environment: existingConfig?.environment || "sandbox",
    },
  });

  const onSubmit = async (data: QBAppConfigFormData) => {
    setIsSaving(true);
    setError(null);

    try {
      // Don't send the masked secret if it hasn't been changed
      const payload: any = {
        client_id: data.client_id,
        environment: data.environment,
      };

      // Only include client_secret if it's not the masked value
      if (data.client_secret !== "••••••••••••••••") {
        payload.client_secret = data.client_secret;
      }

      const response = await fetch("/api/admin/quickbooks/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save configuration");
      }

      // Redirect with success message
      router.push(
        "/dashboard/admin/settings/integrations?success=config_saved"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/quickbooks/config", {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete configuration");
      }

      // Redirect with success message
      router.push(
        "/dashboard/admin/settings/integrations?success=config_deleted"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  const hasExistingConfig = !!existingConfig;

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client ID *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Your QuickBooks OAuth Client ID"
                    disabled={isSaving}
                  />
                </FormControl>
                <FormDescription>
                  Found in the QuickBooks Developer Portal under "Keys &
                  credentials"
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="client_secret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Secret *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type={showSecret ? "text" : "password"}
                      placeholder={
                        hasExistingConfig
                          ? "Leave unchanged or enter new secret"
                          : "Your QuickBooks OAuth Client Secret"
                      }
                      disabled={isSaving}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormDescription>
                  {hasExistingConfig
                    ? "The existing secret is hidden. Leave this field unchanged to keep the current secret, or enter a new one to update it."
                    : "Found in the QuickBooks Developer Portal. This will be stored securely."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="environment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Environment *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isSaving}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="sandbox">
                      Sandbox (for testing)
                    </SelectItem>
                    <SelectItem value="production">
                      Production (live data)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Use Sandbox for development and testing. Switch to Production
                  when ready to go live.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : hasExistingConfig ? (
                "Update Configuration"
              ) : (
                "Save Configuration"
              )}
            </Button>

            {hasExistingConfig && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete Configuration"
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete QuickBooks Configuration?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the QuickBooks app credentials. All
                      organizations will lose the ability to connect to
                      QuickBooks until new credentials are configured.
                      <br />
                      <br />
                      Existing QuickBooks connections will be disconnected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
