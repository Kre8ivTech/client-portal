export function normalizeS3Prefix(prefix: string | null | undefined): string | null {
  if (!prefix) return null;
  const trimmed = prefix.trim();
  if (!trimmed) return null;
  // Remove leading/trailing slashes to avoid accidental absolute paths.
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function buildOrgFileS3Prefix(params: {
  organizationId: string;
  provider: string;
  userId: string;
  overridePrefix?: string | null;
}): string {
  const base = normalizeS3Prefix(params.overridePrefix) || `org/${params.organizationId}`;
  return `${base}/external/${params.provider}/users/${params.userId}`;
}

