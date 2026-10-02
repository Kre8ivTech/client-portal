import http from "node:http";

const listenPort = Number(process.env.ALIAS_PROXY_PORT || 3001);
const targetPort = Number(process.env.PORT || 3000);

if (!Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535) {
  process.stderr.write("alias-port-proxy: invalid ALIAS_PROXY_PORT\n");
  process.exit(1);
}

if (!Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65535 || targetPort === listenPort) {
  process.stderr.write("alias-port-proxy: invalid PORT\n");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain" });
    }
    res.end("Bad Gateway");
  });

  req.pipe(proxyReq);
});

server.on("error", (error) => {
  process.stderr.write(`alias-port-proxy: ${error.message}\n`);
  process.exit(1);
});

server.listen(listenPort, "0.0.0.0");
