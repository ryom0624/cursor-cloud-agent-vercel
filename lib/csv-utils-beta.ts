import * as Encoding from "encoding-japanese";

export type CsvDelimiter = "," | "\t" | ";" | "|" | " ";
export type CsvDelimiterSetting = CsvDelimiter | "auto";
export type CsvQuote = '"' | "'" | "";
export type CsvDetectedEncoding = "utf-8" | "shift_jis" | "utf-16le" | "utf-16be" | "unknown";
export type CsvFileEncoding = "auto" | Exclude<CsvDetectedEncoding, "unknown">;
export type CsvOutputEncoding = "utf-8" | "shift_jis" | "utf-16le" | "utf-16be";
export type CsvLineEnding = "\n" | "\r\n" | "\r";
export type CsvEscapeMode = "double" | "backslash";
export type CsvParseOptions = {
  delimiter?: CsvDelimiterSetting;
  quote?: CsvQuote;
  escapeMode?: CsvEscapeMode;
  trimFields?: boolean;
  skipEmptyLines?: boolean;
};

export type CsvInspection = {
  rows: string[][];
  delimiter: CsvDelimiter;
  lineEnding: "CRLF" | "LF" | "CR" | "なし";
  hasBom: boolean;
  unclosedQuote: boolean;
  mixedLineEndings: boolean;
  separatorDirective: string | null;
  warnings: string[];
};

export const XLSX_MAX_ROWS = 1_048_576;
export const XLSX_MAX_COLS = 16_384;
export const XLSX_MAX_CELL_CHARS = 32_767;
export const LARGE_FILE_WARNING_BYTES = 10 * 1024 * 1024;
export const PREVIEW_ROW_LIMIT = 10_000;
export const VALIDATION_CELL_LIMIT = 80_000;

export function cellCount(records: Array<Record<string, unknown>>, columns: string[]) {
  return records.length * columns.length;
}

const autoDelimiterCandidates: CsvDelimiter[] = [",", "\t", ";", "|"];

function parseWithDelimiter(
  input: string,
  delimiter: CsvDelimiter,
  quote: CsvQuote,
  escapeMode: CsvEscapeMode,
  trimFields: boolean,
  skipEmptyLines: boolean,
) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let fieldWasQuoted = false;

  const pushField = () => {
    row.push(trimFields && !fieldWasQuoted ? field.trim() : field);
    field = "";
    fieldWasQuoted = false;
  };
  const pushRow = () => {
    pushField();
    if (!skipEmptyLines || row.some((value) => value.length > 0)) rows.push(row);
    row = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (quote && escapeMode === "backslash" && quoted && char === "\\" && next === quote) {
      field += quote;
      index += 1;
    } else if (quote && escapeMode === "double" && char === quote && quoted && next === quote) {
      field += quote;
      index += 1;
    } else if (quote && char === quote) {
      fieldWasQuoted = true;
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      pushField();
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      pushRow();
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) pushRow();
  return { rows, unclosedQuote: quoted };
}

function detectDelimiter(input: string, quote: CsvQuote, escapeMode: CsvEscapeMode): CsvDelimiter {
  let best: { delimiter: CsvDelimiter; score: number } = { delimiter: ",", score: -1 };
  for (const delimiter of autoDelimiterCandidates) {
    const { rows } = parseWithDelimiter(input, delimiter, quote, escapeMode, false, true);
    const widths = rows.slice(0, 20).map((row) => row.length);
    const multiColumn = widths.filter((width) => width > 1);
    if (!multiColumn.length) continue;
    const frequencies = new Map<number, number>();
    multiColumn.forEach((width) => frequencies.set(width, (frequencies.get(width) ?? 0) + 1));
    const consistency = Math.max(...frequencies.values());
    const score = consistency * 100 + Math.max(...multiColumn);
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

export function inspectRecordSeparators(
  input: string,
  quote: CsvQuote = '"',
  escapeMode: CsvEscapeMode = "double",
) {
  let crlf = 0;
  let lf = 0;
  let cr = 0;
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quote && escapeMode === "backslash" && quoted && char === "\\" && next === quote) {
      index += 1;
    } else if (quote && escapeMode === "double" && char === quote && quoted && next === quote) {
      index += 1;
    } else if (quote && char === quote) {
      quoted = !quoted;
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        crlf += 1;
        index += 1;
      } else if (char === "\n") {
        lf += 1;
      } else {
        cr += 1;
      }
    }
  }
  const kinds = [
    crlf > 0 ? "CRLF" : null,
    lf > 0 ? "LF" : null,
    cr > 0 ? "CR" : null,
  ].filter(Boolean) as Array<"CRLF" | "LF" | "CR">;
  const primary: CsvInspection["lineEnding"] = crlf
    ? "CRLF"
    : lf
      ? "LF"
      : cr
        ? "CR"
        : "なし";
  return { crlf, lf, cr, primary, mixed: kinds.length > 1 };
}

function inspectLineEnding(input: string, quote: CsvQuote = '"', escapeMode: CsvEscapeMode = "double"): CsvInspection["lineEnding"] {
  return inspectRecordSeparators(input, quote, escapeMode).primary;
}

