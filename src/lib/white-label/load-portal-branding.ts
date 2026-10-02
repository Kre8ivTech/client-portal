import { cache } from "react";
import { getPortalBranding } from "@/lib/actions/portal-branding";

/** One branding lookup per request, shared by the layout, metadata, and login page. */
export const loadPortalBranding = cache(getPortalBranding);
