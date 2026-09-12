export type CsvFieldWarningKind = "leadingZero" | "scientific";

export type CsvFieldWarning = {
  kind: CsvFieldWarningKind;
  column: string;
  row: number;
  value: string;
};

const leadingZeroInteger = /^[+-]?0\d+$/;
const leadingZeroDecimal = /^[+-]?0\d+\.\d+$/;
const scientificPattern = /^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/;

export function isLeadingZeroNumericField(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return leadingZeroInteger.test(text) || leadingZeroDecimal.test(text);
}

export function isScientificNumericField(value: unknown): boolean {
  return scientificPattern.test(String(value ?? "").trim());
}

export function findCsvFieldWarnings(
  records: Array<Record<string, unknown>>,
  columns: string[],
): CsvFieldWarning[] {
  const hits: CsvFieldWarning[] = [];
  records.forEach((record, index) => {
    columns.forEach((column) => {
      const value = record[column];
      if (isLeadingZeroNumericField(value)) {
        hits.push({ kind: "leadingZero", column, row: index + 1, value: String(value ?? "") });
      }
      if (isScientificNumericField(value)) {
        hits.push({ kind: "scientific", column, row: index + 1, value: String(value ?? "") });
      }
    });
  });
  return hits;
}

export function summarizeCsvFieldWarnings(hits: CsvFieldWarning[]) {
  return {
    leadingZero: hits.filter((hit) => hit.kind === "leadingZero").length,
    scientific: hits.filter((hit) => hit.kind === "scientific").length,
  };
}

export function describeCsvFieldWarnings(hits: CsvFieldWarning[]) {
  const summary = summarizeCsvFieldWarnings(hits);
  const parts: string[] = [];
  if (summary.leadingZero) parts.push(`先頭ゼロ ${summary.leadingZero}件`);
  if (summary.scientific) parts.push(`指数表記 ${summary.scientific}件`);
  return parts.join(" · ");
}