export function hasMixedLineEndings(input: string, quote: CsvQuote = '"', escapeMode: CsvEscapeMode = "double") {
  return inspectRecordSeparators(input, quote, escapeMode).mixed;
}

function detectSeparatorDirective(input: string) {
  const firstLine = input.split(/\r\n|\r|\n/, 1)[0] ?? "";
  const matched = firstLine.trim().match(/^sep=(.+)$/i);
  return matched ? firstLine.trim() : null;
}

export function inspectCsv(input: string, options: CsvParseOptions = {}): CsvInspection {
  const hasBom = input.startsWith("\uFEFF");
  const normalized = hasBom ? input.slice(1) : input;
  const quote = options.quote ?? '"';
  const escapeMode = options.escapeMode ?? "double";
  const delimiter = options.delimiter && options.delimiter !== "auto"
    ? options.delimiter
    : detectDelimiter(normalized, quote, escapeMode);
  const result = parseWithDelimiter(
    normalized,
    delimiter,
    quote,
    escapeMode,
    options.trimFields ?? false,
    options.skipEmptyLines ?? true,
  );
  const warnings: string[] = [];
  const expectedWidth = result.rows[0]?.length ?? 0;
  const unevenRows = result.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.length !== expectedWidth);
  const mixedLineEndings = hasMixedLineEndings(normalized, quote, escapeMode);
  const separatorDirective = detectSeparatorDirective(normalized);
  if (result.unclosedQuote) warnings.push("囲み文字が閉じられていません。");
  if (unevenRows.length) {
    warnings.push(`列数が揃っていない行があります（${unevenRows.slice(0, 5).map(({ index }) => index + 1).join(", ")}行目）。`);
  }
  if (normalized.includes("\0")) warnings.push("NUL文字が含まれています。");
  if (mixedLineEndings) warnings.push("改行コードが混在しています。");
  if (separatorDirective) warnings.push(`separator directiveを検出しました（${separatorDirective}）。除去はしていません。`);
  return {
    ...result,
    delimiter,
    lineEnding: inspectLineEnding(normalized, quote, escapeMode),
    hasBom,
    mixedLineEndings,
    separatorDirective,
    warnings,
  };
}

export function parseCsv(input: string, options: CsvParseOptions = {}): string[][] {
  return inspectCsv(input, options).rows;
}

export type EncodingDetection = {
  encoding: CsvDetectedEncoding;
  hasBom: boolean;
  asciiCompatible: boolean;
  duplicateBom: boolean;
  confidence: "bom" | "heuristic" | "fallback" | "unknown";
  warnings: string[];
};

function isUtf8Bom(bytes: Uint8Array, offset = 0) {
  return bytes[offset] === 0xef && bytes[offset + 1] === 0xbb && bytes[offset + 2] === 0xbf;
}

function isUtf16LeBom(bytes: Uint8Array, offset = 0) {
  return bytes[offset] === 0xff && bytes[offset + 1] === 0xfe;
}

function isUtf16BeBom(bytes: Uint8Array, offset = 0) {
  return bytes[offset] === 0xfe && bytes[offset + 1] === 0xff;
}

function isAsciiBytes(bytes: Uint8Array) {
  return bytes.every((value) => value < 0x80);
}

function looksLikeIso2022Jp(bytes: Uint8Array) {
  for (let index = 0; index < bytes.length - 2; index += 1) {
    if (bytes[index] !== 0x1b) continue;
    const next = bytes[index + 1];
    const third = bytes[index + 2];
    if (next === 0x24 && (third === 0x42 || third === 0x40 || third === 0x28)) return true;
    if (next === 0x28 && (third === 0x4a || third === 0x42 || third === 0x49)) return true;
  }
  return false;
}

function looksLikeConfidentUtf16(bytes: Uint8Array, littleEndian: boolean) {
  if (bytes.length < 8 || bytes.length % 2 !== 0) return false;
  let highZero = 0;
  const units = bytes.length / 2;
  for (let index = 0; index < bytes.length; index += 2) {
    const high = littleEndian ? bytes[index + 1] : bytes[index];
    if (high === 0) highZero += 1;
  }
  if (highZero / units < 0.85) return false;
  const decoded = new TextDecoder(littleEndian ? "utf-16le" : "utf-16be", { fatal: false }).decode(bytes);
  if (decoded.includes("\uFFFD")) return false;
  return /[,;\t|a-zA-Z0-9\n\r]/.test(decoded);
}

function looksLikeValidShiftJis(bytes: Uint8Array) {
  const detected = Encoding.detect(Array.from(bytes));
  if (
    detected === "EUCJP"
    || detected === "JIS"
    || detected === "UNICODE"
    || detected === "UTF16"
    || detected === "UTF32"
    || detected === "BINARY"
  ) return false;
  if (bytes.some((value, index) => value === 0x1b && bytes[index + 1] === 0x24)) return false;
  const decoded = new TextDecoder("shift_jis", { fatal: false }).decode(bytes);
  const chars = [...decoded];
  if (!chars.length) return false;
  const replacements = chars.filter((char) => char === "\uFFFD").length;
  if (replacements / chars.length > 0.01) return false;
  const badControls = chars.filter((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 32 && char !== "\t" && char !== "\n" && char !== "\r";
  }).length;
  if (badControls > 2) return false;
  const hasJapanese = /[\u3040-\u30FF\u4E00-\u9FFF\uFF61-\uFF9F]/.test(decoded);
  return detected === "SJIS" || (hasJapanese && replacements === 0);
}

