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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Info,
} from "lucide-react";

const MASKED_SECRET = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

const s3ConfigSchema = z.object({
  aws_region: z.string().min(1, "AWS Region is required"),
  access_key_id: z.string().min(1, "Access Key ID is required"),
  secret_access_key: z.string().min(1, "Secret Access Key is required"),
  bucket_name: z.string().min(1, "Bucket name is required"),
  kms_key_id: z.string().optional(),
});

type S3ConfigFormData = z.infer<typeof s3ConfigSchema>;

interface S3ConfigFormProps {
  existingConfig: {
    id: string;
    aws_region: string;
    access_key_id_masked: string;
    bucket_name: string;
    kms_key_id: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  envConfigured: boolean;
}

export function S3ConfigForm({
  existingConfig,
  envConfigured,
}: S3ConfigFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const router = useRouter();

  const hasExistingConfig = !!existingConfig;

  const form = useForm<S3ConfigFormData>({
    resolver: zodResolver(s3ConfigSchema),
    defaultValues: {
      aws_region: existingConfig?.aws_region || "us-east-1",
      access_key_id: existingConfig?.access_key_id_masked?.replace(/\*/g, "") || "",
      secret_access_key: hasExistingConfig ? MASKED_SECRET : "",
      bucket_name: existingConfig?.bucket_name || "",
      kms_key_id: existingConfig?.kms_key_id || "",
    },
  });

  const onSubmit = async (data: S3ConfigFormData) => {
    setIsSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        aws_region: data.aws_region,
        access_key_id: data.access_key_id,
        bucket_name: data.bucket_name,
        kms_key_id: data.kms_key_id || null,
      };

      // Only include secret if it was changed from the masked value
      if (data.secret_access_key !== MASKED_SECRET) {
        payload.secret_access_key = data.secret_access_key;
      }

      const response = await fetch("/api/admin/s3/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save configuration");
      }

      router.push(
        "/dashboard/admin/settings/integrations?success=s3_config_saved"
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
      const response = await fetch("/api/admin/s3/config", {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete configuration");
      }

      router.push(
        "/dashboard/admin/settings/integrations?success=s3_config_deleted"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Badge
          variant="outline"
          className={
            hasExistingConfig
              ? "bg-green-500/10 text-green-600 border-green-500/30"
              : "bg-muted text-muted-foreground"
          }
        >
          {hasExistingConfig ? (
            <>
              <CheckCircle2 className="w-3 h-3 mr-1" />
              DB Config Active
            </>
          ) : (
            "No DB Config"
          )}
        </Badge>
        <Badge
          variant="outline"
          className={
            envConfigured
              ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
              : "bg-muted text-muted-foreground"
          }
        >
          {envConfigured ? (
            <>
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Env Vars Set
            </>
          ) : (
            "No Env Vars"
          )}
        </Badge>
      </div>

      {envConfigured && !hasExistingConfig && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            S3 is currently configured via environment variables. You can
            optionally save credentials here to manage them from the portal
            instead.
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="aws_region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AWS Region *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="us-east-1"
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormDescription>
                    e.g. us-east-1, eu-west-1
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bucket_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>S3 Bucket Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="my-portal-files"
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormDescription>
                    The bucket where client files are stored
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="access_key_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Access Key ID *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="AKIA..."
                    disabled={isSaving}
                  />
                </FormControl>
                <FormDescription>
                  IAM access key with S3 permissions
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="secret_access_key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Secret Access Key *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type={showSecret ? "text" : "password"}
                      placeholder={
                        hasExistingConfig
                          ? "Leave unchanged or enter new key"
                          : "Your AWS Secret Access Key"
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
                    ? "The existing secret is hidden. Leave unchanged to keep it, or enter a new one."
                    : "This will be stored securely in the database."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="kms_key_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>KMS Key ID (optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="arn:aws:kms:us-east-1:123456789:key/..."
                    disabled={isSaving}
                  />
                </FormControl>
                <FormDescription>
                  Set to enable SSE-KMS encryption. Leave blank for default
                  SSE-S3 (AES-256) encryption.
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
                      Delete S3 Configuration?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the stored AWS S3 credentials.
                      {envConfigured
                        ? " The system will fall back to environment variables."
                        : " File uploads will stop working until new credentials are configured."}
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
