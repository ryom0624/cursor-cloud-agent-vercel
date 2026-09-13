import { describe, expect, it } from "vitest";
import {
  buildQueryString,
  buildUrl,
  decodeUrlComponent,
  encodeUrlComponent,
  parseQueryString,
  parseUrl,
} from "./url-tools";

describe("URL parsing", () => {
  it("parses protocol, host, port, path, query and fragment", () => {
    const parsed = parseUrl("https://example.com:8443/api/users?page=2&sort=name#detail");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.protocol).toBe("https");
    expect(parsed.value.hostname).toBe("example.com");
    expect(parsed.value.port).toBe("8443");
    expect(parsed.value.path).toBe("/api/users");
    expect(parsed.value.fragment).toBe("detail");
    expect(parsed.value.query).toEqual([
      { key: "page", value: "2", raw: "2", decoded: "2" },
      { key: "sort", value: "name", raw: "name", decoded: "name" },
    ]);
  });

  it("rejects invalid URLs", () => {
    expect(parseUrl("not a url").ok).toBe(false);
    expect(parseUrl("/relative").ok).toBe(false);
    expect(parseUrl("").ok).toBe(false);
  });

  it("keeps raw and decoded query values", () => {
    const parsed = parseUrl("https://example.com/search?q=hello%20world");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.query[0].raw).toBe("hello%20world");
    expect(parsed.value.query[0].decoded).toBe("hello world");
  });
});

describe("Query building", () => {
  it("encodes spaces in query values", () => {
    expect(
      buildQueryString([
        { key: "q", value: "hello world" },
        { key: "page", value: "2" },
      ]),
    ).toBe("?q=hello+world&page=2");
  });

  it("skips empty keys and supports duplicate keys", () => {
    expect(
      buildQueryString([
        { key: "", value: "x" },
        { key: "tag", value: "a" },
        { key: "tag", value: "b" },
      ]),
    ).toBe("?tag=a&tag=b");
  });

  it("parses query strings without a leading question mark", () => {
    expect(parseQueryString("q=hello%20world").map((item) => item.decoded)).toEqual(["hello world"]);
  });
});

describe("URL encode/decode and builder", () => {
  it("round-trips encodeURIComponent values", () => {
    expect(decodeUrlComponent(encodeUrlComponent("hello world"))).toBe("hello world");
  });

  it("builds a URL from parts", () => {
    expect(
      buildUrl({
        protocol: "https",
        hostname: "example.com",
        port: "8443",
        pathname: "/api/users",
        query: [{ key: "page", value: "2" }],
        fragment: "detail",
      }),
    ).toBe("https://example.com:8443/api/users?page=2#detail");
  });
});
