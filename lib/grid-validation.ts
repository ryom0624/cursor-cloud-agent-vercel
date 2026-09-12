export function isBlankGridValue(value: unknown) {
  return String(value ?? "").trim() === "";
}

export function countBlankRows(records: Array<Record<string, unknown>>, column: string) {
  return records.filter((record) => isBlankGridValue(record[column])).length;
}

export function describeUniqueKeyValidation(blankRows: number, duplicateRows: number) {
  const parts: string[] = [];
  if (blankRows) parts.push(`${blankRows}行が空欄です`);
  if (duplicateRows) parts.push(`${duplicateRows}行が重複しています`);
  return parts.length ? parts.join(" · ") : "空欄・重複はありません";
}

export function describeRequiredColumnValidation(
  columns: Array<{ column: string; blankRows: number }>,
) {
  const issues = columns.filter((item) => item.blankRows > 0);
  if (!issues.length) return "必須列に空欄はありません";
  return issues.map((item) => `${item.column}: ${item.blankRows}行が空欄`).join(" · ");
}
