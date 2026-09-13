import * as Encoding from "encoding-japanese";
import { describe, expect, it } from "vitest";
import * as current from "./csv-utils";
import {
  buildXlsxBuffer,
  canEncodeToShiftJis,
  checkXlsxLimits,
  countCsvInjectionValues,
  decodeCsvBytes,
  detectCsvEncoding,
  diagnoseExcelRisks,
  encodeCsvText,
  encodeToShiftJis,
  excelOrientedCsvPreset,
  findSjisUnmappableChars,
  findSjisUnmappableInRecords,
  hasMixedLineEndings,
  detectCsvEncodingDetails,
  encodeUtf16,
  excelCellToText,
  formatExcelDate,
  applyPreviewEdits,
  splitPreviewRecords,
  PREVIEW_ROW_LIMIT,
  inspectCsv,
  inspectRecordSeparators,
  isCsvInjectionValue,
  isDateLikeRisk,
  isLeadingZeroRisk,
  isLongIntegerRisk,
  isScientificRisk,
  describeExcelRisks,
  describeExcelRiskChange,
  describeExcelRiskEffects,
  locateReplacementCharacters,
  parseCsvTable,
  rowsToCsv,
  serializeCsv,
  utf8CsvPreset,
  type ViewerSettings,
} from "./csv-utils-beta";

const defaultSettings: ViewerSettings = {
  delimiter: "auto",
  quote: '"',
  escapeMode: "double",
  trimFields: false,
  skipEmptyLines: true,
  headerRow: 1,
  dataStartRow: 2,
};

function parseRecordsCurrent(input: string, settings: ViewerSettings = defaultSettings) {
  const inspection = current.inspectCsv(input, settings);
  const headers = inspection.rows[settings.headerRow - 1];
  if (!headers?.length || headers.every((header) => !header.trim())) {
    return {
      records: [] as Record<string, string>[],
      error: "指定したヘッダー行にフィールドがありません。",
      inspection,
      warnings: inspection.warnings,
    };
  }
  const normalizedHeaders = headers.map((header, index) => header.trim() || `column_${index + 1}`);
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    return {
      records: [] as Record<string, string>[],
      error: "ヘッダー名が重複しています。",
      inspection,
      warnings: inspection.warnings,
    };
  }
  const rows = inspection.rows.slice(Math.max(settings.dataStartRow - 1, settings.headerRow));
  const formulaCells = rows.flat().filter((value) => /^[=+@]|^-(?!\d)/.test(value.trim())).length;
  const warnings = [...inspection.warnings];
  if (headers.some((header) => !header.trim())) warnings.push("空のヘッダー名をcolumn_Nへ補完しました。");
  if (formulaCells) warnings.push(`表計算ソフトで数式として実行され得る値が${formulaCells}件あります。`);
  return {
    records: rows.map((row) =>
      Object.fromEntries(normalizedHeaders.map((header, index) => [header, row[index] ?? ""])),
    ),
    error: "",
    inspection,
    warnings,
  };
}

function cellMatrix(records: Array<Record<string, unknown>>, columns: string[]) {
  return records.map((record) => columns.map((column) => String(record[column] ?? "")));
}

function encodeSjis(text: string) {
  return Uint8Array.from(Encoding.convert(Encoding.stringToCode(text), {
    from: "UNICODE",
    to: "SJIS",
    type: "array",
  }) as number[]);
}