export function detectCsvEncodingDetails(bytes: Uint8Array): EncodingDetection {
  const warnings: string[] = [];
  if (!bytes.length) {
    return { encoding: "unknown", hasBom: false, asciiCompatible: true, duplicateBom: false, confidence: "unknown", warnings };
  }
  if (isUtf8Bom(bytes)) {
    const duplicateBom = isUtf8Bom(bytes, 3);
    if (duplicateBom) warnings.push("UTF-8 BOMが重複しています。先頭のBOMのみ解釈しました。");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      warnings.push("UTF-8 BOMがありますが、デコード結果に不正なbyteがあります。");
    }
    return { encoding: "utf-8", hasBom: true, asciiCompatible: false, duplicateBom, confidence: "bom", warnings };
  }
  if (isUtf16LeBom(bytes)) {
    const duplicateBom = isUtf16LeBom(bytes, 2);
    if (duplicateBom) warnings.push("UTF-16LE BOMが重複しています。先頭のBOMのみ解釈しました。");
    const decoded = new TextDecoder("utf-16le", { fatal: false }).decode(bytes);
    if (decoded.includes("\uFFFD")) warnings.push("UTF-16LE BOMがありますが、デコードできない箇所があります。");
    return { encoding: "utf-16le", hasBom: true, asciiCompatible: false, duplicateBom, confidence: "bom", warnings };
  }
  if (isUtf16BeBom(bytes)) {
    const duplicateBom = isUtf16BeBom(bytes, 2);
    if (duplicateBom) warnings.push("UTF-16BE BOMが重複しています。先頭のBOMのみ解釈しました。");
    const decoded = new TextDecoder("utf-16be", { fatal: false }).decode(bytes);
    if (decoded.includes("\uFFFD")) warnings.push("UTF-16BE BOMがありますが、デコードできない箇所があります。");
    return { encoding: "utf-16be", hasBom: true, asciiCompatible: false, duplicateBom, confidence: "bom", warnings };
  }
  if (looksLikeConfidentUtf16(bytes, true)) {
    return { encoding: "utf-16le", hasBom: false, asciiCompatible: false, duplicateBom: false, confidence: "heuristic", warnings };
  }
  if (looksLikeConfidentUtf16(bytes, false)) {
    return { encoding: "utf-16be", hasBom: false, asciiCompatible: false, duplicateBom: false, confidence: "heuristic", warnings };
  }
  if (looksLikeIso2022Jp(bytes)) {
    warnings.push("ISO-2022-JPの可能性があります。未対応のため判定不能にしました。");
    return { encoding: "unknown", hasBom: false, asciiCompatible: false, duplicateBom: false, confidence: "unknown", warnings };
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return {
      encoding: "utf-8",
      hasBom: false,
      asciiCompatible: isAsciiBytes(bytes),
      duplicateBom: false,
      confidence: "fallback",
      warnings,
    };
  } catch {
    const detected = Encoding.detect(Array.from(bytes));
    if (detected === "UTF16" || detected === "UNICODE" || detected === "UTF32") {
      warnings.push("UTF-16の可能性がありますが、BOMがなくbyte orderを確信できないため判定不能にしました。Proで指定してください。");
      return { encoding: "unknown", hasBom: false, asciiCompatible: false, duplicateBom: false, confidence: "unknown", warnings };
    }
    if (looksLikeValidShiftJis(bytes)) {
      return { encoding: "shift_jis", hasBom: false, asciiCompatible: false, duplicateBom: false, confidence: "heuristic", warnings };
    }
    warnings.push("文字コードを自動判定できませんでした。");
    return { encoding: "unknown", hasBom: false, asciiCompatible: false, duplicateBom: false, confidence: "unknown", warnings };
  }
}

export function detectCsvEncoding(bytes: Uint8Array): CsvDetectedEncoding {
  return detectCsvEncodingDetails(bytes).encoding;
}

export type DecodeReplacement = {
  index: number;
  row?: number;
  column?: number;
};

