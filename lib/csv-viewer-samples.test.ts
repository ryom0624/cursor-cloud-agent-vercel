import { describe, expect, it } from "vitest";
import { defaultViewerSettings, diagnoseExcelRisks, parseCsvTable } from "./csv-utils-beta";
import {
  csvViewerComplexSample,
  csvViewerJapaneseSample,
  csvViewerSample,
} from "./csv-viewer-samples";

function uniqueValues(
  records: Array<Record<string, unknown>>,
  columns: string[],
  labels: string[],
  label: string,
) {
  const column = columns[labels.indexOf(label)];
  return new Set(records.map((record) => String(record[column] ?? "")));
}

describe("csv viewer samples", () => {
  it("keeps about 100 data rows for the basic and Japanese samples", () => {
    expect(parseCsvTable(csvViewerSample, defaultViewerSettings).records).toHaveLength(100);
    expect(parseCsvTable(csvViewerJapaneseSample, defaultViewerSettings).records).toHaveLength(100);
  });

  it("gives every sample row distinct values instead of repeating a short cycle", () => {
    const basic = parseCsvTable(csvViewerSample, defaultViewerSettings);
    const japanese = parseCsvTable(csvViewerJapaneseSample, defaultViewerSettings);
    const complex = parseCsvTable(csvViewerComplexSample, defaultViewerSettings);
    expect(uniqueValues(basic.records, basic.columns, basic.headerLabels, "name").size).toBe(basic.records.length);
    expect(uniqueValues(basic.records, basic.columns, basic.headerLabels, "team").size).toBe(basic.records.length);
    expect(uniqueValues(basic.records, basic.columns, basic.headerLabels, "updated_at").size).toBe(basic.records.length);
    expect(uniqueValues(japanese.records, japanese.columns, japanese.headerLabels, "氏名").size).toBe(japanese.records.length);
    expect(uniqueValues(japanese.records, japanese.columns, japanese.headerLabels, "備考").size).toBe(japanese.records.length);
    expect(uniqueValues(japanese.records, japanese.columns, japanese.headerLabels, "入社日").size).toBe(japanese.records.length);
    expect(uniqueValues(complex.records, complex.columns, complex.headerLabels, "name").size).toBe(complex.records.length);
    expect(uniqueValues(complex.records, complex.columns, complex.headerLabels, "address").size).toBe(complex.records.length);
  });

  it("keeps a complex sample that actually stresses quoting, formulas, and Excel risks", () => {
    const parsed = parseCsvTable(csvViewerComplexSample, defaultViewerSettings);
    expect(parsed.records.length).toBeGreaterThanOrEqual(95);
    expect(parsed.records.length).toBeLessThanOrEqual(101);
    const values = parsed.records.flatMap((record) => Object.values(record).map((value) => String(value ?? "")));
    expect(values.some((value) => value.includes(","))).toBe(true);
    expect(values.some((value) => value.includes("\n"))).toBe(true);
    expect(values.some((value) => value.includes('"'))).toBe(true);
    expect(values.some((value) => value.startsWith("=") || value.startsWith("+") || value.startsWith("@"))).toBe(true);
    expect(diagnoseExcelRisks(parsed.records, parsed.columns).length).toBeGreaterThan(8);
  });
});
