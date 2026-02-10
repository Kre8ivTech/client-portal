"use client";

import { useState } from "react";
import { updateProfile } from "@/lib/actions/profile";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

export function ProfileForm({
  defaultName,
  userEmail,
  defaultPhone,
  defaultWhatsappNumber,
  defaultBusinessAddress,
  defaultMailingAddress,
}: {
  defaultName: string;
  userEmail: string;
  defaultPhone?: string;
  defaultWhatsappNumber?: string;
  defaultBusinessAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  defaultMailingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}) {
  const [sameAsBusiness, setSameAsBusiness] = useState(false);

  return (
    <form action={updateProfile} className="space-y-8">
      {/* Basic Information */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          Basic Information
        </h3>
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
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-slate-700">
              Phone Number
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={defaultPhone || ""}
              placeholder="(555) 123-4567"
              className="bg-white border-slate-200"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp_number" className="text-slate-700">
              WhatsApp Number
            </Label>
            <Input
              id="whatsapp_number"
              name="whatsapp_number"
              type="tel"
              defaultValue={defaultWhatsappNumber || ""}
              placeholder="+1 (555) 123-4567"
              className="bg-white border-slate-200"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Business Address */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          Business Address
        </h3>
        <div className="grid gap-6">
          <div className="space-y-2">
            <Label htmlFor="business_street" className="text-slate-700">
              Street Address
            </Label>
            <Input
              id="business_street"
              name="business_street"
              defaultValue={defaultBusinessAddress?.street || ""}
              placeholder="123 Main Street"
              className="bg-white border-slate-200"
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business_city" className="text-slate-700">
                City
              </Label>
              <Input
                id="business_city"
                name="business_city"
                defaultValue={defaultBusinessAddress?.city || ""}
                placeholder="San Francisco"
                className="bg-white border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_state" className="text-slate-700">
                State / Province
              </Label>
              <Input
                id="business_state"
                name="business_state"
                defaultValue={defaultBusinessAddress?.state || ""}
                placeholder="CA"
                className="bg-white border-slate-200"
              />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business_zip" className="text-slate-700">
                ZIP / Postal Code
              </Label>
              <Input
                id="business_zip"
                name="business_zip"
                defaultValue={defaultBusinessAddress?.zip || ""}
                placeholder="94102"
                className="bg-white border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_country" className="text-slate-700">
                Country
              </Label>
              <Input
                id="business_country"
                name="business_country"
                defaultValue={defaultBusinessAddress?.country || ""}
                placeholder="United States"
                className="bg-white border-slate-200"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Mailing Address */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            Mailing Address
          </h3>
          <div className="flex items-center gap-2">
            <Checkbox
              id="same_as_business"
              checked={sameAsBusiness}
              onCheckedChange={(checked) => setSameAsBusiness(checked === true)}
            />
            <Label
              htmlFor="same_as_business"
              className="text-sm font-normal text-slate-600 cursor-pointer"
            >
              Same as business address
            </Label>
          </div>
        </div>
        <input
          type="hidden"
          name="same_as_business"
          value={sameAsBusiness ? "true" : "false"}
        />
        {!sameAsBusiness && (
          <div className="grid gap-6">
            <div className="space-y-2">
              <Label htmlFor="mailing_street" className="text-slate-700">
                Street Address
              </Label>
              <Input
                id="mailing_street"
                name="mailing_street"
                defaultValue={defaultMailingAddress?.street || ""}
                placeholder="123 Main Street"
                className="bg-white border-slate-200"
              />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mailing_city" className="text-slate-700">
                  City
                </Label>
                <Input
                  id="mailing_city"
                  name="mailing_city"
                  defaultValue={defaultMailingAddress?.city || ""}
                  placeholder="San Francisco"
                  className="bg-white border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mailing_state" className="text-slate-700">
                  State / Province
                </Label>
                <Input
                  id="mailing_state"
                  name="mailing_state"
                  defaultValue={defaultMailingAddress?.state || ""}
                  placeholder="CA"
                  className="bg-white border-slate-200"
                />
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mailing_zip" className="text-slate-700">
                  ZIP / Postal Code
                </Label>
                <Input
                  id="mailing_zip"
                  name="mailing_zip"
                  defaultValue={defaultMailingAddress?.zip || ""}
                  placeholder="94102"
                  className="bg-white border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mailing_country" className="text-slate-700">
                  Country
                </Label>
                <Input
                  id="mailing_country"
                  name="mailing_country"
                  defaultValue={defaultMailingAddress?.country || ""}
                  placeholder="United States"
                  className="bg-white border-slate-200"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <Button type="submit" className="px-8 shadow-md">
          Save Changes
        </Button>
      </div>
    </form>
  );
}
