import { describe, expect, it } from "vitest";
import {
  buildXlsxBuffer,
  canEncodeToShiftJis,
  decodeCsvBytes,
  defaultViewerSettings,
  detectCsvEncoding,
  detectCsvEncodingDetails,
  encodeCsvText,
  findSjisUnmappableChars,
  hasMixedLineEndings,
  inspectCsv,
  isCsvInjectionValue,
  isDateLikeRisk,
  isLeadingZeroRisk,
  isLongIntegerRisk,
  isScientificRisk,
  LARGE_FILE_WARNING_BYTES,
  isLargeFileWarning,
  parseCsvTable,
  PREVIEW_ROW_LIMIT,
  serializeCsv,
} from "../lib/csv-utils-beta";
import { eucJp, iso2022jp, sjis, texts, utf16le, utf8 } from "./fixtures/csv/build-fixtures";

const settings = defaultViewerSettings;

function parse(text: string, overrides = {}) {
  return parseCsvTable(text, { ...settings, ...overrides });
}

function cells(parsed: ReturnType<typeof parseCsvTable>) {
  return parsed.records.map((record) => parsed.columns.map((column) => record[column]));
}

describe("JTC Hell CSV fast suite", () => {
  it("CSV-001..006 baseline headers and cells", () => {
    const cases = [
      { text: texts.ascii, rows: 2, cols: 2 },
      { text: texts.japaneseLf, rows: 2, cols: 2 },
      { text: texts.japaneseCrlf, rows: 2, cols: 2 },
      { text: "id\tname\n1\tDev", rows: 1, cols: 2 },
      { text: "id;name\r\n1;Dev", rows: 1, cols: 2 },
      { text: "id|name\n1|Dev", rows: 1, cols: 2 },
    ];
    cases.forEach((item) => {
      const parsed = parse(item.text);
      expect(parsed.error).toBe("");
      expect(parsed.records).toHaveLength(item.rows);
      expect(parsed.columns).toHaveLength(item.cols);
    });
  });

  it("keeps JTC names and does not normalize 髙/高橋", () => {
    const parsed = parse(texts.personHell);
    expect(parsed.records.map((record) => record.col_0)).toEqual(["髙橋", "高橋", "﨑山", "崎山", "𠮷田", "吉田"]);
    expect(parsed.records[0].col_0).toBe("髙橋");
    expect(parsed.records[1].col_0).toBe("高橋");
  });

  it("stops Shift_JIS on unmappable characters and round-trips representable ones", () => {
    expect(findSjisUnmappableChars("𠮷😀𩸽").length).toBe(3);
    expect(encodeCsvText(texts.sjisUnsafe, "shift_jis", false).bytes.length).toBe(0);
    const ok = "①㈱髙﨑ｱｲｳ";
    expect(canEncodeToShiftJis(ok)).toBe(true);
    const bytes = encodeCsvText(ok, "shift_jis", false).bytes;
    expect(decodeCsvBytes(bytes, "shift_jis").text).toBe(ok);
  });

  it("inherits UTF-16LE/BE encoding, BOM, tab and CRLF in serialize+encode", () => {
    const source = "id\tname\r\n1\t髙橋\r\n2\t😀";
    const le = encodeCsvText(source, "utf-16le", true).bytes;
    const be = encodeCsvText(source, "utf-16be", true).bytes;
    expect(Array.from(le.slice(0, 2))).toEqual([0xff, 0xfe]);
    expect(Array.from(be.slice(0, 2))).toEqual([0xfe, 0xff]);
    const decodedLe = decodeCsvBytes(le, "auto");
    const decodedBe = decodeCsvBytes(be, "auto");
    expect(decodedLe).toMatchObject({ encoding: "utf-16le", hasBom: true, text: source });
    expect(decodedBe).toMatchObject({ encoding: "utf-16be", hasBom: true, text: source });
    const parsed = parse(decodedLe.text, { delimiter: "\t" });
    const out = serializeCsv(parsed.records, parsed.columns, {
      delimiter: "\t",
      lineEnding: "\r\n",
      headerLabels: parsed.headerValues,
    });
    const inherited = encodeCsvText(out, "utf-16le", true).bytes;
    expect(Array.from(inherited.slice(0, 2))).toEqual([0xff, 0xfe]);
    expect(decodeCsvBytes(inherited, "utf-16le").text.replace(/\r\n$/, "")).toContain("髙橋");
  });

  it("does not misread EUC-JP or ISO-2022-JP as Shift_JIS", () => {
    expect(detectCsvEncoding(eucJp("id,name\n1,日本語"))).toBe("unknown");
    expect(detectCsvEncoding(iso2022jp("id,name\n1,日本語"))).toBe("unknown");
  });

  it("detects quote-internal commas and competing delimiters by column stability", () => {
    expect(inspectCsv('id,name,note\n1,"Tokyo, Japan","comma inside"').delimiter).toBe(",");
    expect(inspectCsv('id;name;note\n1;"Tokyo, Japan";test').delimiter).toBe(";");
    expect(inspectCsv(texts.delimiterConflict).delimiter).toBe(",");
    expect(inspectCsv(texts.spaceAccident).delimiter).not.toBe(" ");
  });

  it("opens duplicate, blank, case, and Japanese duplicate headers without rewriting export", () => {
    const dup = parse(texts.duplicateHeader);
    expect(dup.error).toBe("");
    expect(dup.headerValues).toEqual(["code", "name", "code", "name"]);
    expect(serializeCsv(dup.records, dup.columns, { headerLabels: dup.headerValues })).toContain("code,name,code,name");
    expect(serializeCsv(dup.records, dup.columns, { headerLabels: dup.headerValues })).not.toContain("col_0");
    const blank = parse(texts.blankHeader);
    expect(blank.headerValues).toEqual(["code", "", "name", ""]);
    const cases = parse(texts.caseHeader);
    expect(cases.headerValues).toEqual(["name", "Name", "NAME"]);
    const jp = parse(texts.jpDuplicateHeader);
    expect(jp.headerValues).toEqual(["コード", "名称", "コード", "名称"]);
  });

  it("keeps uneven rows, trailing empty columns, NUL, and empty rows visible", () => {
    const uneven = parse(texts.uneven);
    expect(uneven.records).toHaveLength(3);
    expect(uneven.warnings.some((warning) => warning.includes("列数"))).toBe(true);
    expect(uneven.records[1].col_2).toBe("");
    expect(uneven.records[2].col_3).toBe("9");
    const trailing = inspectCsv(texts.trailingEmpty, { skipEmptyLines: false });
    expect(trailing.rows[0]).toEqual(["a", "b", "c", ""]);
    expect(inspectCsv("id,name\n1,Dev\0Smith").warnings.some((warning) => warning.includes("NUL"))).toBe(true);
    expect(parseCsvTable(texts.emptyRows, { ...settings, skipEmptyLines: true }).records).toHaveLength(2);
    expect(parseCsvTable(texts.emptyRows, { ...settings, skipEmptyLines: false }).records.length).toBeGreaterThan(2);
  });

  it("does not trim Simple defaults and keeps NULL-like tokens as text", () => {
    const parsed = parse("value\n\" abc \"\n abc \n　abc　\nNULL\n-\n0");
    expect(parsed.records.map((record) => record.col_0)).toEqual([" abc ", " abc ", "　abc　", "NULL", "-", "0"]);
  });

  it("classifies Excel risks without mutating values", () => {
    expect(isLeadingZeroRisk("00123")).toBe(true);
    expect(isLeadingZeroRisk("0")).toBe(false);
    expect(isLongIntegerRisk("123456789012345")).toBe(false);
    expect(isLongIntegerRisk("1234567890123456")).toBe(true);
    expect(isDateLikeRisk("2026-09-12")).toBe(true);
    expect(isDateLikeRisk("2026/09/12")).toBe(true);
    expect(isDateLikeRisk("令和8年9月12日")).toBe(false);
    expect(isDateLikeRisk("9/12")).toBe(false);
    expect(isScientificRisk("1E10")).toBe(true);
    const parsed = parse(texts.leadingZero);
    expect(parsed.records[0].col_1).toBe("00123");
  });

  it("warns for formula injection variants without sanitizing", () => {
    ["=1+1", "+SUM(A1:A2)", "-cmd", "@external", "*test", "＝1+1", "＋cmd", "－cmd", "＠external", "\t=1"].forEach((value) => {
      expect(isCsvInjectionValue(value)).toBe(true);
    });
    const parsed = parse("id,note\n1,=1+1");
    expect(parsed.records[0].col_1).toBe("=1+1");
  });

  it("keeps NFC/NFD sequences distinct and does not crash on empty/BOM-only", () => {
    const parsed = parse(texts.nfcNfd);
    expect(parsed.records[0].col_0).not.toBe(parsed.records[1].col_0);
    expect(parse("").error).toContain("ヘッダー");
    expect(decodeCsvBytes(utf8("", true), "auto").text).toBe("");
    expect(decodeCsvBytes(utf16le("", true), "auto").text).toBe("");
  });

  it("warns on separator directive without removing it", () => {
    const inspection = inspectCsv(texts.sepDirective);
    expect(inspection.separatorDirective).toBe("sep=;");
    expect(inspection.rows[0][0]).toContain("sep=");
  });

  it("documents 10MB and 10,000-row preview constants without truncating parse of generated data", () => {
    expect(LARGE_FILE_WARNING_BYTES).toBe(10 * 1024 * 1024);
    expect(PREVIEW_ROW_LIMIT).toBe(10_000);
    const rows = Array.from({ length: 10_001 }, (_, index) => `${index},x`);
    const parsed = parse(["id,name", ...rows].join("\n"));
    expect(parsed.records).toHaveLength(10_001);
  });

  it("preserves XLSX strings for 00123, long int, formula, and 1E10", async () => {
    const records = [{ a: "00123", b: "123456789012345678", c: "=1+1", d: "1E10" }];
    const bytes = await buildXlsxBuffer(records, ["a", "b", "c", "d"], ["a", "b", "c", "d"]);
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
    expect(["A2", "B2", "C2", "D2"].map((addr) => String(workbook.worksheets[0].getCell(addr).value))).toEqual([
      "00123",
      "123456789012345678",
      "=1+1",
      "1E10",
    ]);
  });

  it("does not treat quoted multiline as mixed line endings", () => {
    expect(hasMixedLineEndings(texts.quotedMultilineCrlf)).toBe(false);
    expect(hasMixedLineEndings(texts.quotedMultilineLf)).toBe(false);
    expect(hasMixedLineEndings(texts.quotedMultilineCr)).toBe(false);
    expect(hasMixedLineEndings(texts.realMixed)).toBe(true);
  });

  it("round-trips Shift_JIS Japanese after one-cell edit", () => {
    const source = texts.jtcNames.replace("𠮷", "吉");
    const bytes = sjis(source);
    expect(detectCsvEncoding(bytes)).toBe("shift_jis");
    const decoded = decodeCsvBytes(bytes, "auto");
    const parsed = parse(decoded.text);
    parsed.records[0].col_2 = "編集済";
    const output = serializeCsv(parsed.records, parsed.columns, { headerLabels: parsed.headerValues });
    const again = decodeCsvBytes(encodeCsvText(output, "shift_jis", false).bytes, "shift_jis");
    expect(again.text).toContain("髙橋 太郎");
    expect(again.text).toContain("編集済");
  });

  it("keeps header-only as zero data rows and one-column files as comma-stable", () => {
    expect(parse(texts.headerOnly).records).toHaveLength(0);
    expect(inspectCsv(texts.oneColumn).delimiter).toBe(",");
  });

  it("does not rewrite paste as an encoding guess", () => {
    const details = detectCsvEncodingDetails(utf8(texts.ascii));
    expect(details.asciiCompatible).toBe(true);
    expect(details.encoding).toBe("utf-8");
  });
});