export function decodeCsvBytes(
  bytes: Uint8Array,
  requestedEncoding: CsvFileEncoding,
): {
  text: string;
  encoding: CsvDetectedEncoding;
  hasBom: boolean;
  replacementCount: number;
  asciiCompatible: boolean;
  detectionWarnings: string[];
} {
  const detection = requestedEncoding === "auto"
    ? detectCsvEncodingDetails(bytes)
    : {
      encoding: requestedEncoding,
      hasBom: requestedEncoding === "utf-8"
        ? isUtf8Bom(bytes)
        : requestedEncoding === "utf-16le"
          ? isUtf16LeBom(bytes)
          : requestedEncoding === "utf-16be"
            ? isUtf16BeBom(bytes)
            : false,
      asciiCompatible: requestedEncoding === "utf-8" && isAsciiBytes(bytes),
      duplicateBom: false,
      confidence: "fallback" as const,
      warnings: [] as string[],
    };
  if (detection.encoding === "unknown") {
    const fallback = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
    return {
      text: fallback,
      encoding: "unknown",
      hasBom: false,
      replacementCount: [...fallback].filter((char) => char === "\uFFFD").length,
      asciiCompatible: false,
      detectionWarnings: detection.warnings,
    };
  }
  const text = detection.encoding === "shift_jis"
    ? Encoding.codeToString(Encoding.convert(Array.from(bytes), {
      from: "SJIS",
      to: "UNICODE",
      type: "array",
    }) as number[])
    : new TextDecoder(detection.encoding, { fatal: false }).decode(bytes);
  const stripped = text.replace(/^\uFEFF/, "");
  return {
    text: stripped,
    encoding: detection.encoding,
    hasBom: detection.hasBom,
    replacementCount: [...stripped].filter((char) => char === "\uFFFD").length,
    asciiCompatible: detection.asciiCompatible,
    detectionWarnings: detection.warnings,
  };
}

export function encodeUtf16(text: string, littleEndian: boolean, includeBom: boolean) {
  const units: number[] = [];
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0xffff) {
      units.push(codePoint);
    } else {
      const value = codePoint - 0x10000;
      units.push(0xd800 + (value >> 10), 0xdc00 + (value & 0x3ff));
    }
  }
  const bytes = new Uint8Array((includeBom ? 2 : 0) + units.length * 2);
  let offset = 0;
  if (includeBom) {
    bytes[0] = littleEndian ? 0xff : 0xfe;
    bytes[1] = littleEndian ? 0xfe : 0xff;
    offset = 2;
  }
  units.forEach((unit, index) => {
    const low = unit & 0xff;
    const high = unit >> 8;
    bytes[offset + index * 2] = littleEndian ? low : high;
    bytes[offset + index * 2 + 1] = littleEndian ? high : low;
  });
  return bytes;
}

export type SjisUnmappable = {
  char: string;
  index?: number;
  row?: number;
  column?: number;
  value?: string;
};

export function canEncodeToShiftJis(value: string) {
  if (!value) return true;
  try {
    Encoding.convert(Encoding.stringToCode(value), {
      from: "UNICODE",
      to: "SJIS",
      type: "array",
      fallback: "error",
    });
    return true;
  } catch {
    return false;
  }
}

export function findSjisUnmappableChars(text: string): SjisUnmappable[] {
  const found: SjisUnmappable[] = [];
  let index = 0;
  for (const char of text) {
    if (!canEncodeToShiftJis(char)) found.push({ char, index });
    index += char.length;
  }
  return found;
}

export function findSjisUnmappableInRecords(
  records: Array<Record<string, unknown>>,
  columns: string[],
  limit = VALIDATION_CELL_LIMIT,
): SjisUnmappable[] {
  const found: SjisUnmappable[] = [];
  let scanned = 0;
  records.forEach((record, rowIndex) => {
    columns.forEach((column, columnIndex) => {
      if (scanned >= limit) return;
      scanned += 1;
      const value = String(record[column] ?? "");
      for (const char of value) {
        if (!canEncodeToShiftJis(char)) {
          found.push({
            char,
            row: rowIndex + 1,
            column: columnIndex + 1,
            value,
          });
        }
      }
    });
  });
  return found;
}

export function encodeToShiftJis(
  text: string,
  options: { replaceUnmappable?: boolean } = {},
): { bytes: Uint8Array; unmappable: SjisUnmappable[] } {
  const unmappable = findSjisUnmappableChars(text);
  if (unmappable.length && !options.replaceUnmappable) {
    return { bytes: new Uint8Array(), unmappable };
  }
  return {
    bytes: Uint8Array.from(Encoding.convert(Encoding.stringToCode(text), {
      from: "UNICODE",
      to: "SJIS",
      type: "array",
      fallback: options.replaceUnmappable ? "html-entity" : "error",
    }) as number[]),
    unmappable,
  };
}

export function encodeCsvText(
  text: string,
  encoding: CsvOutputEncoding,
  includeBom: boolean,
  options: { replaceUnmappable?: boolean } = {},
): { bytes: Uint8Array; unmappable: SjisUnmappable[] } {
  if (encoding === "utf-8") {
    const body = new TextEncoder().encode(text);
    if (!includeBom) return { bytes: body, unmappable: [] };
    const result = new Uint8Array(body.length + 3);
    result.set([0xef, 0xbb, 0xbf]);
    result.set(body, 3);
    return { bytes: result, unmappable: [] };
  }
  if (encoding === "utf-16le") {
    return { bytes: encodeUtf16(text, true, includeBom), unmappable: [] };
  }
  if (encoding === "utf-16be") {
    return { bytes: encodeUtf16(text, false, includeBom), unmappable: [] };
  }
  return encodeToShiftJis(text, options);
}

