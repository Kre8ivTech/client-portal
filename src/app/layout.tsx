import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getPortalBranding } from "@/lib/actions/portal-branding";
import { getBaseMetadata } from "@/lib/seo";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  return getBaseMetadata();
}

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
        <Toaster />
      </body>
    </html>
  );
}
