import * as Encoding from "encoding-japanese";

export type CsvDelimiter = "," | "\t" | ";" | "|" | " ";
export type CsvDelimiterSetting = CsvDelimiter | "auto";
export type CsvQuote = '"' | "'" | "";
export type CsvFileEncoding = "auto" | "utf-8" | "shift_jis";
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
  warnings: string[];
};

const delimiterCandidates: CsvDelimiter[] = [",", "\t", ";", "|", " "];

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
  for (const delimiter of delimiterCandidates) {
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
  if (result.unclosedQuote) warnings.push("囲み文字が閉じられていません。");
  if (unevenRows.length) {
    warnings.push(`列数が揃っていない行があります（${unevenRows.slice(0, 5).map(({ index }) => index + 1).join(", ")}行目）。`);
  }
  if (normalized.includes("\0")) warnings.push("NUL文字が含まれています。");
  return {
    ...result,
    delimiter,
    lineEnding: inspectLineEnding(normalized),
    hasBom,
    warnings,
  };
}

export function parseCsv(input: string, options: CsvParseOptions = {}): string[][] {
  return inspectCsv(input, options).rows;
}

export function detectCsvEncoding(bytes: Uint8Array): Exclude<CsvFileEncoding, "auto"> {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "utf-8";
  } catch {
    return "shift_jis";
  }
}

export function decodeCsvBytes(
  bytes: Uint8Array,
  requestedEncoding: CsvFileEncoding,
): { text: string; encoding: Exclude<CsvFileEncoding, "auto">; hasBom: boolean } {
  const encoding = requestedEncoding === "auto" ? detectCsvEncoding(bytes) : requestedEncoding;
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const text = new TextDecoder(encoding, { fatal: false }).decode(bytes);
  return { text: text.replace(/^\uFEFF/, ""), encoding, hasBom };
}

export function encodeCsvText(
  text: string,
  encoding: CsvOutputEncoding,
  includeBom: boolean,
): Uint8Array {
  if (encoding === "utf-8") {
    const body = new TextEncoder().encode(text);
    if (!includeBom) return body;
    const result = new Uint8Array(body.length + 3);
    result.set([0xef, 0xbb, 0xbf]);
    result.set(body, 3);
    return result;
  }
  return Uint8Array.from(Encoding.convert(Encoding.stringToCode(text), {
    from: "UNICODE",
    to: "SJIS",
    type: "array",
    fallback: "html-entity",
  }));
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
  if (options.includeHeader ?? true) rows.unshift(columns.map(escape));
  const output = rows.map((row) => row.join(delimiter)).join(lineEnding);
  return options.finalLineEnding ? `${output}${lineEnding}` : output;
}

export const standardCsvPreset = {
  encoding: "utf-8" as CsvOutputEncoding,
  lineEnding: "\n" as CsvLineEnding,
  includeBom: false,
  quoteAll: false,
  quote: '"' as CsvQuote,
  escapeMode: "double" as CsvEscapeMode,
};

export const excelCsvPreset = {
  encoding: "utf-8" as CsvOutputEncoding,
  lineEnding: "\r\n" as CsvLineEnding,
  includeBom: true,
  quoteAll: true,
  quote: '"' as CsvQuote,
  escapeMode: "double" as CsvEscapeMode,
};

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