export type CsvRepairFailure = {
  row: number;
  column: number;
  value: string;
  reason: string;
};

export type CsvRepairResult = {
  text: string;
  repairedCount: number;
  failures: CsvRepairFailure[];
};

function looksLikeUtf8ReadAsShiftJis(value: string) {
  return /[繧縺繝｡｢､ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ]/.test(value);
}

function tryRepairUtf8ReadAsShiftJisChunk(value: string) {
  try {
    const mistakenBytes = Encoding.convert(Encoding.stringToCode(value), {
      from: "UNICODE",
      to: "SJIS",
      type: "array",
      fallback: "error",
    }) as number[];
    const repairedCodes = Encoding.convert(mistakenBytes, {
      from: "UTF8",
      to: "UNICODE",
      type: "array",
      fallback: "error",
    }) as number[];
    const text = Encoding.codeToString(repairedCodes);
    return text.includes("\uFFFD") ? null : text;
  } catch {
    return null;
  }
}

function repairUtf8ReadAsShiftJisValue(value: string): { text: string; repaired: boolean; unrecoverable: boolean } {
  if (!value) return { text: value, repaired: false, unrecoverable: false };
  if (value.includes("\uFFFD")) return { text: value, repaired: false, unrecoverable: true };
  if (!looksLikeUtf8ReadAsShiftJis(value)) {
    return { text: value, repaired: false, unrecoverable: /[^\u0000-\u00FF\u3000-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/.test(value) };
  }
  const repaired = tryRepairUtf8ReadAsShiftJisChunk(value);
  if (repaired !== null) return { text: repaired, repaired: repaired !== value, unrecoverable: false };
  return { text: value, repaired: false, unrecoverable: true };
}

export function repairUtf8ReadAsShiftJis(input: string): CsvRepairResult {
  const inspection = inspectCsv(input, { delimiter: "auto", skipEmptyLines: false });
  const failures: CsvRepairFailure[] = [];
  let repairedCount = 0;
  const rows = inspection.rows.map((row, rowIndex) =>
    row.map((value, columnIndex) => {
      const repaired = repairUtf8ReadAsShiftJisValue(value);
      if (repaired.repaired) repairedCount += 1;
      if (repaired.unrecoverable) {
        failures.push({
          row: rowIndex + 1,
          column: columnIndex + 1,
          value,
          reason: value.includes("\uFFFD")
            ? "置換文字（�）を含むため元バイトを復元できません"
            : "Shift_JISへ戻せない文字があるため元の値を残しました",
        });
      }
      return repaired.text;
    }),
  );
  const columns = Array.from({ length: Math.max(0, ...rows.map((row) => row.length)) }, (_, index) => `column_${index}`);
  const records = rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ""])));
  return {
    text: serializeCsv(records, columns, {
      delimiter: inspection.delimiter,
      includeHeader: false,
      lineEnding: inspection.lineEnding === "CRLF" ? "\r\n" : inspection.lineEnding === "CR" ? "\r" : "\n",
      finalLineEnding: /[\r\n]$/.test(input),
    }),
    repairedCount,
    failures,
  };
}

export function serializeCsv(
  records: Record<string, unknown>[],
  columns: string[],
  options: {
    delimiter?: CsvDelimiter;
    quote?: CsvQuote;
    quoteAll?: boolean;
    escapeMode?: CsvEscapeMode;
    lineEnding?: CsvLineEnding;
    includeHeader?: boolean;
    finalLineEnding?: boolean;
    headerLabels?: string[];
  } = {},
): string {
  const delimiter = options.delimiter ?? ",";
  const quote = options.quote ?? '"';
  const escapeMode = options.escapeMode ?? "double";
  const lineEnding = options.lineEnding ?? "\n";
  const escape = (value: unknown) => {
    const text = typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "");
    if (!quote) return text.replaceAll(delimiter, " ").replaceAll(/\r?\n/g, " ");
    const escaped = escapeMode === "backslash"
      ? text.replaceAll("\\", "\\\\").replaceAll(quote, `\\${quote}`)
      : text.replaceAll(quote, `${quote}${quote}`);
    return options.quoteAll || text.includes(delimiter) || text.includes(quote) || /[\r\n]/.test(text)
      ? `${quote}${escaped}${quote}`
      : text;
  };
  const rows = records.map((record) => columns.map((column) => escape(record[column])));
  if (options.includeHeader ?? true) {
    rows.unshift((options.headerLabels ?? columns).map(escape));
  }
  const output = rows.map((row) => row.join(delimiter)).join(lineEnding);
  return options.finalLineEnding ? `${output}${lineEnding}` : output;
}

export const utf8CsvPreset = {
  encoding: "utf-8" as CsvOutputEncoding,
  lineEnding: "\n" as CsvLineEnding,
  includeBom: false,
  quoteAll: false,
  quote: '"' as CsvQuote,
  escapeMode: "double" as CsvEscapeMode,
};