describe("Current vs Beta: unchanged cases stay identical", () => {
  const fixtures = [
    { name: "UTF-8 no BOM LF comma", text: "id,name\n1,DevSmith\n2,開発" },
    { name: "UTF-8 BOM CRLF", text: "\uFEFFid,name\r\n1,DevSmith" },
    { name: "tab separated", text: "id\tname\n1\tDevSmith" },
    { name: "semicolon", text: "id;name\n1;DevSmith" },
    { name: "pipe", text: "id|name\n1|DevSmith" },
    { name: "delimiter inside quote", text: 'id,name\n1,"a,b,c"' },
    { name: "newline inside quote", text: 'id,memo\n1,"line1\nline2"\n2,"normal"' },
    { name: "escaped double quote", text: 'id,note\n1,"彼は""確認済み""と回答"' },
    { name: "trailing empty field", text: "id,name,note\n1,DevSmith," },
    { name: "empty row skipped", text: "id,name\n1,DevSmith\n\n2,API" },
    { name: "NUL character", text: "id,name\n1,Dev\0Smith" },
    { name: "quoted formula with comma", text: 'id,note\n1,"=SUM(1,2)"' },
  ];

  it.each(fixtures)("$name: row/column/cell/header/CSV output match", ({ text }) => {
    const currentInspect = current.inspectCsv(text);
    const betaInspect = inspectCsv(text);
    expect(betaInspect.rows).toEqual(currentInspect.rows);
    expect(betaInspect.delimiter).toBe(currentInspect.delimiter);
    expect(betaInspect.lineEnding).toBe(currentInspect.lineEnding);
    expect(betaInspect.hasBom).toBe(currentInspect.hasBom);
    expect(betaInspect.unclosedQuote).toBe(currentInspect.unclosedQuote);

    const currentParsed = parseRecordsCurrent(text);
    const betaParsed = parseCsvTable(text, defaultSettings);
    expect(betaParsed.error).toBe(currentParsed.error);
    expect(betaParsed.records.length).toBe(currentParsed.records.length);
    expect(betaParsed.columns.length).toBe(Object.keys(currentParsed.records[0] ?? {}).length || betaParsed.columns.length);

    const currentColumns = Object.keys(currentParsed.records[0] ?? {});
    expect(cellMatrix(betaParsed.records, betaParsed.columns)).toEqual(
      cellMatrix(currentParsed.records, currentColumns),
    );
    expect(betaParsed.headerValues).toEqual(currentInspect.rows[0]);

    const currentCsv = current.serializeCsv(currentParsed.records, currentColumns, {
      delimiter: currentInspect.delimiter,
      lineEnding: currentInspect.lineEnding === "CRLF" ? "\r\n" : currentInspect.lineEnding === "CR" ? "\r" : "\n",
    });
    const betaCsv = serializeCsv(betaParsed.records, betaParsed.columns, {
      delimiter: betaInspect.delimiter,
      lineEnding: betaInspect.lineEnding === "CRLF" ? "\r\n" : betaInspect.lineEnding === "CR" ? "\r" : "\n",
      headerLabels: betaParsed.headerValues,
    });
    expect(betaCsv).toBe(currentCsv);
  });

  it("UTF-8 encode/decode matches current", () => {
    const source = "id,name\n1,開発";
    const currentBytes = current.encodeCsvText(source, "utf-8", true);
    const betaBytes = encodeCsvText(source, "utf-8", true).bytes;
    expect(Array.from(betaBytes)).toEqual(Array.from(currentBytes));
    expect(decodeCsvBytes(betaBytes, "auto")).toMatchObject({
      text: source,
      encoding: "utf-8",
      hasBom: true,
      replacementCount: 0,
    });
  });

  it("Shift_JIS round-trip for representable text matches current", () => {
    const source = "id,name\r\n1,開発";
    const currentBytes = current.encodeCsvText(source, "shift_jis", false);
    const betaBytes = encodeCsvText(source, "shift_jis", false).bytes;
    expect(Array.from(betaBytes)).toEqual(Array.from(currentBytes));
    expect(decodeCsvBytes(betaBytes, "auto")).toMatchObject({
      text: source,
      encoding: "shift_jis",
      hasBom: false,
    });
  });
});

