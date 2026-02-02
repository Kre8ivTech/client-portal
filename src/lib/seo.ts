import type { Metadata } from "next";
import { getPortalBranding, type PortalBrandingResult } from "./actions/portal-branding";

/**
 * Default SEO configuration values
 */
export const DEFAULT_SEO = {
  siteName: "KT-Portal",
  description: "Multi-tenant SaaS client portal for Kre8ivTech, LLC",
  locale: "en_US",
  type: "website" as const,
};

/**
 * SEO metadata options for building page metadata
 */
export interface SeoOptions {
  title?: string;
  description?: string;
  keywords?: string[];
  noIndex?: boolean;
  canonical?: string;
  openGraph?: {
    title?: string;
    description?: string;
    images?: Array<{ url: string; width?: number; height?: number; alt?: string }>;
    type?: "website" | "article";
    publishedTime?: string;
    modifiedTime?: string;
    authors?: string[];
  };
  twitter?: {
    card?: "summary" | "summary_large_image";
    title?: string;
    description?: string;
  };
}

/**
 * Builds a page title with the site name
 */
export function buildTitle(pageTitle: string, siteName?: string): string {
  const site = siteName || DEFAULT_SEO.siteName;
  if (!pageTitle) return site;
  return `${pageTitle} | ${site}`;
}

/**
 * Truncates text to a maximum length for meta descriptions
 */
export function truncateDescription(text: string, maxLength = 160): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + "...";
}

/**
 * Strips HTML tags from a string for use in meta descriptions
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Generates base metadata from portal branding
 */
export async function getBaseMetadata(): Promise<Metadata> {
  const branding = await getPortalBranding();

  const title = branding.app_name || DEFAULT_SEO.siteName;
  const description = branding.tagline || DEFAULT_SEO.description;

  const metadata: Metadata = {
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    applicationName: title,
    openGraph: {
      type: DEFAULT_SEO.type,
      locale: DEFAULT_SEO.locale,
      siteName: title,
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };

  // Add favicon if configured
  if (branding.favicon_url) {
    metadata.icons = {
      icon: branding.favicon_url,
      shortcut: branding.favicon_url,
      apple: branding.favicon_url,
    };
  }

  // Add logo to Open Graph if configured
  if (branding.logo_url) {
    metadata.openGraph = {
      ...metadata.openGraph,
      images: [
        {
          url: branding.logo_url,
          alt: title,
        },
      ],
    };
  }

  return metadata;
}

/**
 * Generates page-specific metadata by merging with base metadata
 */
export async function generatePageMetadata(options: SeoOptions): Promise<Metadata> {
  const branding = await getPortalBranding();
  const siteName = branding.app_name || DEFAULT_SEO.siteName;
  const siteDescription = branding.tagline || DEFAULT_SEO.description;

  const pageTitle = options.title || siteName;
  const pageDescription = options.description
    ? truncateDescription(options.description)
    : siteDescription;

  const metadata: Metadata = {
    title: options.title || siteName,
    description: pageDescription,
    openGraph: {
      type: options.openGraph?.type || DEFAULT_SEO.type,
      locale: DEFAULT_SEO.locale,
      siteName,
      title: options.openGraph?.title || pageTitle,
      description: options.openGraph?.description || pageDescription,
    },
    twitter: {
      card: options.twitter?.card || "summary",
      title: options.twitter?.title || pageTitle,
      description: options.twitter?.description || pageDescription,
    },
  };

  // Handle keywords
  if (options.keywords && options.keywords.length > 0) {
    metadata.keywords = options.keywords;
  }

  // Handle noIndex
  if (options.noIndex) {
    metadata.robots = {
      index: false,
      follow: false,
    };
  }

  // Handle canonical URL
  if (options.canonical) {
    metadata.alternates = {
      canonical: options.canonical,
    };
  }

  // Handle Open Graph images
  if (options.openGraph?.images) {
    metadata.openGraph = {
      ...metadata.openGraph,
      images: options.openGraph.images,
    };
  } else if (branding.logo_url) {
    metadata.openGraph = {
      ...metadata.openGraph,
      images: [{ url: branding.logo_url, alt: siteName }],
    };
  }

  // Handle article-specific Open Graph properties
  if (options.openGraph?.type === "article") {
    metadata.openGraph = {
      ...metadata.openGraph,
      type: "article",
    };
    if (options.openGraph.publishedTime) {
      (metadata.openGraph as Record<string, unknown>).publishedTime =
        options.openGraph.publishedTime;
    }
    if (options.openGraph.modifiedTime) {
      (metadata.openGraph as Record<string, unknown>).modifiedTime =
        options.openGraph.modifiedTime;
    }
    if (options.openGraph.authors) {
      (metadata.openGraph as Record<string, unknown>).authors =
        options.openGraph.authors;
    }
  }

  return metadata;
}

/**
 * Gets the portal branding for use in components (re-export for convenience)
 */
export { getPortalBranding };
export type { PortalBrandingResult };