export const excelOrientedCsvPreset = {
  encoding: "utf-8" as CsvOutputEncoding,
  lineEnding: "\r\n" as CsvLineEnding,
  includeBom: true,
  quoteAll: true,
  quote: '"' as CsvQuote,
  escapeMode: "double" as CsvEscapeMode,
};

export const standardCsvPreset = utf8CsvPreset;
export const excelCsvPreset = excelOrientedCsvPreset;

export function formatCsvOutputMeta(options: {
  encoding: CsvOutputEncoding;
  lineEnding: CsvLineEnding;
  includeBom: boolean;
  escapeMode: CsvEscapeMode;
}) {
  const newline = options.lineEnding === "\r\n" ? "CRLF" : options.lineEnding === "\n" ? "LF" : "CR";
  const escape = options.escapeMode === "double" ? "囲み文字を二重化" : "バックスラッシュ";
  const encodingLabelText = options.encoding === "shift_jis"
    ? "Shift_JIS"
    : options.encoding === "utf-16le"
      ? "UTF-16LE"
      : options.encoding === "utf-16be"
        ? "UTF-16BE"
        : "UTF-8";
  const parts = [encodingLabelText, newline];
  if (options.encoding !== "shift_jis") {
    parts.push(options.includeBom ? "BOMあり" : "BOMなし");
  }
  parts.push(escape);
  return `出力 ${parts.join(" · ")}`;
}

export function formatCsvTimestamp(date = new Date()): string {
  const part = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    part(date.getMonth() + 1),
    part(date.getDate()),
    part(date.getHours()),
    part(date.getMinutes()),
    part(date.getSeconds()),
  ].join("");
}

export function delimiterLabel(delimiter: string) {
  if (delimiter === "\t") return "タブ区切り";
  if (delimiter === ";") return "セミコロン区切り";
  if (delimiter === "|") return "縦棒区切り";
  if (delimiter === " ") return "スペース区切り";
  return "カンマ区切り";
}

export function delimiterToken(delimiter: string) {
  if (delimiter === "\t") return "TAB";
  if (delimiter === ";") return "SEMICOLON";
  if (delimiter === "|") return "PIPE";
  if (delimiter === " ") return "SPACE";
  return "COMMA";
}

export function encodingLabel(encoding: CsvDetectedEncoding | null, source: CsvInputSource) {
  if (source === "paste") return "判定対象外";
  if (source === "xlsx") return "XLSX由来（判定対象外）";
  if (encoding === "utf-8") return "UTF-8";
  if (encoding === "shift_jis") return "Shift_JIS";
  if (encoding === "utf-16le") return "UTF-16LE";
  if (encoding === "utf-16be") return "UTF-16BE";
  if (encoding === "unknown") return "不明";
  return "不明";
}

export function lineEndingToken(lineEnding: CsvLineEnding | CsvInspection["lineEnding"]) {
  if (lineEnding === "\r\n" || lineEnding === "CRLF") return "CRLF";
  if (lineEnding === "\r" || lineEnding === "CR") return "CR";
  if (lineEnding === "なし") return "なし";
  return "LF";
}

export type CsvInputSource = "paste" | "file" | "xlsx";

export type ViewerSettings = {
  delimiter: CsvDelimiterSetting;
  quote: CsvQuote;
  escapeMode: CsvEscapeMode;
  trimFields: boolean;
  skipEmptyLines: boolean;
  headerRow: number;
  dataStartRow: number;
};

export const defaultViewerSettings: ViewerSettings = {
  delimiter: "auto",
  quote: '"',
  escapeMode: "double",
  trimFields: false,
  skipEmptyLines: true,
  headerRow: 1,
  dataStartRow: 2,
};

export type ParsedCsvTable = {
  records: Record<string, string>[];
  columns: string[];
  headerValues: string[];
  headerLabels: string[];
  columnLabels: Record<string, string>;
  error: string;
  inspection: CsvInspection;
  warnings: string[];
};

function displayHeaderLabel(header: string, index: number, headers: string[]) {
  if (header.trim()) return header;
  const emptyIndex = headers.slice(0, index + 1).filter((value) => !value.trim()).length;
  return `(空列${emptyIndex})`;
}

