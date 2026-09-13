import { describe, expect, it } from "vitest";
import {
  isOpenableWorkspaceFile,
  spreadsheetOpenError,
} from "./csv-workspace-open";

describe("workspace file open path", () => {
  it("blocks the same unsafe spreadsheet types for DnD and file picker", () => {
    ["book.xls", "macro.xlsm", "data.xlsb", "addin.xlam"].forEach((name) => {
      expect(spreadsheetOpenError(name)).toContain("マクロ・バイナリ");
      expect(isOpenableWorkspaceFile(name)).toBe(false);
    });
  });

  it("allows csv, tsv, and xlsx", () => {
    ["employees.csv", "sheet.tsv", "book.xlsx"].forEach((name) => {
      expect(spreadsheetOpenError(name)).toBe("");
      expect(isOpenableWorkspaceFile(name)).toBe(true);
    });
  });
});
