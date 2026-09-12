import { describe, expect, it } from "vitest";
import { defaultViewerSettings, parseCsvTable, serializeCsv } from "../lib/csv-utils-beta";

const runExtended = process.env.JTC_EXTENDED === "1";

describe.skipIf(!runExtended)("JTC Hell CSV extended suite", () => {
  it("parses 100,000 generated rows", () => {
    const rows = Array.from({ length: 100_000 }, (_, index) => `${index},name-${index},00123`);
    const csv = ["id,name,code", ...rows].join("\n");
    const started = Date.now();
    const parsed = parseCsvTable(csv, defaultViewerSettings);
    const elapsed = Date.now() - started;
    expect(parsed.records).toHaveLength(100_000);
    expect(parsed.records[0].col_2).toBe("00123");
    expect(elapsed).toBeLessThan(15_000);
  });

  it("parses 1,000 columns on one row", () => {
    const header = Array.from({ length: 1000 }, (_, index) => `c${index}`).join(",");
    const row = Array.from({ length: 1000 }, (_, index) => `v${index}`).join(",");
    const parsed = parseCsvTable(`${header}\n${row}`, defaultViewerSettings);
    expect(parsed.columns).toHaveLength(1000);
    expect(parsed.records[0].col_999).toBe("v999");
  });

  it("serializes a 100,000-character cell without looping", () => {
    const huge = "x".repeat(100_000);
    const parsed = parseCsvTable(`note\n"${huge}"`, defaultViewerSettings);
    expect(parsed.records[0].col_0).toHaveLength(100_000);
    expect(serializeCsv(parsed.records, parsed.columns, { headerLabels: parsed.headerValues }).length).toBeGreaterThan(100_000);
  });
});