describe("Intentional Beta differences", () => {
  it("opens duplicate headers instead of failing", () => {
    const csv = "code,name,code,name\nA,山田,B,佐藤";
    const currentParsed = parseRecordsCurrent(csv);
    const betaParsed = parseCsvTable(csv, defaultSettings);
    expect(currentParsed.error).toBe("ヘッダー名が重複しています。");
    expect(currentParsed.records).toEqual([]);
    expect(betaParsed.error).toBe("");
    expect(betaParsed.records).toHaveLength(1);
    expect(betaParsed.headerValues).toEqual(["code", "name", "code", "name"]);
    expect(betaParsed.columns).toEqual(["col_0", "col_1", "col_2", "col_3"]);
    expect(serializeCsv(betaParsed.records, betaParsed.columns, {
      headerLabels: betaParsed.headerValues,
    })).toBe(csv);
  });

  it("keeps empty headers instead of rewriting to column_N", () => {
    const csv = "id,,note\n1,x,y";
    const currentParsed = parseRecordsCurrent(csv);
    const betaParsed = parseCsvTable(csv, defaultSettings);
    expect(Object.keys(currentParsed.records[0] ?? {})).toEqual(["id", "column_2", "note"]);
    expect(betaParsed.headerValues).toEqual(["id", "", "note"]);
    expect(betaParsed.headerLabels[1]).toBe("(空列1)");
    expect(serializeCsv(betaParsed.records, betaParsed.columns, {
      headerLabels: betaParsed.headerValues,
    })).toBe(csv);
  });

  it("does not use space as Simple auto-detect delimiter", () => {
    const csv = "id name team\n1 DevSmith Platform";
    expect(current.inspectCsv(csv).delimiter).toBe(" ");
    expect(inspectCsv(csv).delimiter).toBe(",");
    expect(inspectCsv(csv, { delimiter: " " }).delimiter).toBe(" ");
  });

  it("keeps extra fields when an unquoted formula contains a comma", () => {
    const csv = "id,note\n1,=SUM(1,2)";
    const currentParsed = parseRecordsCurrent(csv);
    const betaParsed = parseCsvTable(csv, defaultSettings);
    expect(Object.keys(currentParsed.records[0] ?? {})).toHaveLength(2);
    expect(currentParsed.records[0]?.note).toBe("=SUM(1");
    expect(betaParsed.columns).toHaveLength(3);
    expect(betaParsed.records[0].col_1).toBe("=SUM(1");
    expect(betaParsed.records[0].col_2).toBe("2)");
    expect(betaParsed.warnings.some((warning) => warning.includes("ヘッダーより多い列"))).toBe(true);
  });

  it("stops Shift_JIS conversion instead of silently replacing", () => {
    const text = "name,note\n1,😀";
    const currentBytes = current.encodeCsvText(text, "shift_jis", false);
    const currentDecoded = new TextDecoder("shift_jis").decode(currentBytes);
    expect(currentDecoded).toContain("&#");
    const blocked = encodeCsvText(text, "shift_jis", false);
    expect(blocked.bytes.length).toBe(0);
    expect(blocked.unmappable.some((item) => item.char === "😀")).toBe(true);
    const replaced = encodeCsvText(text, "shift_jis", false, { replaceUnmappable: true });
    expect(Array.from(replaced.bytes)).toEqual(Array.from(currentBytes));
  });
});

