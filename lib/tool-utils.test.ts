import { describe, expect, it } from "vitest";
import {
  csvToJson,
  decodeBase64,
  decodeHtml,
  describeCron,
  diffLines,
  encodeBase64,
  encodeHtml,
  generateUlid,
  jsonToCsv,
  parseCsv,
  convertCase,
} from "./tool-utils";

describe("CSV utilities", () => {
  it("parses quoted fields and line breaks", () => {
    expect(parseCsv('name,note\nDevSmith,"fast, private"')).toEqual([
      ["name", "note"],
      ["DevSmith", "fast, private"],
    ]);
  });

  it("converts JSON and CSV in both directions", () => {
    const csv = jsonToCsv('[{"name":"DevSmith","count":24}]');
    expect(csv).toBe("name,count\nDevSmith,24");
    expect(JSON.parse(csvToJson(csv))).toEqual([
      { name: "DevSmith", count: "24" },
    ]);
  });
});

describe("encoding utilities", () => {
  it("round trips Unicode Base64", () => {
    const source = "DevSmith 日本語 🔧";
    expect(decodeBase64(encodeBase64(source))).toBe(source);
  });

  it("encodes and decodes HTML entities", () => {
    const source = '<button title="tool">保存 & 終了</button>';
    expect(decodeHtml(encodeHtml(source))).toBe(source);
  });
});

describe("text utilities", () => {
  it("converts developer case formats", () => {
    expect(convertCase("Dev smith tools", "camel")).toBe("devSmithTools");
    expect(convertCase("Dev smith tools", "snake")).toBe("dev_smith_tools");
    expect(convertCase("devSmithTools", "kebab")).toBe("dev-smith-tools");
  });

  it("returns added and removed diff lines", () => {
    expect(diffLines("a\nb", "a\nc")).toEqual([
      { type: "same", value: "a" },
      { type: "removed", value: "b" },
      { type: "added", value: "c" },
    ]);
  });
});

describe("generator and cron utilities", () => {
  it("generates a sortable 26-character ULID", () => {
    expect(generateUlid(1_700_000_000_000)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("describes common cron expressions", () => {
    expect(describeCron("0 9 * * 1-5")).toBe("平日の 9:00");
    expect(describeCron("*/15 * * * *")).toBe("15分ごと");
  });
});
