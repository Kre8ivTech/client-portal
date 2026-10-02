"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getAuthSettings, verifyRecaptcha } from "@/lib/actions/auth-settings";
import { getPortalBranding } from "@/lib/actions/portal-branding";
import { buildMagicLinkEmail } from "@/lib/auth/magic-link-email";
import { magicLinkCallbackUrl } from "@/lib/auth/magic-link-origin";
import { createSlidingWindowLimiter } from "@/lib/auth/magic-link-rate-limit";
import { sendRawEmail } from "@/lib/notifications/providers/email";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const emailSchema = z.string().trim().email().max(320);
const emailLimiter = createSlidingWindowLimiter(5, 60 * 60 * 1000);
const ipLimiter = createSlidingWindowLimiter(20, 60 * 60 * 1000);

const DELIVERY_ERROR = "We could not send the sign-in email. Please try again in a few minutes.";
const RATE_LIMIT_ERROR = "Too many sign-in emails sent. Please wait a few minutes and try again.";

type MagicLinkResult = { ok: true } | { ok: false; error: string };

type LinkProperties = {
  action_link?: string;
  hashed_token?: string;
  verification_type?: string;
};

function isUnknownAuthUser(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "user_not_found" ||
    message.includes("user not found") ||
    message.includes("user with this email not found")
  );
}

function logSafe(label: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/https?:\/\//i.test(message)) {
    console.error(label);
    return;
  }
  console.error(label, message.slice(0, 240));
}

function verifyUrl(properties: LinkProperties, callbackUrl: string, supabaseUrl: string): string | null {
  const token = properties.hashed_token?.trim();
  const type = properties.verification_type?.trim() || "magiclink";
  if (token && supabaseUrl) {
    const url = new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`);
    url.searchParams.set("token", token);
    url.searchParams.set("type", type);
    url.searchParams.set("redirect_to", callbackUrl);
    return url.toString();
  }
  return properties.action_link ?? null;
}

async function verifiedPartnerId(host: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("custom_domain", host)
    .eq("custom_domain_verified", true)
    .eq("type", "partner")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    logSafe("[magic-link] partner lookup failed", error);
    return null;
  }

  const id = (data as { id?: string } | null)?.id;
  return id ?? null;
}

async function generateMagicLink(
  email: string,
  callbackUrl: string,
): Promise<{ link: string | null; error?: string }> {
  const admin = getSupabaseAdmin();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const issue = async () => {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: callbackUrl },
    });
    return { data, error };
  };

  let { data, error } = await issue();
  if (error && isUnknownAuthUser(error)) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    const createMessage = created.error?.message ?? "";
    if (created.error && !/already/i.test(createMessage)) {
      logSafe("[magic-link] create user failed", created.error);
      if (/signup/i.test(createMessage) && /(disabled|not allowed)/i.test(createMessage)) {
        return { link: null, error: "New sign-ups are currently disabled." };
      }
      return { link: null };
    }
    ({ data, error } = await issue());
  }

  if (error || !data?.properties) {
    logSafe("[magic-link] generate link failed", error ?? "missing link");
    return { link: null };
  }

  return { link: verifyUrl(data.properties as LinkProperties, callbackUrl, supabaseUrl) };
}

export async function requestMagicLink(input: {
  email: string;
  recaptchaToken?: string | null;
  recaptchaAction?: string;
}): Promise<MagicLinkResult> {
  const parsed = emailSchema.safeParse(input.email);
  if (!parsed.success) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const email = parsed.data.toLowerCase();

  try {
    const recaptchaAction =
      input.recaptchaAction === "signup_magic_link" ? "signup_magic_link" : "login_magic_link";
    const token = input.recaptchaToken?.trim() ?? "";
    if (token) {
      const recaptcha = await verifyRecaptcha(token, recaptchaAction);
      if (!recaptcha.success) {
        return { ok: false, error: recaptcha.error || "reCAPTCHA verification failed" };
      }
    } else {
      const settings = await getAuthSettings();
      if (settings.recaptcha_enabled) {
        return { ok: false, error: "Could not complete reCAPTCHA verification" };
      }
    }

    const hdrs = await headers();
    const requestHost = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip && !ipLimiter.attempt(`ip:${ip}`)) {
      return { ok: false, error: RATE_LIMIT_ERROR };
    }
    if (!emailLimiter.attempt(`email:${email}`)) {
      return { ok: false, error: RATE_LIMIT_ERROR };
    }

    const hostname = requestHost?.split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
    const partnerId = hostname ? await verifiedPartnerId(hostname) : null;
    const callbackUrl = magicLinkCallbackUrl({
      requestHost,
      configuredAppUrl: process.env.NEXT_PUBLIC_APP_URL,
      verifiedCustomDomain: Boolean(partnerId),
    });

    const branding = await getPortalBranding();
    const generated = await generateMagicLink(email, callbackUrl);
    if (generated.error) {
      return { ok: false, error: generated.error };
    }
    const magicLink = generated.link;
    if (!magicLink) {
      return { ok: false, error: DELIVERY_ERROR };
    }

    const message = buildMagicLinkEmail({ branding, magicLink });
    if (!message) {
      return { ok: false, error: DELIVERY_ERROR };
    }

    const sent = await sendRawEmail({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      organizationId: partnerId,
      fromName: message.fromName,
    });

    if (!sent.success) {
      logSafe("[magic-link] delivery failed", sent.error ?? "send failed");
      return { ok: false, error: DELIVERY_ERROR };
    }

    return { ok: true };
  } catch (error) {
    logSafe("[magic-link] request failed", error);
    return { ok: false, error: DELIVERY_ERROR };
  }
}