describe("P0 Excel conversion risks", () => {
  it("detects leading zeros without flagging 0 or 0.5", () => {
    expect(isLeadingZeroRisk("00123")).toBe(true);
    expect(isLeadingZeroRisk("0000012345")).toBe(true);
    expect(isLeadingZeroRisk("0")).toBe(false);
    expect(isLeadingZeroRisk("0.5")).toBe(false);
    expect(isLeadingZeroRisk("-01")).toBe(true);
    expect(isLeadingZeroRisk("+01")).toBe(true);
    expect(isLeadingZeroRisk("01.50")).toBe(true);
    expect(isLeadingZeroRisk("00.5")).toBe(true);
  });

  it("detects long integers, conservative dates, and scientific values", () => {
    expect(isLongIntegerRisk("1234567890123456")).toBe(true);
    expect(isLongIntegerRisk("123456789012345")).toBe(false);
    expect(isDateLikeRisk("2026-09-11")).toBe(true);
    expect(isDateLikeRisk("9/11/2026")).toBe(true);
    expect(isDateLikeRisk("2026")).toBe(false);
    expect(isDateLikeRisk("00123")).toBe(false);
    expect(isScientificRisk("1E10")).toBe(true);
    expect(isScientificRisk("1.2e-3")).toBe(true);
    expect(isScientificRisk("+1E10")).toBe(true);
    expect(isScientificRisk("12")).toBe(false);
  });

  it("summarizes risk counts from records", () => {
    const parsed = parseCsvTable("id,value\n1,00123\n2,123456789012345678\n3,2026-09-11\n4,1E10\n5,0\n6,0.5", defaultSettings);
    const hits = diagnoseExcelRisks(parsed.records, parsed.columns);
    expect(hits.filter((hit) => hit.kind === "leadingZero")).toHaveLength(1);
    expect(hits.filter((hit) => hit.kind === "longInteger")).toHaveLength(1);
    expect(hits.filter((hit) => hit.kind === "dateLike")).toHaveLength(1);
    expect(hits.filter((hit) => hit.kind === "scientific")).toHaveLength(1);
    expect(describeExcelRisks(hits)).toBe("先頭ゼロ 1件 · 16桁以上の整数 1件 · 日付変換候補 1件 · 指数表記 1件");
    expect(describeExcelRiskChange("leadingZero", "00123")).toContain("00123 → 123");
    expect(describeExcelRiskChange("longInteger", "123456789012345678")).toContain("下位桁が丸められる");
    expect(describeExcelRiskChange("dateLike", "2026-09-11")).toContain("日付");
    expect(describeExcelRiskChange("scientific", "1E10")).toContain("10000000000");
    expect(describeExcelRiskEffects(hits)).toContain("先頭の0が消える");
  });
});

describe("P0/P1 formula injection warnings", () => {
  it("warns for = + - @ TAB CR LF and full-width variants without sanitizing", () => {
    const values = ["=1+1", "+cmd", "-abc", "@external", "\t=1", "\n=1", "＝SUM", "＋cmd", "－abc", "＠ext", "*cmd"];
    values.forEach((value) => expect(isCsvInjectionValue(value)).toBe(true));
    expect(isCsvInjectionValue("-12")).toBe(false);
    expect(isCsvInjectionValue("plain")).toBe(false);
    const parsed = parseCsvTable("id,note\n1,=1+1\n2,plain", defaultSettings);
    expect(parsed.records[0].col_1).toBe("=1+1");
    expect(countCsvInjectionValues(parsed.records, parsed.columns)).toBe(1);
  });
});

