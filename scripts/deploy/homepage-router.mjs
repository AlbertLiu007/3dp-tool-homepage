#!/usr/bin/env node

import http from 'node:http';
import net from 'node:net';
import { readFileSync } from 'node:fs';

const listenHost = process.env.ROUTER_HOST || '127.0.0.1';
const listenPort = Number(process.env.ROUTER_PORT || 3002);
const targetFile = process.env.ROUTER_TARGET_FILE || '/srv/unionam/deploy/homepage-active-port';
const allowedPorts = new Set(
  (process.env.ROUTER_ALLOWED_PORTS || '3012,3013')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter(Number.isInteger),
);

function activePort() {
  const port = Number(readFileSync(targetFile, 'utf8').trim());
  if (!allowedPorts.has(port)) throw new Error(`Invalid homepage target port: ${port}`);
  return port;
}

function respondUnavailable(response, error) {
  console.error(`[homepage-router] ${error instanceof Error ? error.message : String(error)}`);
  if (!response.headersSent) {
    response.writeHead(503, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '2',
    });
  }
  response.end(JSON.stringify({ status: 'unavailable', service: '3dp-homepage' }));
}

const server = http.createServer((request, response) => {
  if (request.url === '/__router_health') {
    try {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ status: 'ok', targetPort: activePort() }));
    } catch (error) {
      respondUnavailable(response, error);
    }
    return;
  }

  let targetPort;
  try {
    targetPort = activePort();
  } catch (error) {
    respondUnavailable(response, error);
    return;
  }

  const upstreamRequest = http.request(
    {
      hostname: '127.0.0.1',
      port: targetPort,
      method: request.method,
      path: request.url,
      headers: request.headers,
      timeout: 310_000,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );

  upstreamRequest.on('timeout', () => upstreamRequest.destroy(new Error('Upstream request timed out.')));
  upstreamRequest.on('error', (error) => respondUnavailable(response, error));
  request.on('aborted', () => upstreamRequest.destroy());
  request.pipe(upstreamRequest);
});

server.on('upgrade', (request, clientSocket, head) => {
  let targetPort;
  try {
    targetPort = activePort();
  } catch {
    clientSocket.destroy();
    return;
  }

  const upstreamSocket = net.connect(targetPort, '127.0.0.1');
  upstreamSocket.setTimeout(310_000);
  upstreamSocket.on('connect', () => {
    const headers = request.rawHeaders.map((value, index) => (index % 2 === 0 ? `${value}: ` : `${value}\r\n`)).join('');
    upstreamSocket.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${headers}\r\n`);
    if (head.length > 0) upstreamSocket.write(head);
    clientSocket.pipe(upstreamSocket).pipe(clientSocket);
  });
  upstreamSocket.on('error', () => clientSocket.destroy());
  upstreamSocket.on('timeout', () => upstreamSocket.destroy());
  clientSocket.on('error', () => upstreamSocket.destroy());
});

server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
server.listen(listenPort, listenHost, () => {
  console.log(`[homepage-router] listening on http://${listenHost}:${listenPort}`);
});

function shutdown(signal) {
  console.log(`[homepage-router] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
