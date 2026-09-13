export type SqlResultRow = Record<string, unknown>;

export function stringifySqlCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function canonicalizeResultSet(
  rows: SqlResultRow[],
  options: { ordered?: boolean } = {},
) {
  const normalized = rows.map((row) => {
    const keys = Object.keys(row).sort((left, right) => left.localeCompare(right));
    return Object.fromEntries(
      keys.map((key) => [key.toLowerCase(), stringifySqlCell(row[key])]),
    );
  });
  if (!options.ordered) {
    normalized.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  return JSON.stringify(normalized);
}

export function compareSqlResults(
  actual: SqlResultRow[],
  expected: SqlResultRow[],
  options: { ordered?: boolean } = {},
) {
  const actualKeys = Array.from(new Set(actual.flatMap((row) => Object.keys(row)))).sort();
  const expectedKeys = Array.from(new Set(expected.flatMap((row) => Object.keys(row)))).sort();
  const actualCanon = canonicalizeResultSet(actual, options);
  const expectedCanon = canonicalizeResultSet(expected, options);
  const equal = actualCanon === expectedCanon;
  if (equal) return { equal: true as const };
  const hints: string[] = [];
  if (actual.length !== expected.length) {
    hints.push(`行数が違います。期待 ${expected.length} 行、実際 ${actual.length} 行`);
  }
  const actualKeySet = new Set(actualKeys.map((key) => key.toLowerCase()));
  const expectedKeySet = new Set(expectedKeys.map((key) => key.toLowerCase()));
  const missing = expectedKeys.filter((key) => !actualKeySet.has(key.toLowerCase()));
  const extra = actualKeys.filter((key) => !expectedKeySet.has(key.toLowerCase()));
  if (missing.length) hints.push(`足りない列: ${missing.join(", ")}`);
  if (extra.length) hints.push(`余分な列: ${extra.join(", ")}`);
  return {
    equal: false as const,
    hints,
  };
}

export function rowsToCsv(rows: SqlResultRow[]) {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => {
    const text = stringifySqlCell(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

export function rowsToJson(rows: SqlResultRow[]) {
  return JSON.stringify(
    rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, stringifySqlCell(value)]),
      ),
    ),
    null,
    2,
  );
}