describe("P1 decode, line endings, and XLSX limits", () => {
  it("treats quoted newlines as one logical row", () => {
    const csv = 'id,memo\n1,"line1\nline2"\n2,"normal"';
    expect(inspectCsv(csv).rows).toHaveLength(3);
    expect(parseCsvTable(csv, defaultSettings).records).toHaveLength(2);
  });

  it("detects mixed line endings only outside quotes", () => {
    const mixed = "id,name\r\n1,A\n2,B";
    expect(hasMixedLineEndings(mixed)).toBe(true);
    expect(inspectCsv(mixed).warnings.some((warning) => warning.includes("混在"))).toBe(true);
    expect(inspectCsv("id,name\n1,A\n2,B").mixedLineEndings).toBe(false);
    expect(hasMixedLineEndings("id,memo\r\n1,\"line1\nline2\"\r\n2,\"normal\"\r\n")).toBe(false);
    expect(inspectRecordSeparators("id,memo\r\n1,\"line1\nline2\"\r\n2,\"normal\"\r\n").primary).toBe("CRLF");
    expect(hasMixedLineEndings("id,memo\n1,\"line1\r\nline2\"\n2,\"normal\"\n")).toBe(false);
    expect(inspectRecordSeparators("id,memo\n1,\"line1\r\nline2\"\n2,\"normal\"\n").primary).toBe("LF");
    expect(hasMixedLineEndings("id,memo\r1,\"line1\nline2\"\r2,\"normal\"\r")).toBe(false);
    expect(inspectRecordSeparators("id,memo\r1,\"line1\nline2\"\r2,\"normal\"\r").primary).toBe("CR");
  });

  it("reports replacement characters after invalid decode", () => {
    const bytes = Uint8Array.from([0x61, 0x2c, 0x62, 0x0a, 0x31, 0x2c, 0x80]);
    const decoded = decodeCsvBytes(bytes, "utf-8");
    expect(decoded.replacementCount).toBeGreaterThan(0);
    const parsed = parseCsvTable(decoded.text, defaultSettings);
    expect(locateReplacementCharacters(parsed.records, parsed.columns).length).toBeGreaterThan(0);
  });

  it("blocks XLSX that exceeds Excel limits", () => {
    expect(checkXlsxLimits([{ col: "a".repeat(32_768) }], ["col"])[0]).toContain("1セル上限");
    expect(checkXlsxLimits([], Array.from({ length: 16_385 }, (_, index) => `c${index}`))[0]).toContain("列数上限");
  });

  it("keeps XLSX values as strings for leading zeros, long ints, and formulas", async () => {
    const records = [
      { col_0: "00123", col_1: "123456789012345678", col_2: "=1+1" },
    ];
    const columns = ["col_0", "col_1", "col_2"];
    const bytes = await buildXlsxBuffer(records, columns, ["zip", "account", "formula"]);
    const excelJsModule = await import("exceljs");
    const workbook = new excelJsModule.default.Workbook();
    await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    expect([sheet.getCell(1, 1).value, sheet.getCell(1, 2).value, sheet.getCell(1, 3).value]).toEqual(["zip", "account", "formula"]);
    expect([sheet.getCell(2, 1).value, sheet.getCell(2, 2).value, sheet.getCell(2, 3).value]).toEqual(["00123", "123456789012345678", "=1+1"]);
    expect(String(sheet.getCell(2, 1).value)).toBe("00123");
    expect(String(sheet.getCell(2, 3).value)).toBe("=1+1");
  });
});