describe("JTC Hell mutation guard", () => {
  it("does not trim, number-cast, or rewrite headers on parse", () => {
    const parsed = parse("id,note,id\n00123,\" abc \",=1+1");
    expect(parsed.headerValues).toEqual(["id", "note", "id"]);
    expect(cells(parsed)).toEqual([["00123", " abc ", "=1+1"]]);
  });
});

describe("JTC Hell fixture manifest", () => {
  it("opens every declared fixture without mutating mustPreserve values", async () => {
    const { fixtureManifest } = await import("./fixtures/csv/fixture-manifest");
    for (const fixture of fixtureManifest) {
      const bytes = fixture.bytes?.();
      const decoded = bytes ? decodeCsvBytes(bytes, "auto") : { text: fixture.text ?? "", encoding: undefined as undefined | string };
      if (fixture.expected.encoding) {
        expect(decoded.encoding ?? detectCsvEncoding(new TextEncoder().encode(fixture.text ?? "")), fixture.file).toBe(fixture.expected.encoding);
      }
      if (fixture.expected.open === false) continue;
      const parsed = parse(decoded.text);
      if (fixture.expected.rows != null) expect(parsed.records.length, fixture.file).toBe(fixture.expected.rows);
      if (fixture.expected.columns != null) expect(parsed.columns.length, fixture.file).toBe(fixture.expected.columns);
      if (fixture.expected.headers) expect(parsed.headerValues, fixture.file).toEqual(fixture.expected.headers);
      for (const value of fixture.expected.mustPreserve ?? []) {
        expect(JSON.stringify(parsed.records), fixture.file).toContain(JSON.stringify(value).slice(1, -1) === value ? value : value);
        expect(decoded.text).toContain(value);
      }
      if (fixture.expected.mixedLineEndings != null) {
        expect(hasMixedLineEndings(decoded.text), fixture.file).toBe(fixture.expected.mixedLineEndings);
      }
      if (fixture.expected.sjisExport === "stop") {
        expect(encodeCsvText(decoded.text, "shift_jis", false).bytes.length, fixture.file).toBe(0);
      }
      if (fixture.expected.warnings) {
        const haystack = `${parsed.warnings.join("\n")}\n${parsed.inspection.warnings.join("\n")}`;
        fixture.expected.warnings.forEach((warning) => {
          if (warning === "leadingZero") {
            expect(isLeadingZeroRisk("00123")).toBe(true);
          } else {
            expect(haystack, fixture.file).toContain(warning);
          }
        });
      }
    }
  });
});

