import { describe, expect, it } from "vitest";
import {
  describeCsvFieldWarnings,
  findCsvFieldWarnings,
  isLeadingZeroNumericField,
  isScientificNumericField,
  summarizeCsvFieldWarnings,
} from "./csv-field-warnings";

describe("CSV numeric field warnings", () => {
  it("flags integer and decimal values that keep a leading zero", () => {
    expect(isLeadingZeroNumericField("00123")).toBe(true);
    expect(isLeadingZeroNumericField("09012345678")).toBe(true);
    expect(isLeadingZeroNumericField("-01")).toBe(true);
    expect(isLeadingZeroNumericField("01.50")).toBe(true);
    expect(isLeadingZeroNumericField("00.5")).toBe(true);
  });

  it("does not flag ordinary zeros or non-numeric text", () => {
    expect(isLeadingZeroNumericField("0")).toBe(false);
    expect(isLeadingZeroNumericField("0.5")).toBe(false);
    expect(isLeadingZeroNumericField("101")).toBe(false);
    expect(isLeadingZeroNumericField("0x10")).toBe(false);
    expect(isLeadingZeroNumericField("")).toBe(false);
    expect(isLeadingZeroNumericField("  ")).toBe(false);
  });

  it("flags scientific notation that spreadsheets treat as a number", () => {
    expect(isScientificNumericField("1E10")).toBe(true);
    expect(isScientificNumericField("1e10")).toBe(true);
    expect(isScientificNumericField("1.2e3")).toBe(true);
    expect(isScientificNumericField("123E5")).toBe(true);
    expect(isScientificNumericField("1E+10")).toBe(true);
    expect(isScientificNumericField("1E-10")).toBe(true);
    expect(isScientificNumericField("98")).toBe(false);
    expect(isScientificNumericField("E10")).toBe(false);
    expect(isScientificNumericField("1E")).toBe(false);
  });

  it("summarizes hits by column and kind", () => {
    const hits = findCsvFieldWarnings(
      [
        { id: "001", amount: "1E10" },
        { id: "2", amount: "1.5e2" },
        { id: "3", amount: "12" },
      ],
      ["id", "amount"],
    );
    expect(summarizeCsvFieldWarnings(hits)).toEqual({ leadingZero: 1, scientific: 2 });
    expect(describeCsvFieldWarnings(hits)).toBe("先頭ゼロ 1件 · 指数表記 2件");
    expect(hits[0]).toMatchObject({ kind: "leadingZero", column: "id", row: 1, value: "001" });
  });
});
