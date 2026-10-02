// @vitest-environment node
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function request(port: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/health",
        headers: { host: "portal.embark-marketing.com" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString() });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("alias port proxy", () => {
  const children: Array<ReturnType<typeof spawn>> = [];
  const servers: http.Server[] = [];

  afterEach(async () => {
    for (const child of children) child.kill("SIGTERM");
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          }),
      ),
    );
  });

  it("forwards the original host header to the app port", async () => {
    let seenHost = "";
    const app = http.createServer((req, res) => {
      seenHost = req.headers.host ?? "";
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    });
    servers.push(app);
    const appPort = await new Promise<number>((resolve, reject) => {
      app.once("error", reject);
      app.listen(0, "127.0.0.1", () => {
        const address = app.address();
        resolve(address && typeof address === "object" ? address.port : 0);
      });
    });
    const proxyPort = await freePort();

    const child = spawn(process.execPath, [path.join(process.cwd(), "scripts/alias-port-proxy.mjs")], {
      env: { ...process.env, PORT: String(appPort), ALIAS_PROXY_PORT: String(proxyPort) },
      stdio: "ignore",
    });
    children.push(child);

    let response = { status: 0, body: "" };
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        response = await request(proxyPort);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    expect(response.status).toBe(200);
    expect(response.body).toBe("ok");
    expect(seenHost).toBe("portal.embark-marketing.com");
  });
});