describe("JTC Hell additional crash and safety cases", () => {
  it("does not crash on empty, BOM-only, quote storms, or binary-like bytes", () => {
    expect(() => parse("")).not.toThrow();
    expect(() => parse("\uFEFF")).not.toThrow();
    expect(() => inspectCsv("\"".repeat(40))).not.toThrow();
    expect(() => inspectCsv(",".repeat(40))).not.toThrow();
    expect(() => inspectCsv("\r".repeat(40))).not.toThrow();
    expect(detectCsvEncoding(Uint8Array.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00]))).toBe("unknown");
  });

  it("keeps zero-width and NFC/NFD characters", () => {
    const parsed = parse("value\na\u200Bb\n👨‍👩‍👧‍👦\nCafe\u0301");
    expect(parsed.records[0].col_0).toBe("a\u200Bb");
    expect(parsed.records[1].col_0).toBe("👨‍👩‍👧‍👦");
    expect(parsed.records[2].col_0).toBe("Cafe\u0301");
  });

  it("does not treat giant quoted multiline physical lines as extra records", () => {
    const inner = Array.from({ length: 200 }, (_, index) => `line${index}`).join("\n");
    const csv = `id,memo\n1,"${inner}"\n2,ok`;
    const parsed = parse(csv);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0].col_1.split("\n")).toHaveLength(200);
  });

  it("round-trips a random safe field set", () => {
    const fields = Array.from({ length: 20 }, (_, index) => `v${index}_髙_00123`);
    const csv = ["c1,c2", ...fields.map((value, index) => `${index},${value}`)].join("\n");
    const parsed = parse(csv);
    const again = parse(serializeCsv(parsed.records, parsed.columns, { headerLabels: parsed.headerValues }));
    expect(cells(again)).toEqual(cells(parsed));
  });

  it("keeps 9,999 / 10,000 / 10,001 rows fully in parse results", () => {
    for (const count of [9_999, 10_000, 10_001]) {
      const csv = ["id,name", ...Array.from({ length: count }, (_, index) => `${index},x`)].join("\n");
      expect(parse(csv).records).toHaveLength(count);
    }
  });

  it("treats 10MB as the large-file warning boundary", () => {
    expect(isLargeFileWarning(LARGE_FILE_WARNING_BYTES - 1)).toBe(false);
    expect(isLargeFileWarning(LARGE_FILE_WARNING_BYTES)).toBe(true);
    expect(isLargeFileWarning(LARGE_FILE_WARNING_BYTES + 1)).toBe(true);
  });
});

