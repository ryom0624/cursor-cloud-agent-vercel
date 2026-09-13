import { describe, expect, it } from "vitest";
import { filterHarEntries, harEntryToHttpRequest, parseHar, sampleHar } from "./har";

describe("HAR parsing", () => {
  it("summarizes requests, errors and slow entries", () => {
    const parsed = parseHar(sampleHar);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary.requestCount).toBe(3);
    expect(parsed.summary.errorCount).toBe(2);
    expect(parsed.summary.slowCount).toBe(1);
    expect(parsed.summary.entries[0].host).toBe("api.example.com");
  });

  it("filters 4xx, 5xx, slowest and largest", () => {
    const parsed = parseHar(sampleHar);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(filterHarEntries(parsed.summary.entries, "4xx").map((item) => item.status)).toEqual([404]);
    expect(filterHarEntries(parsed.summary.entries, "5xx").map((item) => item.status)).toEqual([500]);
    expect(filterHarEntries(parsed.summary.entries, "slowest")[0].duration).toBe(1280);
    expect(filterHarEntries(parsed.summary.entries, "largest")[0].size).toBe(20480);
  });

  it("converts a HAR request into the HTTP request model", () => {
    const parsed = parseHar(sampleHar);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const request = harEntryToHttpRequest(parsed.summary.entries[1]);
    expect(request.method).toBe("POST");
    expect(request.body).toBe('{"name":"Dev"}');
    expect(request.bodyType).toBe("json");
  });

  it("rejects invalid JSON and missing entries", () => {
    expect(parseHar("{").ok).toBe(false);
    expect(parseHar("{}").ok).toBe(false);
  });
});
