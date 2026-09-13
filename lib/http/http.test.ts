import { describe, expect, it } from "vitest";
import { parseCurl } from "./curl";
import { generateAxios, generateCurl, generateFetch, generateHttpCode, generatePythonRequests } from "./codegen";
import { parseRawHeaders, inspectAuthorization } from "./headers";
import { parseCacheControl, formatDuration } from "./cache-control";
import { computeHmacHex, verifyHmac } from "./hmac";
import { emptyHttpRequest, resolvedRequestUrl } from "./request-model";

describe("cURL parsing", () => {
  it("parses method, url, headers and json body", () => {
    const parsed = parseCurl(`curl https://example.com:8443/api/users?page=2 \\
      -X POST \\
      -H 'Content-Type: application/json' \\
      -H 'Authorization: Bearer abc' \\
      --data-raw '{"name":"Dev"}'`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.method).toBe("POST");
    expect(parsed.request.url).toBe("https://example.com:8443/api/users");
    expect(parsed.request.query).toEqual([{ key: "page", value: "2" }]);
    expect(parsed.request.body).toBe('{"name":"Dev"}');
    expect(parsed.request.bodyType).toBe("json");
    expect(parsed.request.headers).toEqual([
      { key: "Content-Type", value: "application/json" },
      { key: "Authorization", value: "Bearer abc" },
    ]);
  });

  it("defaults bodyful curl to POST", () => {
    const parsed = parseCurl(`curl https://example.com --data a=b`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.method).toBe("POST");
    expect(parsed.request.bodyType).toBe("form");
  });

  it("supports --json and quoted multiline commands", () => {
    const parsed = parseCurl(`curl --json '{"ok":true}' https://example.com/items`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.method).toBe("POST");
    expect(parsed.request.body).toBe('{"ok":true}');
  });

  it("rejects missing urls and unknown flags", () => {
    expect(parseCurl("curl").ok).toBe(false);
    expect(parseCurl("curl https://example.com --made-up").ok).toBe(false);
  });
});

describe("HTTP request conversion", () => {
  const model = {
    ...emptyHttpRequest(),
    method: "POST",
    url: "https://example.com/api",
    query: [{ key: "page", value: "2" }],
    headers: [{ key: "Content-Type", value: "application/json" }],
    body: '{"name":"Dev"}',
    bodyType: "json" as const,
  };

  it("resolves query into the URL", () => {
    expect(resolvedRequestUrl(model)).toBe("https://example.com/api?page=2");
  });

  it("generates fetch, axios, python and curl from the same model", () => {
    expect(generateFetch(model)).toContain("await fetch(");
    expect(generateFetch(model)).toContain("JSON.stringify(");
    expect(generateAxios(model)).toContain("axios.post");
    expect(generatePythonRequests(model)).toContain("requests.post");
    expect(generateCurl(model)).toContain("--request POST");
    expect(generateHttpCode(model, "go")).toContain("http.NewRequest");
  });
});

describe("Header parsing", () => {
  it("splits raw headers and inspects cookies, content-type and bearer JWT", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXZzbWl0aCJ9.sig";
    const parsed = parseRawHeaders(`Content-Type: application/json; charset=utf-8
Authorization: Bearer ${jwt}
Cookie: a=1; b=2
X-Request-Id: abc`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contentType?.mediaType).toBe("application/json");
    expect(parsed.contentType?.charset).toBe("utf-8");
    expect(parsed.cookies).toEqual([
      { name: "a", value: "1" },
      { name: "b", value: "2" },
    ]);
    expect(parsed.authorization?.isJwt).toBe(true);
    expect(parsed.authorization?.jwtPayload?.sub).toBe("devsmith");
  });

  it("inspects basic authorization", () => {
    const info = inspectAuthorization(`Basic ${btoa("user:secret")}`);
    expect(info.basicUser).toBe("user");
    expect(info.basicPassword).toBe("secret");
  });

  it("rejects lines without a colon", () => {
    expect(parseRawHeaders("NotHeader").ok).toBe(false);
  });
});

describe("Cache-Control inspector", () => {
  it("explains max-age and stale-while-revalidate", () => {
    const parsed = parseCacheControl("public, max-age=3600, stale-while-revalidate=60");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.directives.map((item) => item.name)).toEqual([
      "public",
      "max-age",
      "stale-while-revalidate",
    ]);
    expect(parsed.directives[1].human).toBe("3600 seconds = 1 hour");
    expect(formatDuration(60)).toBe("1 minute");
  });
});

describe("Webhook HMAC", () => {
  it("verifies hex signatures and rejects mismatches", async () => {
    const secret = "whsec_test";
    const payload = '{"ok":true}';
    const hex = await computeHmacHex("SHA-256", secret, payload);
    const valid = await verifyHmac({
      algorithm: "SHA-256",
      secret,
      payload,
      expected: `sha256=${hex}`,
    });
    expect(valid.valid).toBe(true);
    const invalid = await verifyHmac({
      algorithm: "SHA-256",
      secret,
      payload,
      expected: "deadbeef",
    });
    expect(invalid.valid).toBe(false);
  });

  it("supports sha1 and sha512", async () => {
    const hex1 = await computeHmacHex("SHA-1", "secret", "payload");
    const hex512 = await computeHmacHex("SHA-512", "secret", "payload");
    expect(hex1).toHaveLength(40);
    expect(hex512).toHaveLength(128);
  });
});
