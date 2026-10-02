#!/usr/bin/env node
/**
 * KT-Portal partner MCP server (stdio).
 * Calls the partner HTTP API. The key stays in the process environment.
 */

const baseUrl = (process.env.KT_PORTAL_BASE_URL || "").replace(/\/+$/, "");
const apiKey = process.env.KT_PORTAL_PARTNER_API_KEY || "";

if (!baseUrl || !apiKey) {
  process.stderr.write(
    "KT_PORTAL_BASE_URL and KT_PORTAL_PARTNER_API_KEY are required. The key is not printed.\n",
  );
  process.exit(1);
}

const tools = [
  {
    name: "whoami",
    description: "Identify the partner organization for the configured API key.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_clients",
    description: "List child client organizations for this partner key.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_sites",
    description: "List site monitors for this partner's child client organizations.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "add_site",
    description: "Register or update a site monitor for a child client organization.",
    inputSchema: {
      type: "object",
      properties: {
        organization_id: { type: "string", description: "Child client organization id" },
        name: { type: "string" },
        url: { type: "string" },
        platform: { type: "string" },
        wp_version: { type: "string" },
      },
      required: ["organization_id", "name", "url"],
      additionalProperties: false,
    },
  },
];

async function callApi(path, method, body) {
  const response = await fetch(`${baseUrl}/api/partner/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: "Partner API returned an unreadable response", status: response.status };
  }
  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : "Partner API request failed";
    throw new Error(`${response.status} ${message}`);
  }
  return payload;
}

async function runTool(name, args) {
  if (name === "whoami") return callApi("/whoami", "GET");
  if (name === "list_clients") return callApi("/clients", "GET");
  if (name === "list_sites") return callApi("/sites", "GET");
  if (name === "add_site") return callApi("/sites", "POST", args);
  throw new Error("Unknown tool");
}

function send(message) {
  const json = JSON.stringify(message);
  const payload = Buffer.from(json, "utf8");
  process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
  process.stdout.write(payload);
}

function resultFor(id, value, isError = false) {
  send({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
      isError,
    },
  });
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0") return;
  if (message.id === undefined || message.id === null) return;

  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "kt-portal-partner", version: "1.0.0" },
      },
    });
    return;
  }

  if (message.method === "tools/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { tools } });
    return;
  }

  if (message.method === "ping") {
    send({ jsonrpc: "2.0", id: message.id, result: {} });
    return;
  }

  if (message.method === "tools/call") {
    const name = message.params?.name;
    const args = message.params?.arguments ?? {};
    try {
      const value = await runTool(name, args);
      resultFor(message.id, value);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Tool failed";
      resultFor(message.id, { error: text }, true);
    }
    return;
  }

  send({
    jsonrpc: "2.0",
    id: message.id,
    error: { code: -32601, message: "Method not found" },
  });
}

let buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = buffer.subarray(0, headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
      buffer = buffer.subarray(headerEnd + 4);
      continue;
    }
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + length) return;
    const body = buffer.subarray(start, start + length).toString("utf8");
    buffer = buffer.subarray(start + length);
    try {
      void handle(JSON.parse(body));
    } catch (error) {
      const text = error instanceof Error ? error.message : "Invalid message";
      process.stderr.write(`${text}\n`);
    }
  }
});
