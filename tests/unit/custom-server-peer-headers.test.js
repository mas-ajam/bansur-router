// custom-server.js is the only thing that makes x-bansur-real-ip trustworthy. Boot a real
// HTTP server through it and confirm a client cannot smuggle its own peer headers in.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRequire } from "node:module";
import http from "node:http";
import { __test__ as requestDetails } from "@/lib/db/repos/requestDetailsRepo.js";

const require = createRequire(import.meta.url);

let server;
let baseUrl;
let seenHeaders;

beforeAll(async () => {
  require("../../custom-server.js");
  server = http.createServer((req, res) => {
    seenHeaders = req.headers;
    res.end("ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function get(headers = {}) {
  await fetch(baseUrl, { headers });
  return seenHeaders;
}

describe("custom-server peer header sanitizing", () => {
  it("generates a peer trust token at boot", () => {
    expect(process.env.BANSURROUTER_PEER_TOKEN).toMatch(/^[0-9a-f]{48}$/);
  });

  it("replaces a client-supplied x-bansur-real-ip with the socket address", async () => {
    const headers = await get({ "x-bansur-real-ip": "203.0.113.55" });

    expect(headers["x-bansur-real-ip"]).toMatch(/^(::ffff:)?127\.0\.0\.1$/);
  });

  it("stamps the trust token so downstream can tell the wrapper ran", async () => {
    const headers = await get();

    expect(headers["x-bansur-peer-token"]).toBe(process.env.BANSURROUTER_PEER_TOKEN);
  });

  it("drops a client-supplied peer trust token", async () => {
    const headers = await get({ "x-bansur-peer-token": "forged-token" });

    expect(headers["x-bansur-peer-token"]).toBe(process.env.BANSURROUTER_PEER_TOKEN);
    expect(headers["x-bansur-peer-token"]).not.toBe("forged-token");
  });

  it("drops a client-supplied x-bansur-via-proxy marker", async () => {
    const headers = await get({ "x-bansur-via-proxy": "1" });

    expect(headers["x-bansur-via-proxy"]).toBeUndefined();
  });

  it("marks via-proxy and adopts the forwarded IP for a loopback proxy hop", async () => {
    const headers = await get({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });

    expect(headers["x-bansur-via-proxy"]).toBe("1");
    expect(headers["x-bansur-real-ip"]).toBe("203.0.113.9");
    expect(headers["x-forwarded-for"]).toBeUndefined();
  });

  // chat.js snapshots every client header into the request detail. Anything that grants
  // access must not survive into a record the dashboard renders and cloud sync uploads.
  it("keeps the peer token out of persisted request details", () => {
    const sanitized = requestDetails.sanitizeHeaders({
      "x-bansur-peer-token": "secret",
      "x-bansur-cli-token": "secret",
      "authorization": "Bearer sk-x",
      "x-bansur-real-ip": "127.0.0.1",
    });

    expect(sanitized["x-bansur-peer-token"]).toBeUndefined();
    expect(sanitized["x-bansur-cli-token"]).toBeUndefined();
    expect(sanitized["authorization"]).toBeUndefined();
    expect(sanitized["x-bansur-real-ip"]).toBe("127.0.0.1");
  });
});
