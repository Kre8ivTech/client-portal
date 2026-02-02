export type DropboxListEntry = {
  ".tag": "file" | "folder" | string;
  name: string;
  id: string;
  path_lower?: string;
  path_display?: string;
  server_modified?: string;
  size?: number;
};

export async function refreshDropboxAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string; expiresInSeconds?: number }> {
  const basic = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString("base64");
  const tokenResponse = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Dropbox token refresh failed: ${text}`);
  }

  const json = (await tokenResponse.json()) as { access_token: string; expires_in?: number };
  return { accessToken: json.access_token, expiresInSeconds: json.expires_in };
}

export async function listDropboxFolder(params: {
  accessToken: string;
  cursor?: string;
  path?: string;
  limit?: number;
}): Promise<{ entries: DropboxListEntry[]; cursor?: string; hasMore: boolean }> {
  const isContinue = !!params.cursor;
  const url = isContinue
    ? "https://api.dropboxapi.com/2/files/list_folder/continue"
    : "https://api.dropboxapi.com/2/files/list_folder";

  const body = isContinue
    ? { cursor: params.cursor }
    : {
        path: params.path ?? "",
        recursive: false,
        include_deleted: false,
        include_media_info: false,
        include_non_downloadable_files: true,
        limit: params.limit ?? 20,
      };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox list failed: ${text}`);
  }

  const json = (await res.json()) as {
    entries?: DropboxListEntry[];
    cursor?: string;
    has_more?: boolean;
  };

  return {
    entries: json.entries ?? [],
    cursor: json.cursor,
    hasMore: !!json.has_more,
  };
}

export async function downloadDropboxFile(params: {
  accessToken: string;
  pathLower: string;
}): Promise<{ body: Buffer; contentType?: string }> {
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Dropbox-API-Arg": JSON.stringify({ path: params.pathLower }),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox download failed: ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? undefined;
  return { body: Buffer.from(arrayBuffer), contentType };
}

