import { describe, expect, it } from "vitest";
import { defaultViewerSettings, diagnoseExcelRisks, parseCsvTable } from "./csv-utils-beta";
import {
  csvViewerComplexSample,
  csvViewerJapaneseSample,
  csvViewerSample,
} from "./csv-viewer-samples";

describe("csv viewer samples", () => {
  it("keeps about 100 data rows for the basic and Japanese samples", () => {
    expect(parseCsvTable(csvViewerSample, defaultViewerSettings).records).toHaveLength(100);
    expect(parseCsvTable(csvViewerJapaneseSample, defaultViewerSettings).records).toHaveLength(100);
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
