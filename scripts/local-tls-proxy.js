"use strict";
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");

const backendPort = Number(process.env.BACKEND_PORT || 3000);
const listenPort = Number(process.env.TLS_PORT || 3443);
const cert = fs.readFileSync(process.env.TLS_CERT);
const key = fs.readFileSync(process.env.TLS_KEY);
const forwarded = (headers) => ({ ...headers, "x-forwarded-proto": "https",
  "x-forwarded-host": headers.host });

const proxy = https.createServer({ cert, key }, (request, response) => {
  const upstream = http.request({ host: "127.0.0.1", port: backendPort,
    method: request.method, path: request.url, headers: forwarded(request.headers) },
  (result) => { response.writeHead(result.statusCode, result.headers); result.pipe(response); });
  upstream.on("error", () => { response.writeHead(502); response.end(); });
  request.pipe(upstream);
});
proxy.on("upgrade", (request, socket, head) => {
  const upstream = net.connect(backendPort, "127.0.0.1", () => {
    const headers = forwarded(request.headers);
    upstream.write(`${request.method} ${request.url} HTTP/1.1\r\n` +
      Object.entries(headers).map(([name, value]) => `${name}: ${value}\r\n`).join("") +
      "\r\n");
    if (head.length) upstream.write(head);
    socket.pipe(upstream); upstream.pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
proxy.listen(listenPort, "127.0.0.1", () =>
  console.log(`Local TLS proxy listening on https://127.0.0.1:${listenPort}`));