export function parseCsvTable(input: string, settings: ViewerSettings): ParsedCsvTable {
  const inspection = inspectCsv(input, settings);
  const headers = inspection.rows[settings.headerRow - 1];
  if (!headers?.length || headers.every((header) => !header.trim())) {
    return {
      records: [],
      columns: [],
      headerValues: [],
      headerLabels: [],
      columnLabels: {},
      error: "指定したヘッダー行にフィールドがありません。",
      inspection,
      warnings: inspection.warnings,
    };
  }
  const rows = inspection.rows.slice(Math.max(settings.dataStartRow - 1, settings.headerRow));
  const maxWidth = Math.max(headers.length, ...rows.map((row) => row.length), 0);
  const paddedHeaders = Array.from({ length: maxWidth }, (_, index) => headers[index] ?? "");
  const columns = paddedHeaders.map((_, index) => `col_${index}`);
  const headerValues = paddedHeaders.map((header) => header);
  const headerLabels = paddedHeaders.map((header, index) => displayHeaderLabel(header, index, paddedHeaders));
  const columnLabels = Object.fromEntries(columns.map((column, index) => [column, headerLabels[index]]));
  const warnings = [...inspection.warnings];
  if (maxWidth > headers.length) {
    warnings.push(`ヘッダーより多い列がある行があります。余分な列は空ヘッダーとして保持します。`);
  }
  if (headers.some((header) => !header.trim())) {
    warnings.push("空のヘッダーがあります。表示名のみ補完し、出力時は元の空ヘッダーを保持します。");
  }
  const duplicateNames = headers.filter((header, index) => header.trim() && headers.indexOf(header) !== index);
  if (new Set(headers).size !== headers.length) {
    warnings.push(`重複ヘッダーがあります（${Array.from(new Set(duplicateNames)).join(", ") || "空列を含む"}）。データは表示できます。`);
  }
  return {
    records: rows.map((row) =>
      Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ""])),
    ),
    columns,
    headerValues,
    headerLabels,
    columnLabels,
    error: "",
    inspection,
    warnings,
  };
}

export function isCsvInjectionValue(value: string) {
  if (!value) return false;
  if (/^[\t\r\n]/.test(value)) return true;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const first = trimmed[0];
  if (first === "=" || first === "+" || first === "@" || first === "*" || first === "＝" || first === "＋" || first === "＠") {
    return true;
  }
  if (first === "-" || first === "－") {
    const normalized = first === "－" ? `-${trimmed.slice(1)}` : trimmed;
    return !/^-?\d/.test(normalized);
  }
  return false;
}

export function countCsvInjectionValues(records: Array<Record<string, unknown>>, columns: string[]) {
  return records.reduce((total, record) => (
    total + columns.filter((column) => isCsvInjectionValue(String(record[column] ?? ""))).length
  ), 0);
}

export type ExcelRiskKind = "leadingZero" | "longInteger" | "dateLike" | "scientific";

export type ExcelRiskHit = {
  kind: ExcelRiskKind;
  row: number;
  column: number;
  columnKey: string;
  value: string;
};

const leadingZeroInteger = /^[+-]?0\d+$/;
const leadingZeroDecimal = /^[+-]?0\d+\.\d+$/;
const longIntegerPattern = /^-?\d{16,}$/;
const scientificPattern = /^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/;
const excelRiskLabels: Record<ExcelRiskKind, string> = {
  leadingZero: "先頭ゼロ",
  longInteger: "16桁以上の整数",
  dateLike: "日付変換候補",
  scientific: "指数表記",
};
const dateLikePatterns = [
  /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/,
  /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/,
];

export function isLeadingZeroRisk(value: string) {
  const text = value.trim();
  return leadingZeroInteger.test(text) || leadingZeroDecimal.test(text);
}

export function excelRiskLabel(kind: ExcelRiskKind) {
  return excelRiskLabels[kind];
}

export function isLongIntegerRisk(value: string) {
  return longIntegerPattern.test(value.trim());
}

export function isDateLikeRisk(value: string) {
  const trimmed = value.trim();
  return dateLikePatterns.some((pattern) => pattern.test(trimmed));
}

export function isScientificRisk(value: string) {
  return scientificPattern.test(value.trim());
}

export function diagnoseExcelRisks(
  records: Array<Record<string, unknown>>,
  columns: string[],
  limit = VALIDATION_CELL_LIMIT,
): ExcelRiskHit[] {
  const hits: ExcelRiskHit[] = [];
  let scanned = 0;
  records.forEach((record, rowIndex) => {
    columns.forEach((column, columnIndex) => {
      if (scanned >= limit) return;
      scanned += 1;
      const value = String(record[column] ?? "");
      const kinds: ExcelRiskKind[] = [];
      if (isLeadingZeroRisk(value)) kinds.push("leadingZero");
      if (isLongIntegerRisk(value)) kinds.push("longInteger");
      if (isDateLikeRisk(value)) kinds.push("dateLike");
      if (isScientificRisk(value)) kinds.push("scientific");
      kinds.forEach((kind) => {
        hits.push({
          kind,
          row: rowIndex + 1,
          column: columnIndex + 1,
          columnKey: column,
          value,
        });
      });
    });
  });
  return hits;
}

export function summarizeExcelRisks(hits: ExcelRiskHit[]) {
  return {
    leadingZero: hits.filter((hit) => hit.kind === "leadingZero").length,
    longInteger: hits.filter((hit) => hit.kind === "longInteger").length,
    dateLike: hits.filter((hit) => hit.kind === "dateLike").length,
    scientific: hits.filter((hit) => hit.kind === "scientific").length,
    kinds: Array.from(new Set(hits.map((hit) => hit.kind))).length,
  };
}

export function describeExcelRisks(hits: ExcelRiskHit[]) {
  const summary = summarizeExcelRisks(hits);
  return (Object.keys(excelRiskLabels) as ExcelRiskKind[])
    .filter((kind) => summary[kind] > 0)
    .map((kind) => `${excelRiskLabels[kind]} ${summary[kind]}件`)
    .join(" · ");
}

