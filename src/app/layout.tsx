import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getPortalBranding } from "@/lib/actions/portal-branding";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KT-Portal | Kre8ivTech Client Portal",
  description: "Multi-tenant SaaS client portal for Kre8ivTech, LLC",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getPortalBranding();
  const primaryVar = branding.primary_color.trim();
  return (
    <html lang="en">
      <body className={inter.className}>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --primary: ${primaryVar}; --ring: ${primaryVar}; --sidebar-accent: ${primaryVar}; }`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