describe("P2 fixtures and encoding-japanese 2.3.0", () => {
  it("verifies UTF-8 BOM, UTF-16LE BOM, and CP932 fixture bytes", () => {
    const utf8 = "id,name\n1,開発";
    const utf8Bytes = encodeCsvText(utf8, "utf-8", false).bytes;
    const utf8Bom = encodeCsvText(utf8, "utf-8", true).bytes;
    expect(detectCsvEncoding(utf8Bytes)).toBe("utf-8");
    expect(utf8Bom[0]).toBe(0xef);
    expect(decodeCsvBytes(utf8Bom, "auto").hasBom).toBe(true);

    const utf16 = new Uint8Array([0xff, 0xfe, ...new Uint8Array(Buffer.from("id,name\n1,開発", "utf16le"))]);
    expect(detectCsvEncoding(utf16)).toBe("utf-16le");
    expect(decodeCsvBytes(utf16, "auto")).toMatchObject({
      encoding: "utf-16le",
      hasBom: true,
      text: "id,name\n1,開発",
    });

    const sjisText = "id,name\r\n1,開発";
    const sjisBytes = encodeSjis(sjisText);
    expect(detectCsvEncoding(sjisBytes)).toBe("shift_jis");
    expect(decodeCsvBytes(sjisBytes, "auto").text).toBe(sjisText);
  });

  it("round-trips CP932 extension characters through encoding-japanese SJIS", () => {
    const sample = "①㈱髙﨑ｱｲｳ";
    expect(canEncodeToShiftJis(sample)).toBe(true);
    const bytes = encodeToShiftJis(sample).bytes;
    const decoded = new TextDecoder("shift_jis").decode(bytes);
    expect(decoded).toBe(sample);
    expect(findSjisUnmappableChars(sample)).toEqual([]);
  });

  it("marks emoji and rare kanji as Shift_JIS unmappable", () => {
    expect(findSjisUnmappableChars("😀𠮷").map((item) => item.char)).toEqual(["😀", "𠮷"]);
    const parsed = parseCsvTable("name,company\n😀,𠮷田商事", defaultSettings);
    const hits = findSjisUnmappableInRecords(parsed.records, parsed.columns);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ row: 1, char: "😀" });
  });

  it("covers remaining practical fixtures", () => {
    expect(inspectCsv("id,name\r1,CR").lineEnding).toBe("CR");
    expect(inspectCsv("id,name\r\n1,A\n2,B").mixedLineEndings).toBe(true);
    expect(inspectCsv("sep=;\nid;name\n1;A").separatorDirective).toBe("sep=;");
    expect(inspectCsv("id,name\n1,DevSmith").separatorDirective).toBeNull();
    expect(utf8CsvPreset).toMatchObject({ encoding: "utf-8", includeBom: false, lineEnding: "\n" });
    expect(excelOrientedCsvPreset).toMatchObject({ encoding: "utf-8", includeBom: true, lineEnding: "\r\n", quoteAll: true });
    expect(excelCellToText(12)).toBe("12");
    expect(excelCellToText(null)).toBe("");
    expect(excelCellToText({ formula: "A1+1", result: 3 })).toBe("3");
    expect(excelCellToText({ text: "abc" })).toBe("abc");
    expect(rowsToCsv([["a", "b"], ["1", "2"]])).toBe("a,b\n1,2");
  });

  it("keeps encoding-japanese at 2.3.0, the current latest", async () => {
    const pkg = await import("encoding-japanese/package.json");
    expect(pkg.version).toBe("2.3.0");
  });

  it("builds a multi-sheet XLSX fixture and reads each sheet independently", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const first = workbook.addWorksheet("社員");
    first.addRow(["id", "name"]);
    first.addRow([1, "山田"]);
    const second = workbook.addWorksheet("明細");
    second.addRow(["id", "amount"]);
    second.addRow(["001", "1E10"]);
    const buffer = await workbook.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    expect(loaded.worksheets.map((sheet) => sheet.name)).toEqual(["社員", "明細"]);
    const sheets = loaded.worksheets.map((worksheet) => {
      const rows: string[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows.push(values.map(excelCellToText));
      });
      return { name: worksheet.name, csv: rowsToCsv(rows) };
    });
    expect(sheets[0].csv).toContain("山田");
    expect(sheets[1].csv).toContain("001");
    expect(sheets[1].csv).not.toContain("山田");
  });

  it("does not commit a 100MB fixture; a generated large CSV still parses", () => {
    const header = "id,name,note";
    const rows = Array.from({ length: 20_000 }, (_, index) => `${index},name-${index},note-${index}`);
    const csv = [header, ...rows].join("\n");
    expect(csv.length).toBeGreaterThan(400_000);
    const parsed = parseCsvTable(csv, defaultSettings);
    expect(parsed.records).toHaveLength(20_000);
    expect(parsed.columns).toHaveLength(3);
  });
});

