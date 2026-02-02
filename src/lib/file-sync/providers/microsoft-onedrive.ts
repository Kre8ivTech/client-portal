export type MicrosoftDriveItem = {
  id: string;
  name: string;
  size?: number;
  file?: { mimeType?: string };
  folder?: unknown;
  lastModifiedDateTime?: string;
  parentReference?: { path?: string };
  "@microsoft.graph.downloadUrl"?: string;
};

export async function refreshMicrosoftAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri: string;
}): Promise<{ accessToken: string; expiresInSeconds: number; refreshToken?: string; scope?: string }> {
  const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
      redirect_uri: params.redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Microsoft token refresh failed: ${text}`);
  }

  const json = (await tokenResponse.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
  };

  return {
    accessToken: json.access_token,
    expiresInSeconds: json.expires_in,
    refreshToken: json.refresh_token,
    scope: json.scope,
  };
}

export async function listOneDriveRootChildren(params: {
  accessToken: string;
  top?: number;
  nextLink?: string;
}): Promise<{ items: MicrosoftDriveItem[]; nextLink?: string }> {
  const url = params.nextLink
    ? new URL(params.nextLink)
    : new URL("https://graph.microsoft.com/v1.0/me/drive/root/children");

  if (!params.nextLink) {
    url.searchParams.set("$top", String(params.top ?? 20));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OneDrive list failed: ${text}`);
  }

  const json = (await res.json()) as {
    value?: MicrosoftDriveItem[];
    "@odata.nextLink"?: string;
  };

  return { items: json.value ?? [], nextLink: json["@odata.nextLink"] };
}

export async function downloadOneDriveItem(params: {
  accessToken: string;
  item: MicrosoftDriveItem;
}): Promise<{ body: Buffer; contentType?: string }> {
  // Prefer the pre-authenticated download URL to reduce round trips.
  if (params.item["@microsoft.graph.downloadUrl"]) {
    const res = await fetch(params.item["@microsoft.graph.downloadUrl"]);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OneDrive download failed: ${text}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? undefined;
    return { body: Buffer.from(arrayBuffer), contentType };
  }

  const url = new URL(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(params.item.id)}/content`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OneDrive download failed: ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? undefined;
  return { body: Buffer.from(arrayBuffer), contentType };
}

