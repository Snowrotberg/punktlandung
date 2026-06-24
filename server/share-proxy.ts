import { createServer, request } from "node:http";
import { connect } from "node:net";

const PORT = Number(process.env.SHARE_PROXY_PORT ?? 3010);
const APP_PORT = Number(process.env.APP_PORT ?? 3000);
const WS_PORT = Number(process.env.WS_PORT ?? 3001);

const server = createServer((clientReq, clientRes) => {
  const upstream = request(
    {
      hostname: "127.0.0.1",
      port: APP_PORT,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: `127.0.0.1:${APP_PORT}`
      }
    },
    (upstreamRes) => {
      clientRes.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(clientRes);
    }
  );

  upstream.on("error", () => {
    clientRes.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    clientRes.end("Punktlandung ist lokal gerade nicht erreichbar.");
  });

  clientReq.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  if (!req.url?.startsWith("/ws")) {
    socket.destroy();
    return;
  }

  const upstream = connect(WS_PORT, "127.0.0.1", () => {
    const rewrittenUrl = req.url?.replace(/^\/ws/, "") || "/";
    const requestLine = `${req.method} ${rewrittenUrl || "/"} HTTP/${req.httpVersion}\r\n`;
    const headers = Object.entries({
      ...req.headers,
      host: `127.0.0.1:${WS_PORT}`
    })
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value ?? ""}`)
      .join("\r\n");
    upstream.write(`${requestLine}${headers}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });

  upstream.on("error", () => socket.destroy());
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Punktlandung share proxy listening on http://127.0.0.1:${PORT}`);
});
