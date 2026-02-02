export type GoogleDriveListFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
};

export async function refreshGoogleAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string; expiresInSeconds: number; refreshToken?: string }> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    let details: unknown = null;
    try {
      details = await tokenResponse.json();
    } catch {
      // ignore
    }
    throw new Error(`Google token refresh failed: ${JSON.stringify(details)}`);
  }

  const json = (await tokenResponse.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  return {
    accessToken: json.access_token,
    expiresInSeconds: json.expires_in,
    refreshToken: json.refresh_token,
  };
}

export async function listGoogleDriveFiles(params: {
  accessToken: string;
  pageToken?: string;
  pageSize?: number;
}): Promise<{ files: GoogleDriveListFile[]; nextPageToken?: string }> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", "'root' in parents and trashed=false");
  url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,size),nextPageToken");
  url.searchParams.set("pageSize", String(params.pageSize ?? 20));
  if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive list failed: ${text}`);
  }

  const json = (await res.json()) as {
    files?: GoogleDriveListFile[];
    nextPageToken?: string;
  };

  return { files: json.files ?? [], nextPageToken: json.nextPageToken };
}

export async function downloadGoogleDriveFile(params: {
  accessToken: string;
  fileId: string;
}): Promise<{ body: Buffer; contentType?: string }> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.fileId)}`);
  url.searchParams.set("alt", "media");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive download failed: ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? undefined;
  return { body: Buffer.from(arrayBuffer), contentType };
}

