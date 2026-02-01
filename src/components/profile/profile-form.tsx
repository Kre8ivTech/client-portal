"use client";

import { updateProfile } from "@/lib/actions/profile";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ProfileForm({
  defaultName,
  userEmail,
}: {
  defaultName: string;
  userEmail: string;
}) {
  return (
    <form action={updateProfile} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-slate-700">
            Full Name
          </Label>
          <Input
            id="name"
            name="name"
            defaultValue={defaultName}
            className="bg-white border-slate-200"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-700">
            Email Address
          </Label>
          <Input
            id="email"
            defaultValue={userEmail}
            disabled
            className="bg-slate-50 border-slate-200 cursor-not-allowed"
          />
        </div>
      </div>
      <div className="mt-8 flex justify-end">
        <Button type="submit" className="px-8 shadow-md">
          Save Changes
        </Button>
      </div>
    </form>
  );
}
