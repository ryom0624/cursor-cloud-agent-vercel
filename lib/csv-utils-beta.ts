import * as Encoding from "encoding-japanese";

export type CsvDelimiter = "," | "\t" | ";" | "|" | " ";
export type CsvDelimiterSetting = CsvDelimiter | "auto";
export type CsvQuote = '"' | "'" | "";
export type CsvDetectedEncoding = "utf-8" | "shift_jis" | "utf-16le" | "utf-16be";
export type CsvFileEncoding = "auto" | CsvDetectedEncoding;
export type CsvOutputEncoding = "utf-8" | "shift_jis";
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

function inspectLineEnding(input: string): CsvInspection["lineEnding"] {
  if (input.includes("\r\n")) return "CRLF";
  if (input.includes("\n")) return "LF";
  if (input.includes("\r")) return "CR";
  return "なし";
}

export function hasMixedLineEndings(input: string) {
  let crlf = 0;
  let lf = 0;
  let cr = 0;
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === "\r" && input[index + 1] === "\n") {
      crlf += 1;
      index += 1;
    } else if (input[index] === "\n") {
      lf += 1;
    } else if (input[index] === "\r") {
      cr += 1;
    }
  }
  return [crlf, lf, cr].filter((count) => count > 0).length > 1;
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
  const mixedLineEndings = hasMixedLineEndings(normalized);
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
    lineEnding: inspectLineEnding(normalized),
    hasBom,
    mixedLineEndings,
    separatorDirective,
    warnings,
  };
}

export function parseCsv(input: string, options: CsvParseOptions = {}): string[][] {
  return inspectCsv(input, options).rows;
}

export function detectCsvEncoding(bytes: Uint8Array): CsvDetectedEncoding {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "utf-8";
  } catch {
    return "shift_jis";
  }
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
} {
  const encoding = requestedEncoding === "auto" ? detectCsvEncoding(bytes) : requestedEncoding;
  const utf8Bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const utf16leBom = bytes[0] === 0xff && bytes[1] === 0xfe;
  const utf16beBom = bytes[0] === 0xfe && bytes[1] === 0xff;
  const hasBom = encoding === "utf-8"
    ? utf8Bom
    : encoding === "utf-16le"
      ? utf16leBom
      : encoding === "utf-16be"
        ? utf16beBom
        : false;
  const decoderLabel = encoding === "shift_jis" ? "shift_jis" : encoding;
  const text = new TextDecoder(decoderLabel, { fatal: false }).decode(bytes);
  const stripped = text.replace(/^\uFEFF/, "");
  return {
    text: stripped,
    encoding,
    hasBom,
    replacementCount: [...stripped].filter((char) => char === "\uFFFD").length,
  };
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
): SjisUnmappable[] {
  const found: SjisUnmappable[] = [];
  records.forEach((record, rowIndex) => {
    columns.forEach((column, columnIndex) => {
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
  const parts = [options.encoding === "shift_jis" ? "Shift_JIS" : "UTF-8", newline];
  if (options.encoding === "utf-8") {
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
  const columns = headers.map((_, index) => `col_${index}`);
  const headerValues = headers.map((header) => header);
  const headerLabels = headers.map((header, index) => displayHeaderLabel(header, index, headers));
  const columnLabels = Object.fromEntries(columns.map((column, index) => [column, headerLabels[index]]));
  const rows = inspection.rows.slice(Math.max(settings.dataStartRow - 1, settings.headerRow));
  const warnings = [...inspection.warnings];
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

const leadingZeroPattern = /^-?0\d+$/;
const longIntegerPattern = /^-?\d{16,}$/;
const scientificPattern = /^-?\d+(\.\d+)?[eE][+-]?\d+$/;
const dateLikePatterns = [
  /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/,
  /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/,
];

export function isLeadingZeroRisk(value: string) {
  return leadingZeroPattern.test(value.trim());
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
): ExcelRiskHit[] {
  const hits: ExcelRiskHit[] = [];
  records.forEach((record, rowIndex) => {
    columns.forEach((column, columnIndex) => {
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

export function excelCellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
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