describe("UTF-16 encode/decode and safe detection", () => {
  it("writes UTF-16LE/BE BOM and surrogate pairs at byte level", () => {
    const le = encodeUtf16("ABC東京都髙①😀𠮷", true, true);
    const be = encodeUtf16("ABC東京都髙①😀𠮷", false, true);
    expect(Array.from(le.slice(0, 2))).toEqual([0xff, 0xfe]);
    expect(Array.from(be.slice(0, 2))).toEqual([0xfe, 0xff]);
    expect(new TextDecoder("utf-16le").decode(le)).toBe("ABC東京都髙①😀𠮷");
    expect(new TextDecoder("utf-16be").decode(be)).toBe("ABC東京都髙①😀𠮷");
    expect(encodeCsvText("LF\nCRLF\r\nCR\r", "utf-16le", true).bytes[0]).toBe(0xff);
    expect(encodeCsvText("ABC", "utf-16be", false).bytes[0]).toBe(0x00);
    expect(encodeCsvText("ABC", "utf-16be", false).bytes[1]).toBe(0x41);
  });

  it("round-trips UTF-16LE/BE with and without BOM", () => {
    const source = "id,name\r\n1,東京都\r\n2,😀";
    for (const encoding of ["utf-16le", "utf-16be"] as const) {
      for (const bom of [true, false]) {
        const bytes = encodeCsvText(source, encoding, bom).bytes;
        const decoded = decodeCsvBytes(bytes, encoding);
        expect(decoded.text).toBe(source);
        expect(decoded.hasBom).toBe(bom);
      }
    }
  });

  it("does not treat failed UTF-8 as Shift_JIS", () => {
    const invalid = Uint8Array.from([0x80, 0x81, 0x82, 0x00, 0xff]);
    expect(detectCsvEncoding(invalid)).toBe("unknown");
    expect(decodeCsvBytes(invalid, "auto").encoding).toBe("unknown");
  });

  it("keeps ASCII-only as UTF-8 compatible rather than Shift_JIS", () => {
    const details = detectCsvEncodingDetails(new TextEncoder().encode("id,name\n1,Taro"));
    expect(details.encoding).toBe("utf-8");
    expect(details.asciiCompatible).toBe(true);
  });

  it("detects no-BOM UTF-16 only when the NUL pattern is confident", () => {
    const le = encodeUtf16("id,name\n1,Taro", true, false);
    const be = encodeUtf16("id,name\n1,Taro", false, false);
    expect(detectCsvEncoding(le)).toBe("utf-16le");
    expect(detectCsvEncoding(be)).toBe("utf-16be");
  });

  it("does not force Japanese no-BOM UTF-16 to Shift_JIS", () => {
    const le = encodeUtf16("id,name\n1,東京都", true, false);
    const be = encodeUtf16("id,name\n1,東京都", false, false);
    expect(detectCsvEncoding(le)).toBe("unknown");
    expect(detectCsvEncoding(be)).toBe("unknown");
    expect(decodeCsvBytes(le, "utf-16le").text).toBe("id,name\n1,東京都");
    expect(decodeCsvBytes(be, "utf-16be").text).toBe("id,name\n1,東京都");
  });
});

describe("preview export must keep hidden rows", () => {
  it("merges preview edits without dropping hidden records", () => {
    const all = Array.from({ length: PREVIEW_ROW_LIMIT + 5 }, (_, index) => ({ col_0: String(index) }));
    const split = splitPreviewRecords(all);
    expect(split.visible).toHaveLength(PREVIEW_ROW_LIMIT);
    expect(split.hidden).toHaveLength(5);
    split.visible[0] = { col_0: "edited" };
    const merged = applyPreviewEdits(split.hidden, split.visible);
    expect(merged).toHaveLength(PREVIEW_ROW_LIMIT + 5);
    expect(merged[0].col_0).toBe("edited");
    expect(merged[PREVIEW_ROW_LIMIT].col_0).toBe(String(PREVIEW_ROW_LIMIT));
    expect(serializeCsv(merged, ["col_0"], { includeHeader: false }).split("\n").filter(Boolean)).toHaveLength(PREVIEW_ROW_LIMIT + 5);
  });
});

describe("Current vs Beta: quote-aware line endings", () => {
  it("does not let quoted LF change the record separator the way current includes() does", () => {
    const csv = "id,memo\r1,\"line1\nline2\"\r2,normal\r";
    expect(current.inspectCsv(csv).lineEnding).toBe("LF");
    expect(inspectCsv(csv).lineEnding).toBe("CR");
    expect(inspectCsv(csv).mixedLineEndings).toBe(false);
  });
});

describe("Excel date import uses UTC date-only text", () => {
  it("keeps midnight UTC as YYYY-MM-DD", () => {
    expect(formatExcelDate(new Date(Date.UTC(2026, 8, 12)))).toBe("2026-09-12");
    expect(excelCellToText(new Date(Date.UTC(2026, 8, 12, 15, 0, 0)))).toBe(new Date(Date.UTC(2026, 8, 12, 15, 0, 0)).toISOString());
  });
});

