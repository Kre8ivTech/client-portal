"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrganization } from "@/lib/actions/organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    
    startTransition(async () => {
      const result = await createOrganization(formData);
      
      if (result.success) {
        router.push("/dashboard/clients");
        router.refresh();
      } else {
        setError(result.error || "Failed to create organization");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link 
          href="/dashboard/clients" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Organization</CardTitle>
          <CardDescription>
            Create a new client organization to manage.
          </CardDescription>
        </CardHeader>
        <form action={onSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input 
                id="name" 
                name="name" 
                placeholder="Acme Corp" 
                required 
                onChange={(e) => {
                  // Simple auto-slug
                  const slugInput = document.getElementById("slug") as HTMLInputElement;
                  if (slugInput && !slugInput.value) {
                    slugInput.value = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "");
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL Identifier)</Label>
              <Input 
                id="slug" 
                name="slug" 
                placeholder="acme-corp" 
                required 
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier used in URLs. Only lowercase letters, numbers, and hyphens.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input 
                id="contact_email" 
                name="contact_email" 
                type="email" 
                placeholder="admin@acmecorp.com" 
              />
            </div>

            {/* Hidden field for default type */}
            <input type="hidden" name="type" value="client" />
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              type="button" 
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Organization
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
