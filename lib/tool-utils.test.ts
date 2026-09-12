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
import {
  decodeCsvBytes,
  encodeCsvText,
  excelCsvPreset,
  formatCsvTimestamp,
  inspectCsv,
  repairUtf8ReadAsShiftJis,
  serializeCsv,
  standardCsvPreset,
} from "./csv-utils";

describe("CSV utilities", () => {
  it("parses quoted fields and line breaks", () => {
    expect(parseCsv('name,note\nDevSmith,"fast, private"')).toEqual([
      ["name", "note"],
      ["DevSmith", "fast, private"],
    ]);
    expect(inspectCsv('id,name\n1,  前後空白  \n2,"  quoted  "').rows).toEqual([
      ["id", "name"],
      ["1", "  前後空白  "],
      ["2", "  quoted  "],
    ]);
  });

  it("converts JSON and CSV in both directions", () => {
    const csv = jsonToCsv('[{"name":"DevSmith","count":24}]');
    expect(csv).toBe("name,count\nDevSmith,24");
    expect(JSON.parse(csvToJson(csv))).toEqual([
      { name: "DevSmith", count: "24" },
    ]);
  });

  it("detects delimiters, line endings, BOM, and uneven rows", () => {
    const inspection = inspectCsv("\uFEFFid;name\r\n1;DevSmith\r\n2");
    expect(inspection.delimiter).toBe(";");
    expect(inspection.lineEnding).toBe("CRLF");
    expect(inspection.hasBom).toBe(true);
    expect(inspection.warnings[0]).toContain("列数");
    expect(inspectCsv("id,name\n1,DevSmith").lineEnding).toBe("LF");
    expect(inspectCsv('id,note\n1,"改行\nを含む"').rows[1]).toEqual(["1", "改行\nを含む"]);
  });

  it("round trips UTF-8 CSV with and without BOM", () => {
    const source = "id,name\n1,開発";
    const withBom = encodeCsvText(source, "utf-8", true);
    const withoutBom = encodeCsvText(source, "utf-8", false);
    expect(withBom[0]).toBe(0xef);
    expect(withoutBom[0]).not.toBe(0xef);
    expect(decodeCsvBytes(withBom, "auto")).toMatchObject({
      text: source,
      encoding: "utf-8",
      hasBom: true,
    });
    expect(decodeCsvBytes(withoutBom, "auto")).toMatchObject({
      text: source,
      encoding: "utf-8",
      hasBom: false,
    });
  });

  it("encodes and decodes Shift_JIS files", () => {
    const source = "id,name\r\n1,開発";
    const bytes = encodeCsvText(source, "shift_jis", false);
    expect(decodeCsvBytes(bytes, "auto")).toMatchObject({
      text: source,
      encoding: "shift_jis",
      hasBom: false,
    });
    expect(Array.from(encodeCsvText("開発", "shift_jis", false))).toEqual([0x8a, 0x4a, 0x94, 0xad]);
  });

  it("repairs reversible UTF-8 read as Shift_JIS mojibake", () => {
    expect(repairUtf8ReadAsShiftJis("縺薙ｓ縺ｫ縺｡縺ｯ")).toMatchObject({
      text: "こんにちは",
      repairedCount: 1,
      failures: [],
    });
    const mixed = repairUtf8ReadAsShiftJis("id,name,note\n1,縺薙ｓ縺ｫ縺｡縺ｯ,壊れた�文字\n2,通常,🔧");
    expect(mixed.text).toContain("こんにちは");
    expect(mixed.text).toContain("壊れた�文字");
    expect(mixed.text).toContain("通常");
    expect(mixed.text).toContain("🔧");
    expect(mixed.repairedCount).toBe(1);
    expect(mixed.failures).toEqual([
      expect.objectContaining({ row: 2, column: 3, reason: expect.stringContaining("置換文字") }),
      expect.objectContaining({ row: 3, column: 3, reason: expect.stringContaining("戻せない文字") }),
    ]);
    const emoji = repairUtf8ReadAsShiftJis("id,note\n1,🔧");
    expect(emoji.text).toContain("🔧");
    expect(emoji.failures[0]).toEqual(expect.objectContaining({
      row: 2,
      column: 2,
      reason: expect.stringContaining("戻せない文字"),
    }));
    const mixedCell = repairUtf8ReadAsShiftJis("id,note\n1,縺薙ｓ縺ｫ縺｡縺ｯ🔧");
    expect(mixedCell.text).toContain("縺薙ｓ縺ｫ縺｡縺ｯ🔧");
    expect(mixedCell.failures[0]).toEqual(expect.objectContaining({ row: 2, column: 2 }));
  });

  it("serializes configurable CSV output", () => {
    expect(serializeCsv([{ id: "01", note: "a,b" }], ["id", "note"], {
      lineEnding: "\r\n",
      quoteAll: true,
    })).toBe('"id","note"\r\n"01","a,b"');
    expect(serializeCsv([{ note: 'say "yes"' }], ["note"], {
      escapeMode: "backslash",
      finalLineEnding: true,
    })).toBe('note\n"say \\"yes\\""\n');
    expect(inspectCsv('note\n"say \\"yes\\""', { escapeMode: "backslash" }).rows[1]).toEqual(['say "yes"']);
  });

  it("keeps standard and Excel download presets distinct", () => {
    expect(standardCsvPreset).toMatchObject({
      encoding: "utf-8",
      includeBom: false,
      lineEnding: "\n",
    });
    expect(excelCsvPreset).toMatchObject({
      encoding: "utf-8",
      includeBom: true,
      lineEnding: "\r\n",
      quoteAll: true,
    });
    const rows = serializeCsv([{ name: "DevSmith" }], ["name"], excelCsvPreset);
    expect(rows.startsWith('"name"')).toBe(true);
    expect(encodeCsvText("name", excelCsvPreset.encoding, excelCsvPreset.includeBom)[0]).toBe(0xef);
  });

  it("formats download timestamps as local calendar digits", () => {
    expect(formatCsvTimestamp(new Date(2026, 8, 12, 4, 5, 6))).toBe("20260912040506");
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