export function locateReplacementCharacters(
  records: Array<Record<string, unknown>>,
  columns: string[],
) {
  const hits: Array<{ row: number; column: number; value: string }> = [];
  records.forEach((record, rowIndex) => {
    columns.forEach((column, columnIndex) => {
      const value = String(record[column] ?? "");
      if (value.includes("\uFFFD")) {
        hits.push({ row: rowIndex + 1, column: columnIndex + 1, value });
      }
    });
  });
  return hits;
}

export function checkXlsxLimits(
  records: Array<Record<string, unknown>>,
  columns: string[],
) {
  const errors: string[] = [];
  if (records.length + 1 > XLSX_MAX_ROWS) {
    errors.push(`XLSXの行数上限（${XLSX_MAX_ROWS.toLocaleString()}）を超えています。`);
  }
  if (columns.length > XLSX_MAX_COLS) {
    errors.push(`XLSXの列数上限（${XLSX_MAX_COLS.toLocaleString()}）を超えています。`);
  }
  records.forEach((record, rowIndex) => {
    columns.forEach((column, columnIndex) => {
      const value = String(record[column] ?? "");
      if (value.length > XLSX_MAX_CELL_CHARS) {
        errors.push(`${rowIndex + 1}行 / ${columnIndex + 1}列が1セル上限（${XLSX_MAX_CELL_CHARS.toLocaleString()}文字）を超えています。`);
      }
    });
  });
  return errors;
}

export function applyPreviewEdits<T>(hiddenRecords: T[], editedVisible: T[]): T[] {
  return [...editedVisible, ...hiddenRecords];
}

export function splitPreviewRecords<T>(records: T[], limit = PREVIEW_ROW_LIMIT) {
  return {
    visible: records.slice(0, limit),
    hidden: records.slice(limit),
    previewApplied: records.length > limit,
  };
}

export function isLargeFileWarning(byteLength: number) {
  return byteLength >= LARGE_FILE_WARNING_BYTES;
}

export function formatExcelDate(value: Date) {
  const hasTime = value.getUTCHours() !== 0
    || value.getUTCMinutes() !== 0
    || value.getUTCSeconds() !== 0
    || value.getUTCMilliseconds() !== 0;
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  if (!hasTime) return `${year}-${month}-${day}`;
  return value.toISOString();
}

export function excelCellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatExcelDate(value);
  if (typeof value !== "object") return String(value);
  if ("result" in value) return excelCellToText((value as { result?: unknown }).result);
  if ("text" in value) return String((value as { text?: unknown }).text ?? "");
  if ("richText" in value && Array.isArray((value as { richText?: unknown[] }).richText)) {
    return (value as { richText: { text?: string }[] }).richText.map((part) => part.text ?? "").join("");
  }
  if ("formula" in value) return excelCellToText((value as { formula?: unknown; result?: unknown }).result ?? "");
  return JSON.stringify(value);
}

export function rowsToCsv(rows: string[][]): string {
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const columns = Array.from({ length: width }, (_, index) => `column_${index}`);
  const records = rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ""])));
  return serializeCsv(records, columns, { includeHeader: false });
}

export async function buildXlsxBuffer(
  records: Array<Record<string, unknown>>,
  columns: string[],
  headerLabels: string[] = columns,
): Promise<Uint8Array> {
  const limitErrors = checkXlsxLimits(records, columns);
  if (limitErrors.length) {
    throw new Error(limitErrors[0]);
  }
  const excelJsModule = await import("exceljs");
  const ExcelJS = excelJsModule.default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  worksheet.columns = columns.map((column, index) => ({
    header: headerLabels[index] ?? column,
    key: column,
  }));
  records.forEach((record) => {
    const row = worksheet.addRow(columns.map((column) => String(record[column] ?? "")));
    row.eachCell((cell) => {
      const text = String(cell.value ?? "");
      cell.value = text;
      cell.numFmt = "@";
    });
  });
  worksheet.columns.forEach((column, index) => {
    const header = headerLabels[index] ?? columns[index] ?? "";
    const longest = Math.max(header.length, ...records.map((record) => String(record[columns[index]] ?? "").length));
    column.width = Math.min(60, Math.max(12, longest + 2));
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export type InputFileFormat = {
  source: CsvInputSource;
  encoding: CsvDetectedEncoding | null;
  hasBom: boolean | null;
  delimiter: CsvDelimiter;
  lineEnding: CsvInspection["lineEnding"];
  hasHeader: boolean;
};

export function describeInputFormat(format: InputFileFormat) {
  return {
    source: format.source === "file" ? "ファイル" : format.source === "xlsx" ? "XLSX" : "貼り付けテキスト",
    encoding: encodingLabel(format.encoding, format.source),
    bom: format.hasBom === null ? "判定対象外" : format.hasBom ? "BOMあり" : "BOMなし",
    delimiter: delimiterToken(format.delimiter),
    lineEnding: format.lineEnding,
    header: format.hasHeader ? "あり" : "なし",
  };
}
