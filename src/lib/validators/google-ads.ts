import { z } from "zod";

export const selectGoogleAdsAccountSchema = z.object({
  customerId: z.string().regex(/^\d{10}$/, "Invalid Google Ads customer ID"),
});

export type SelectGoogleAdsAccountInput = z.infer<typeof selectGoogleAdsAccountSchema>;
