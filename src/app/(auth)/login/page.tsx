import { LoginForm } from "@/components/auth/login-form";
import { loadPortalBranding } from "@/lib/white-label/load-portal-branding";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const branding = await loadPortalBranding();
  return <LoginForm initialBranding={branding} />;
}
