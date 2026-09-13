export const BLOCKED_SPREADSHEET_EXTENSIONS = ["xlsm", "xlsb", "xlam", "xls"];

export function spreadsheetExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function spreadsheetOpenError(fileName: string) {
  const extension = spreadsheetExtension(fileName);
  if (BLOCKED_SPREADSHEET_EXTENSIONS.includes(extension)) {
    return "マクロ・バイナリ形式は安全のため読み込めません。.xlsxへ保存してから開いてください。";
  }
  return "";
}

export function isOpenableWorkspaceFile(fileName: string) {
  return !spreadsheetOpenError(fileName);
}
