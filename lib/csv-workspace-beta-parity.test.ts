import { describe, expect, it } from "vitest";
import { decodeCsvBytes, defaultViewerSettings, parseCsvTable } from "./csv-utils-beta";

const sample = `id,zip,amount
1,00123,1E10
2,0000000001,1.2e3`;

describe("Beta workspace reuses official parse/decode", () => {
  it("keeps the same rows, columns, and cell values as the official parser", () => {
    const parsed = parseCsvTable(sample, defaultViewerSettings);
    expect(parsed.columns).toEqual(["col_0", "col_1", "col_2"]);
    expect(parsed.headerValues).toEqual(["id", "zip", "amount"]);
    expect(parsed.records).toEqual([
      { col_0: "1", col_1: "00123", col_2: "1E10" },
      { col_0: "2", col_1: "0000000001", col_2: "1.2e3" },
    ]);
  });

  it("keeps paste text as encoding-unknown-free UTF-8 text", () => {
    const bytes = new TextEncoder().encode(sample);
    const decoded = decodeCsvBytes(bytes, "utf-8");
    expect(decoded.text).toBe(sample);
    expect(decoded.encoding).toBe("utf-8");
  });
});
