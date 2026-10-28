import { createServer } from "node:http";
import {
  readFile,
  stat,
  realpath,
  mkdir,
  writeFile,
  unlink,
} from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildSite, ROOT, COMMON_STYLES } from "./project.mjs";

const args = process.argv.slice(2);
const known = new Set(["--port", "--host", "--ttl", "--watch"]);
for (let i = 0; i < args.length; i++) {
  if (!known.has(args[i])) throw new Error("Unknown option: " + args[i]);
  if (args[i] !== "--watch") {
    if (!args[i + 1] || args[i + 1].startsWith("--"))
      throw new Error("Missing value for " + args[i]);
    i++;
  }
}
const value = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const port = Number(value("--port", 8765));
const host = value("--host", "0.0.0.0");
const ttl = Number(value("--ttl", 60));
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("Port must be 0–65535");
if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 1440)
  throw new Error("TTL must be 0 < minutes <= 1440");
const decks = await buildSite();
const publicEntries = new Set([
  "index.html",
  "gallery.html",
  ...decks.map((deck) => deck.output),
  ...COMMON_STYLES,
  "styles/gallery.css",
  "runtime/presentation.js",
  ...decks.flatMap((deck) => [...deck.styles, ...deck.scripts]),
]);
const publicFile = (file) =>
  publicEntries.has(file) ||
  /^(styles|runtime)\/[a-z0-9-]+\.(css|js)$/.test(file) ||
  /^(?:assets|decks\/[a-z0-9-]+\/assets)\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|svg|webp|gif|avif|woff2?|mp4|webm|mp3|ogg)$/.test(
    file,
  );
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};
let expiresAt;
let record;
let stopping = false;
let watchTimer;
let rebuilding = false;
let pending = false;
const watchers = [];
const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (pathname === "/__health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        request.method === "HEAD"
          ? undefined
          : JSON.stringify({
              status: "ok",
              pid: process.pid,
              expiresAt,
              decks: decks.length,
            }),
      );
      return;
    }
    const file = pathname === "/" ? "index.html" : pathname.slice(1);
    if (!publicFile(file)) {
      response.writeHead(404).end("Not found");
      return;
    }
    const resolved = await realpath(path.resolve(ROOT, file));
    if (!resolved.startsWith(ROOT + path.sep)) {
      response.writeHead(404).end();
      return;
    }
    const info = await stat(resolved);
    if (!info.isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
    });
    response.end(
      request.method === "HEAD" ? undefined : await readFile(resolved),
    );
  } catch {
    response.writeHead(404).end("Not found");
  }
});

function shutdown(reason) {
  if (stopping) return;
  stopping = true;
  clearTimeout(watchTimer);
  for (const watcher of watchers) watcher.close();
  console.log(
    "\nStopping (" + reason + "); releasing port " + server.address()?.port,
  );
  server.close(async () => {
    if (record) await unlink(record).catch(() => {});
    process.exit(0);
  });
  server.closeAllConnections();
}
async function rebuild() {
  if (rebuilding) {
    pending = true;
    return;
  }
  rebuilding = true;
  try {
    const updatedDecks = await buildSite();
    for (const deck of updatedDecks) {
      publicEntries.add(deck.output);
      [...deck.styles, ...deck.scripts].forEach((file) =>
        publicEntries.add(file),
      );
    }
    console.log(
      "Rebuilt at " +
        new Date().toLocaleTimeString() +
        " — refresh the browser",
    );
  } catch (error) {
    console.error("Build failed:", error.message);
  } finally {
    rebuilding = false;
    if (pending) {
      pending = false;
      await rebuild();
    }
  }
}
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "Port " + port + " is occupied; choose --port <number>."
      : error,
  );
  process.exit(1);
});
server.listen(port, host, async () => {
  const actualPort = server.address().port;
  expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();
  setTimeout(
    () => shutdown("TTL " + ttl + " minutes reached"),
    ttl * 60_000,
  ).unref();
  const links = ["http://127.0.0.1:" + actualPort];
  if (host === "0.0.0.0") {
    for (const addresses of Object.values(os.networkInterfaces())) {
      for (const address of addresses || [])
        if (address.family === "IPv4" && !address.internal)
          links.push("http://" + address.address + ":" + actualPort);
    }
  }
  console.log("Preview ready (PID " + process.pid + ")");
  console.log("  Local: " + links[0]);
  if (links[1]) console.log("  Network: " + links[1]);
  console.log("  Gallery: " + links[0] + "/gallery.html");
  console.log("  Expires: " + expiresAt + " (" + ttl + " minutes)");
  await mkdir(path.join(ROOT, ".preview"), { recursive: true });
  record = path.join(ROOT, ".preview", "server-" + actualPort + ".json");
  await writeFile(
    record,
    JSON.stringify(
      { pid: process.pid, port: actualPort, host, expiresAt, links },
      null,
      2,
    ),
  );
  if (args.includes("--watch")) {
    for (const directory of ["decks", "templates", "styles", "runtime"]) {
      watchers.push(
        watch(path.join(ROOT, directory), { recursive: true }, () => {
          clearTimeout(watchTimer);
          watchTimer = setTimeout(rebuild, 150);
        }),
      );
    }
  }
});
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
