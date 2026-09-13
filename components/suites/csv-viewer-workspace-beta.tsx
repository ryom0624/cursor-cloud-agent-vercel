"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Columns2,
  Download,
  FileSpreadsheet,
  FileWarning,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoundedNumberInput } from "@/components/bounded-number-input";
import { DataGrid, type DataGridRecord } from "@/components/data-grid";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  applyPreviewEdits,
  buildXlsxBuffer,
  checkXlsxLimits,
  countCsvInjectionValues,
  decodeCsvBytes,
  defaultViewerSettings,
  delimiterToken,
  diagnoseExcelRisks,
  encodeCsvText,
  encodingLabel,
  excelCellToText,
  excelOrientedCsvPreset,
  findSjisUnmappableInRecords,
  formatCsvTimestamp,
  inspectCsv,
  LARGE_FILE_WARNING_BYTES,
  lineEndingToken,
  locateReplacementCharacters,
  parseCsvTable,
  PREVIEW_ROW_LIMIT,
  repairUtf8ReadAsShiftJis,
  rowsToCsv,
  serializeCsv,
  splitPreviewRecords,
  summarizeExcelRisks,
  utf8CsvPreset,
  XLSX_MAX_ROWS,
  type CsvDelimiterSetting,
  type CsvDetectedEncoding,
  type CsvEscapeMode,
  type CsvFileEncoding,
  type CsvInputSource,
  type CsvLineEnding,
  type CsvOutputEncoding,
  type CsvQuote,
  type SjisUnmappable,
  type ViewerSettings,
} from "@/lib/csv-utils-beta";
import { spreadsheetOpenError } from "@/lib/csv-workspace-open";

const csvViewerSample = `id,name,team,status,score,updated_at
101,DevSmith,Platform,active,98,2026-09-11
102,API Gateway,Backend,review,87,2026-09-10
103,Design Tokens,Design System,active,92,2026-09-09
104,Log Pipeline,SRE,paused,74,2026-09-08
105,Release Notes,Product,active,89,2026-09-07`;

const csvViewerJapaneseSample = `社員ID,氏名,部署,役職,入社日,備考
1001,山田 太郎,開発部,エンジニア,2022-04-01,API基盤を担当
1002,佐藤 花子,デザイン部,デザイナー,2021-10-15,UI・UXを担当
1003,鈴木 一郎,営業部,マネージャー,2020-01-20,国内営業を担当
1004,高橋 美咲,品質保証部,QAエンジニア,2023-07-03,自動テストを担当`;

const csvViewerComplexSample = `id,name,note,address,amount,formula
1,"カンマ,を含む名前","通常の1行メモ","東京都千代田区",1200,"=SUM(1,2)"
2,改行データ,"1行目
2行目","大阪府大阪市",0,"+cmd"
3,引用符,"彼は""確認済み""と回答","福岡県福岡市",00125,""
4,空データ,,"  前後に空白  ",-450,"@external"
5,  前後空白あり  ,未引用の空白も保持,  東京都  ,00300,plain`;

type ExcelSheet = { name: string; csv: string };
type WorkspaceView = "viewer" | "raw" | "split";
type DialogKind = "none" | "paste" | "reinterpret" | "output" | "samples";

function previewCsv(text: string, settings: ViewerSettings) {
  const rows = inspectCsv(text, settings).rows.slice(0, PREVIEW_ROW_LIMIT + 1);
  return rowsToCsv(rows);
}

function recordColumns(records: DataGridRecord[]) {
  return Array.from(new Set(records.flatMap((record) => Object.keys(record))));
}

function triggerDownload(bytes: Uint8Array, filename: string, mimeType: string) {
  const content = new Uint8Array(bytes.length);
  content.set(bytes);
  const url = URL.createObjectURL(new Blob([content.buffer], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function lineEndingFromInspection(lineEnding: "CRLF" | "LF" | "CR" | "なし"): CsvLineEnding {
  if (lineEnding === "CRLF") return "\r\n";
  if (lineEnding === "CR") return "\r";
  return "\n";
}

function confirmDiscardEdits(dirty: boolean) {
  return !dirty || window.confirm("現在の編集を破棄しますか？");
}

export function CsvViewerWorkspaceBeta() {
  const [input, setInput] = useState("");
  const [hasSource, setHasSource] = useState(false);
  const [sourceName, setSourceName] = useState("貼り付けデータ");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("viewer");
  const [dialog, setDialog] = useState<DialogKind>("none");
  const [pasteDraft, setPasteDraft] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [editedRecords, setEditedRecords] = useState<DataGridRecord[] | null>(null);
  const [settings, setSettings] = useState(defaultViewerSettings);
  const [fileEncoding, setFileEncoding] = useState<CsvFileEncoding>("auto");
  const [detectedEncoding, setDetectedEncoding] = useState<CsvDetectedEncoding | null>(null);
  const [fileHasBom, setFileHasBom] = useState<boolean | null>(null);
  const [inputSource, setInputSource] = useState<CsvInputSource>("paste");
  const [outputEncoding, setOutputEncoding] = useState<CsvOutputEncoding>("utf-8");
  const [lineEnding, setLineEnding] = useState<CsvLineEnding>("\r\n");
  const [includeBom, setIncludeBom] = useState(true);
  const [quoteAll, setQuoteAll] = useState(false);
  const [outputQuote, setOutputQuote] = useState<CsvQuote>('"');
  const [outputEscapeMode, setOutputEscapeMode] = useState<CsvEscapeMode>("double");
  const [repairError, setRepairError] = useState("");
  const [repairMessage, setRepairMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingLargeFile, setPendingLargeFile] = useState<File | null>(null);
  const [excelSheets, setExcelSheets] = useState<ExcelSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [previewNotice, setPreviewNotice] = useState("");
  const [replacementCount, setReplacementCount] = useState(0);
  const [sjisDialog, setSjisDialog] = useState<{
    unmappable: SjisUnmappable[];
    records: DataGridRecord[];
    columns: string[];
  } | null>(null);
  const [xlsxError, setXlsxError] = useState("");
  const [detectionWarnings, setDetectionWarnings] = useState<string[]>([]);
  const [asciiCompatible, setAsciiCompatible] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [hiddenRecords, setHiddenRecords] = useState<DataGridRecord[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({});
  const [splitPercent, setSplitPercent] = useState(42);
  const fileBytesRef = useRef<Uint8Array | null>(null);
  const fullFileTextRef = useRef<string | null>(null);
  const loadCancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseCsvTable(input, settings), [input, settings]);
  const records = editedRecords ?? parsed.records;
  const columns = useMemo(() => {
    const extraColumns = recordColumns(records).filter((column) => !parsed.columns.includes(column));
    return [...parsed.columns, ...extraColumns];
  }, [parsed.columns, records]);
  const columnLabels = useMemo(() => ({
    ...parsed.columnLabels,
    ...Object.fromEntries(
      columns.filter((column) => !parsed.columns.includes(column)).map((column) => [column, column]),
    ),
    ...labelOverrides,
  }), [columns, labelOverrides, parsed.columnLabels, parsed.columns]);
  const headerValues = columns.map((column, index) =>
    labelOverrides[column] ?? parsed.headerValues[index] ?? columnLabels[column] ?? column,
  );
  const looksMojibake = /[繧縺繝]/.test(input);
  const excelRisks = useMemo(() => diagnoseExcelRisks(records, columns), [columns, records]);
  const excelRiskSummary = summarizeExcelRisks(excelRisks);
  const injectionCount = countCsvInjectionValues(records, columns);
  const replacementHits = useMemo(() => locateReplacementCharacters(records, columns), [columns, records]);
  const sjisUnmappable = useMemo(() => findSjisUnmappableInRecords(records, columns), [columns, records]);
  const xlsxLimitErrors = useMemo(() => checkXlsxLimits(records, columns), [columns, records]);
  const excelRowOverflow = records.length + 1 > XLSX_MAX_ROWS;
  const structureIssues = parsed.inspection.warnings.filter((warning) =>
    warning.includes("囲み") || warning.includes("列数") || warning.includes("NUL") || warning.includes("混在") || warning.includes("separator"),
  );
  const encodingIssues = [
    ...replacementHits.map((hit) => `${hit.row}行 / ${hit.column}列にデコードできなかった文字（U+FFFD）があります`),
    ...(replacementCount && !replacementHits.length ? [`デコードできなかったbyteが${replacementCount}件あります`] : []),
  ];
  const extraWarnings = [
    ...parsed.warnings,
    ...detectionWarnings,
    ...(injectionCount ? [`表計算ソフトで数式として実行され得る値が${injectionCount}件あります。値は変更していません。`] : []),
    ...encodingIssues,
    ...(excelRowOverflow ? ["Excel向けCSVは1,048,576行を超えるとExcelで完全表示できない可能性があります。"] : []),
    ...(xlsxLimitErrors.length ? xlsxLimitErrors : []),
  ];
  const uniqueWarnings = Array.from(new Set(extraWarnings));
  const problemCount = [
    structureIssues.length,
    encodingIssues.length,
    excelRiskSummary.kinds,
    sjisUnmappable.length,
    injectionCount,
    uniqueWarnings.length,
  ].filter((count) => count > 0).length;
  const hasProblems = problemCount > 0 || Boolean(parsed.error);
  const unknownEncoding = inputSource === "file" && detectedEncoding === "unknown" && fileEncoding === "auto";
  const dirty = Boolean(editedRecords);

  const serializeOutput = (
    targetRecords: DataGridRecord[],
    targetColumns: string[],
    includeHeader = true,
    overrides: {
      delimiter?: typeof parsed.inspection.delimiter;
      lineEnding?: CsvLineEnding;
      quoteAll?: boolean;
      quote?: CsvQuote;
      escapeMode?: CsvEscapeMode;
    } = {},
  ) => serializeCsv(targetRecords, targetColumns, {
    delimiter: overrides.delimiter,
    lineEnding: overrides.lineEnding ?? lineEnding,
    quoteAll: overrides.quoteAll ?? quoteAll,
    quote: overrides.quote ?? outputQuote,
    escapeMode: overrides.escapeMode ?? outputEscapeMode,
    includeHeader,
    finalLineEnding: true,
    headerLabels: targetColumns.map((column) => {
      const index = columns.indexOf(column);
      return index >= 0 ? headerValues[index] : column;
    }),
  });

  const workingRaw = serializeOutput(records, columns);
  const filenameLabel = inputSource === "xlsx" && selectedSheet
    ? `${sourceName} / ${selectedSheet}`
    : sourceName;

  const detectedLine = inputSource === "paste"
    ? `貼り付け · encoding 判定対象外 · BOM 判定対象外 · ${delimiterToken(parsed.inspection.delimiter)} · ${parsed.inspection.lineEnding} · ${records.length.toLocaleString()} × ${columns.length}`
    : inputSource === "xlsx"
      ? `XLSX${selectedSheet ? ` · ${selectedSheet}` : ""} · ${records.length.toLocaleString()} × ${columns.length}`
      : `${encodingLabel(detectedEncoding, inputSource)} · ${fileHasBom ? "BOMあり" : "BOMなし"} · ${delimiterToken(parsed.inspection.delimiter)} · ${parsed.inspection.lineEnding} · ${records.length.toLocaleString()} × ${columns.length}`;

  const downloadCsv = (
    targetRecords: DataGridRecord[],
    targetColumns: string[],
    options: {
      encoding: CsvOutputEncoding;
      lineEnding: CsvLineEnding;
      includeBom: boolean;
      quoteAll: boolean;
      quote: CsvQuote;
      escapeMode: CsvEscapeMode;
      delimiter?: typeof parsed.inspection.delimiter;
      replaceUnmappable?: boolean;
    },
  ) => {
    const output = serializeOutput(targetRecords, targetColumns, true, options);
    if (options.encoding === "shift_jis" && !options.replaceUnmappable) {
      const unmappable = findSjisUnmappableInRecords(targetRecords, targetColumns);
      if (unmappable.length) {
        setSjisDialog({ unmappable, records: targetRecords, columns: targetColumns });
        return;
      }
    }
    const encoded = encodeCsvText(output, options.encoding, options.includeBom, {
      replaceUnmappable: options.replaceUnmappable,
    });
    if (encoded.unmappable.length && !options.replaceUnmappable) {
      setSjisDialog({ unmappable: encoded.unmappable, records: targetRecords, columns: targetColumns });
      return;
    }
    const mimeEncoding = options.encoding === "shift_jis"
      ? "shift_jis"
      : options.encoding === "utf-16le"
        ? "utf-16le"
        : options.encoding === "utf-16be"
          ? "utf-16be"
          : "utf-8";
    triggerDownload(encoded.bytes, `devsmith-data_${formatCsvTimestamp()}.csv`, `text/csv;charset=${mimeEncoding}`);
  };

  const unknownEncodingBlocksExport = unknownEncoding;

  const recordsForFullExport = () => {
    if (hiddenRecords?.length) {
      return { records: applyPreviewEdits(hiddenRecords, records), columns, headerValues };
    }
    if (previewActive && !editedRecords && fullFileTextRef.current) {
      const full = parseCsvTable(fullFileTextRef.current, settings);
      return { records: full.records, columns: full.columns, headerValues: full.headerValues };
    }
    return { records, columns, headerValues };
  };

  const downloadWithCurrentSettings = (targetRecords: DataGridRecord[], targetColumns: string[]) => {
    if (unknownEncodingBlocksExport) {
      setRepairError("文字コードを自動判定できないため、再解釈で文字コードを指定してから保存してください。");
      setDialog("reinterpret");
      return;
    }
    downloadCsv(targetRecords, targetColumns, {
      encoding: outputEncoding,
      lineEnding,
      includeBom: outputEncoding !== "shift_jis" && includeBom,
      quoteAll,
      quote: outputQuote,
      escapeMode: outputEscapeMode,
    });
  };

  const downloadInherited = (targetRecords: DataGridRecord[], targetColumns: string[]) => {
    if (inputSource !== "file" || !detectedEncoding || detectedEncoding === "unknown") {
      setRepairError("入力形式を引き継げる文字コードがありません。再解釈で文字コードを指定してください。");
      setDialog("reinterpret");
      return;
    }
    const inspection = fullFileTextRef.current
      ? inspectCsv(fullFileTextRef.current, settings)
      : parsed.inspection;
    downloadCsv(targetRecords, targetColumns, {
      encoding: detectedEncoding,
      lineEnding: lineEndingFromInspection(inspection.lineEnding),
      includeBom: detectedEncoding === "shift_jis" ? false : Boolean(fileHasBom),
      quoteAll,
      quote: settings.quote,
      escapeMode: settings.escapeMode,
      delimiter: inspection.delimiter,
    });
  };

  const downloadXlsxSafe = async (targetRecords: DataGridRecord[], targetColumns: string[]) => {
    setXlsxError("");
    const limits = checkXlsxLimits(targetRecords, targetColumns);
    if (limits.length) {
      setXlsxError(limits[0]);
      return;
    }
    const labels = targetColumns.map((column) => {
      const index = columns.indexOf(column);
      return index >= 0 ? headerValues[index] : column;
    });
    const bytes = await buildXlsxBuffer(targetRecords, targetColumns, labels);
    triggerDownload(bytes, `devsmith-data_${formatCsvTimestamp()}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };

  const updateInput = (value: string, source: CsvInputSource = "paste") => {
    setInput(value);
    setHasSource(true);
    setEditedRecords(null);
    setRepairError("");
    setRepairMessage("");
    setXlsxError("");
    setInputSource(source);
    if (source === "paste") {
      fileBytesRef.current = null;
      fullFileTextRef.current = null;
      setDetectedEncoding(null);
      setFileHasBom(null);
      setReplacementCount(0);
      setDetectionWarnings([]);
      setAsciiCompatible(false);
      setPreviewActive(false);
      setHiddenRecords(null);
      setSourceName("貼り付けデータ");
    }
    setLabelOverrides({});
  };

  const clearWorkspace = () => {
    if (!window.confirm("表示中のデータを閉じて最初の画面に戻ります。編集内容は破棄されます。よろしいですか？")) {
      return;
    }
    fileBytesRef.current = null;
    fullFileTextRef.current = null;
    setInput("");
    setHasSource(false);
    setSourceName("貼り付けデータ");
    setWorkspaceView("viewer");
    setDialog("none");
    setDownloadOpen(false);
    setShowDiagnostics(false);
    setEditedRecords(null);
    setSettings(defaultViewerSettings);
    setFileEncoding("auto");
    setDetectedEncoding(null);
    setFileHasBom(null);
    setInputSource("paste");
    setRepairError("");
    setRepairMessage("");
    setExcelSheets([]);
    setSelectedSheet("");
    setPreviewNotice("");
    setReplacementCount(0);
    setDetectionWarnings([]);
    setAsciiCompatible(false);
    setPreviewActive(false);
    setHiddenRecords(null);
    setXlsxError("");
    setLabelOverrides({});
    setOutputEncoding("utf-8");
    setLineEnding("\r\n");
    setIncludeBom(true);
    setQuoteAll(false);
    setOutputQuote('"');
    setOutputEscapeMode("double");
    setSplitPercent(42);
    setFullscreen(false);
    setSjisDialog(null);
    setPendingLargeFile(null);
    setPasteDraft("");
  };

  useEffect(() => {
    const storedValue = sessionStorage.getItem("devsmith:paste-anything:value");
    const storedType = sessionStorage.getItem("devsmith:paste-anything:type");
    if (storedValue && (storedType === "csv" || storedType === "tsv")) {
      sessionStorage.removeItem("devsmith:paste-anything:value");
      sessionStorage.removeItem("devsmith:paste-anything:type");
      const timer = window.setTimeout(() => {
        updateInput(storedValue, "paste");
        if (storedType === "tsv") setSettings((current) => ({ ...current, delimiter: "\t" }));
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const closeFullscreen = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", closeFullscreen);
    return () => window.removeEventListener("keydown", closeFullscreen);
  }, []);

  const applyDecodedFile = (decoded: ReturnType<typeof decodeCsvBytes>, previewOnly: boolean) => {
    fullFileTextRef.current = decoded.text;
    const fullParsed = parseCsvTable(decoded.text, settings);
    const split = splitPreviewRecords(fullParsed.records);
    const usePreview = previewOnly && split.previewApplied;
    setPreviewActive(usePreview);
    setHiddenRecords(usePreview ? split.hidden : null);
    updateInput(usePreview ? previewCsv(decoded.text, settings) : decoded.text, "file");
    setDetectedEncoding(decoded.encoding);
    setFileHasBom(decoded.hasBom);
    setReplacementCount(decoded.replacementCount);
    setDetectionWarnings(decoded.detectionWarnings);
    setAsciiCompatible(decoded.asciiCompatible);
    setPreviewNotice(usePreview
      ? `先頭${PREVIEW_ROW_LIMIT.toLocaleString()}行を表示しています（元ファイルは${fullParsed.records.length.toLocaleString()}行）。全件保存は元ファイル全件です。プレビュー中の編集は先頭${PREVIEW_ROW_LIMIT.toLocaleString()}行にだけ反映し、残りの行は未編集のまま保存します。`
      : "");
  };

  const decodeFile = (bytes: Uint8Array, encoding: CsvFileEncoding) => {
    applyDecodedFile(decodeCsvBytes(bytes, encoding), previewActive);
  };

  const reinterpret = () => {
    if (fileBytesRef.current) decodeFile(fileBytesRef.current, fileEncoding);
    setDialog("none");
  };

  const repairMojibake = () => {
    const result = repairUtf8ReadAsShiftJis(input);
    const unrepaired = result.failures.slice(0, 8).map((failure) => `${failure.row}行目,${failure.column}列`).join(" / ");
    const remaining = result.failures.length > 8 ? ` ほか${result.failures.length - 8}件` : "";
    updateInput(result.text, inputSource);
    setRepairError("");
    if (result.repairedCount && result.failures.length) {
      setRepairMessage(`可能な範囲を修復しました（${result.repairedCount}件）。一部修復できませんでした。（${unrepaired}${remaining}）`);
    } else if (result.repairedCount) {
      setRepairMessage(`UTF-8をShift_JISとして誤読した文字化けを${result.repairedCount}件修復しました。`);
    } else if (result.failures.length) {
      setRepairMessage(`修復できる文字化けはありませんでした。一部修復できませんでした。（${unrepaired}${remaining}）`);
    } else {
      setRepairMessage("修復対象の文字化けは見つかりませんでした。");
    }
  };

  const loadSample = (value: string) => {
    if (!confirmDiscardEdits(dirty)) return;
    fileBytesRef.current = null;
    setDetectedEncoding(null);
    setFileHasBom(null);
    setExcelSheets([]);
    setSelectedSheet("");
    setPreviewNotice("");
    setReplacementCount(0);
    setDetectionWarnings([]);
    setAsciiCompatible(false);
    setPreviewActive(false);
    setHiddenRecords(null);
    fullFileTextRef.current = null;
    setLabelOverrides({});
    updateInput(value, "paste");
    setDialog("none");
  };

  const loadExcelFile = async (file: File, previewOnly: boolean) => {
    const excelJsModule = await import("exceljs");
    const ExcelJS = excelJsModule.default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheets = workbook.worksheets.map((worksheet) => {
      const rows: string[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (previewOnly && rowNumber > PREVIEW_ROW_LIMIT + 1) return;
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows.push(values.map(excelCellToText));
      });
      return { name: worksheet.name, csv: rowsToCsv(rows) };
    });
    if (!sheets.length) throw new Error("読み込めるシートがありません。");
    setExcelSheets(sheets);
    setSourceName(file.name);
    fileBytesRef.current = null;
    setDetectedEncoding(null);
    setFileHasBom(null);
    setReplacementCount(0);
    setSettings((currentSettings) => ({ ...currentSettings, delimiter: ",", quote: '"', escapeMode: "double" }));
    if (sheets.length === 1) {
      setSelectedSheet(sheets[0].name);
      updateInput(sheets[0].csv, "xlsx");
    } else {
      setSelectedSheet("");
      updateInput("", "xlsx");
      setPreviewNotice(`このExcelには${sheets.length}シートあります。読み込むシートを選択してください。最初のシートは自動選択しません。`);
    }
  };

  const processFile = async (file: File, previewOnly = false) => {
    setLoading(true);
    loadCancelledRef.current = false;
    setRepairError("");
    setPreviewNotice("");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      if (loadCancelledRef.current) return;
      const blocked = spreadsheetOpenError(file.name);
      if (blocked) throw new Error(blocked);
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      setSourceName(file.name);
      if (extension === "xlsx") {
        await loadExcelFile(file, previewOnly);
        if (previewOnly) {
          setPreviewNotice(`大容量Excelの各シート先頭${PREVIEW_ROW_LIMIT.toLocaleString()}行だけを表示しています。全件保存は選択シートの読み込み済み範囲です。`);
        }
        return;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (loadCancelledRef.current) return;
      fileBytesRef.current = bytes;
      applyDecodedFile(decodeCsvBytes(bytes, fileEncoding), previewOnly);
      setExcelSheets([]);
      setSelectedSheet("");
    } catch (error) {
      setRepairError(error instanceof Error ? error.message : "ファイルを読み込めませんでした。");
    } finally {
      setLoading(false);
      setPendingLargeFile(null);
    }
  };

  const selectFile = (file: File) => {
    const blocked = spreadsheetOpenError(file.name);
    if (blocked) {
      setRepairError(blocked);
      return;
    }
    if (file.size >= LARGE_FILE_WARNING_BYTES) {
      setPendingLargeFile(file);
      return;
    }
    void processFile(file);
  };

  const openFile = (file: File) => {
    if (!confirmDiscardEdits(dirty)) return;
    selectFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) openFile(file);
  };

  const applyPaste = () => {
    if (!confirmDiscardEdits(dirty)) return;
    updateInput(pasteDraft, "paste");
    setPasteDraft("");
    setDialog("none");
    setExcelSheets([]);
    setSelectedSheet("");
  };

  const diagnostics = [
    { ok: structureIssues.length === 0, label: "CSV構造", detail: structureIssues.length ? `${structureIssues.length}件` : "正常" },
    { ok: encodingIssues.length === 0, label: "文字コード", detail: encodingIssues.length ? `${encodingIssues.length}件` : "正常" },
    { ok: excelRiskSummary.kinds === 0, label: "Excelリスク", detail: excelRiskSummary.kinds ? `${excelRiskSummary.kinds}種類` : "なし", warn: excelRiskSummary.kinds > 0 },
    { ok: sjisUnmappable.length === 0, label: "Shift_JIS変換不可", detail: sjisUnmappable.length ? `${sjisUnmappable.length}セル` : "なし", warn: sjisUnmappable.length > 0 },
    { ok: injectionCount === 0, label: "CSV Injection", detail: injectionCount ? `${injectionCount}件` : "なし", warn: injectionCount > 0 },
  ];

  return (
    <ToolShell
      slug="csv-viewer-beta"
      category="データ"
      title="CSV Viewer Beta"
      description="CSVを開いて中身を見る次期Viewerです。正式版の解析を再利用し、Gridを主役にしています。"
      functionCount={1}
    >
      <div className={`csv-workspace-beta ${fullscreen ? "is-fullscreen" : ""}`}>
        <header className="csv-ws-banner">
          <strong>BETA</strong>
          <p>Grid中心の次期UIです。解析は正式版と同じです。</p>
          <Link href="/tools/csv-viewer">正式版を開く</Link>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) openFile(file);
            event.currentTarget.value = "";
          }}
        />

        {!hasSource ? (
          <section
            className={`csv-ws-empty ${dragging ? "is-dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
            onDrop={handleDrop}
          >
            <FileSpreadsheet size={28} />
            <h2>CSV / TSV / XLSXをドロップ</h2>
            <p>この領域が、読込後のViewerになります。</p>
            <div className="csv-ws-empty-actions">
              <button type="button" className="primary" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} />ファイルを選択
              </button>
              <button type="button" onClick={() => { setPasteDraft(""); setDialog("paste"); }}>
                CSVを貼り付け
              </button>
              <button type="button" onClick={() => setDialog("samples")}>サンプルを試す</button>
            </div>
          </section>
        ) : (
          <section
            className={`csv-ws-frame ${dragging ? "is-dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
            onDrop={handleDrop}
          >
            <header className="csv-ws-header">
              <div className="csv-ws-title-row">
                <strong className="csv-ws-filename">{filenameLabel}</strong>
                <div className="csv-ws-header-tools">
                  <div className="csv-ws-tabs" role="tablist" aria-label="表示">
                    <button type="button" role="tab" aria-selected={workspaceView === "viewer"} className={workspaceView === "viewer" ? "active" : ""} onClick={() => setWorkspaceView("viewer")}>Viewer</button>
                    <button type="button" role="tab" aria-selected={workspaceView === "raw"} className={workspaceView === "raw" ? "active" : ""} onClick={() => setWorkspaceView("raw")}>Raw</button>
                    <button type="button" role="tab" aria-selected={workspaceView === "split"} className={workspaceView === "split" ? "active" : ""} onClick={() => setWorkspaceView("split")}>
                      <Columns2 size={13} />左右
                    </button>
                  </div>
                  <div className="csv-ws-actions">
                    <button type="button" onClick={() => setDialog("reinterpret")}>再解釈</button>
                    <button type="button" onClick={() => fileInputRef.current?.click()}>別ファイルを開く</button>
                    <div className="csv-ws-download">
                      <button type="button" onClick={() => setDownloadOpen((open) => !open)} aria-expanded={downloadOpen}>
                        <Download size={14} />Download
                        <ChevronDown size={14} />
                      </button>
                      {downloadOpen && (
                        <div className="csv-ws-menu" role="menu">
                          <button type="button" disabled={unknownEncodingBlocksExport} onClick={() => { const full = recordsForFullExport(); downloadCsv(full.records, full.columns, utf8CsvPreset); setDownloadOpen(false); }}>UTF-8 CSV</button>
                          <button type="button" disabled={unknownEncodingBlocksExport} onClick={() => { const full = recordsForFullExport(); downloadCsv(full.records, full.columns, excelOrientedCsvPreset); setDownloadOpen(false); }}>Excel向けCSV</button>
                          <button type="button" disabled={unknownEncodingBlocksExport} onClick={() => { const full = recordsForFullExport(); void downloadXlsxSafe(full.records, full.columns); setDownloadOpen(false); }}>XLSX</button>
                          {inputSource === "file" && (
                            <button type="button" onClick={() => { const full = recordsForFullExport(); downloadInherited(full.records, full.columns); setDownloadOpen(false); }}>入力形式を引き継いで保存</button>
                          )}
                          <button type="button" onClick={() => { setDialog("output"); setDownloadOpen(false); }}>詳細な出力設定</button>
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setFullscreen((current) => !current)}>
                      {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      {fullscreen ? "縮小" : "全画面"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="csv-ws-meta-row">
                <p className="csv-ws-detected">{detectedLine}</p>
              </div>
              {unknownEncoding && (
                <div className="csv-ws-alert">
                  <strong>⚠ 文字コードを自動判定できませんでした</strong>
                  <button type="button" onClick={() => setDialog("reinterpret")}>文字コードを指定して再解釈</button>
                </div>
              )}
              {looksMojibake && (
                <div className="csv-ws-alert">
                  <strong>⚠ 文字化けの可能性があります</strong>
                  <button type="button" onClick={repairMojibake}>修復を試す</button>
                </div>
              )}
              {excelSheets.length > 1 && (
                <label className="csv-ws-sheet">
                  このExcelには{excelSheets.length}シートあります
                  <select
                    value={selectedSheet}
                    onChange={(event) => {
                      const sheet = excelSheets.find((item) => item.name === event.target.value);
                      setSelectedSheet(event.target.value);
                      if (sheet) updateInput(sheet.csv, "xlsx");
                    }}
                  >
                    <option value="">シートを選択</option>
                    {excelSheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}
                  </select>
                </label>
              )}
              {(previewNotice || repairMessage) && <p className="csv-ws-notice">{previewNotice || repairMessage}</p>}
            </header>

            <div
              className={`csv-ws-stage ${workspaceView === "split" ? "is-split" : ""}`}
              style={workspaceView === "split"
                ? {
                    ["--csv-ws-split-left" as string]: `${splitPercent}fr`,
                    ["--csv-ws-split-right" as string]: `${100 - splitPercent}fr`,
                  }
                : undefined}
            >
              {workspaceView !== "viewer" && (
                <section className="csv-ws-raw" aria-label="現在のデータのRaw">
                  <p>現在のデータのRawです。元ファイルそのものではありません。Gridの編集が反映されます。読み取り専用です。</p>
                  <textarea readOnly value={workingRaw} spellCheck={false} aria-label="現在のデータのRaw" />
                </section>
              )}
              {workspaceView === "split" && (
                <div
                  className="csv-ws-split-resizer"
                  role="separator"
                  aria-label="RawとGridの幅を変更"
                  aria-orientation="vertical"
                  aria-valuemin={25}
                  aria-valuemax={75}
                  aria-valuenow={Math.round(splitPercent)}
                  onPointerDown={(event) => {
                    const container = event.currentTarget.parentElement;
                    if (!container) return;
                    const bounds = container.getBoundingClientRect();
                    const move = (pointerEvent: PointerEvent) => {
                      const next = ((pointerEvent.clientX - bounds.left) / bounds.width) * 100;
                      setSplitPercent(Math.max(25, Math.min(75, next)));
                    };
                    const stop = () => {
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", stop);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", stop);
                  }}
                />
              )}
              {workspaceView !== "raw" && (
                <DataGrid
                  records={records}
                  editable
                  enableDuplicateValidation
                  enableRowDelete
                  enableColumnRename
                  onRenameColumn={(column, nextLabel) => {
                    setLabelOverrides((current) => ({ ...current, [column]: nextLabel }));
                  }}
                  columnLabels={columnLabels}
                  exportSplit
                  allExportCount={hiddenRecords?.length ? records.length + hiddenRecords.length : undefined}
                  onRecordsChange={setEditedRecords}
                  onReset={clearWorkspace}
                  resetTitle="表示中のデータを閉じて最初の画面に戻ります"
                  csvSerializer={(targetRecords, targetColumns, includeHeader) =>
                    serializeOutput(targetRecords, targetColumns, includeHeader)
                  }
                  onDownloadAllCsv={() => {
                    const full = recordsForFullExport();
                    downloadWithCurrentSettings(full.records, full.columns);
                  }}
                  onDownloadCsv={downloadWithCurrentSettings}
                  onDownloadAllXlsx={() => {
                    const full = recordsForFullExport();
                    void downloadXlsxSafe(full.records, full.columns);
                  }}
                  onDownloadXlsx={(downloadRecords, downloadColumns) => void downloadXlsxSafe(downloadRecords, downloadColumns)}
                  emptyMessage={excelSheets.length > 1 && !selectedSheet ? "シートを選択してください" : "CSVの行がありません"}
                />
              )}
              {dragging && <div className="csv-ws-drop-overlay">別ファイルをドロップ</div>}
            </div>
            <footer className={`csv-ws-footer ${hasProblems ? "has-warn" : "all-ok"}`}>
              <div className={`csv-ws-diag ${hasProblems ? "has-warn" : "all-ok"}`}>
                {hasProblems ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                <span>{hasProblems ? `${Math.max(problemCount, uniqueWarnings.length || 1)}件の問題` : "問題は見つかりませんでした"}</span>
                {hasProblems && (
                  <button type="button" onClick={() => setShowDiagnostics((open) => !open)}>
                    {showDiagnostics ? "詳細を閉じる" : "詳細を見る"}
                  </button>
                )}
              </div>
              {showDiagnostics && hasProblems && (
                <div className="csv-ws-diag-details">
                  <ul>
                    {diagnostics.map((item) => (
                      <li key={item.label} className={item.ok ? "ok" : item.warn ? "warn" : "error"}>
                        {item.ok ? "✓" : "⚠"} {item.label} {item.detail}
                      </li>
                    ))}
                  </ul>
                  {uniqueWarnings.length > 0 && (
                    <ul className="csv-ws-warning-list">
                      {uniqueWarnings.slice(0, 6).map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </footer>
          </section>
        )}

        {loading && (
          <div className="csv-ws-loading" role="status">
            <LoaderCircle size={18} />
            ファイルを読み込んでいます…
            <button type="button" onClick={() => { loadCancelledRef.current = true; setLoading(false); }}>キャンセル</button>
          </div>
        )}
      </div>

      <ToolStatus error={hasSource ? (parsed.error || repairError || xlsxError) : (repairError || xlsxError)}>
        {parsed.error || !hasSource
          ? undefined
          : `${records.length}行を読み込みました。編集内容はブラウザ内だけに保持されます${asciiCompatible && inputSource === "file" ? " · ASCII互換" : ""}`}
      </ToolStatus>

      {dialog === "paste" && (
        <div className="csv-ws-backdrop" role="presentation">
          <section className="csv-ws-dialog" role="dialog" aria-modal="true" aria-labelledby="csv-ws-paste-title">
            <h2 id="csv-ws-paste-title">CSVを貼り付け</h2>
            <p>貼り付けテキストに元の文字コード・BOMはありません。判定対象外として読みます。</p>
            <textarea value={pasteDraft} onChange={(event) => setPasteDraft(event.target.value)} spellCheck={false} placeholder="ヘッダーを含むCSVを貼り付け" aria-label="貼り付けCSV" />
            <div className="csv-ws-dialog-actions">
              <button type="button" onClick={() => setDialog("none")}>キャンセル</button>
              <button type="button" className="primary" onClick={applyPaste}>読み込む</button>
            </div>
          </section>
        </div>
      )}

      {dialog === "samples" && (
        <div className="csv-ws-backdrop" role="presentation">
          <section className="csv-ws-dialog" role="dialog" aria-modal="true" aria-labelledby="csv-ws-sample-title">
            <h2 id="csv-ws-sample-title">サンプルを試す</h2>
            <div className="csv-ws-sample-list">
              <button type="button" onClick={() => loadSample(csvViewerSample)}>基本</button>
              <button type="button" onClick={() => loadSample(csvViewerJapaneseSample)}>日本語</button>
              <button type="button" onClick={() => loadSample(csvViewerComplexSample)}>複雑</button>
            </div>
            <div className="csv-ws-dialog-actions">
              <button type="button" onClick={() => setDialog("none")}>閉じる</button>
            </div>
          </section>
        </div>
      )}

      {dialog === "reinterpret" && (
        <div className="csv-ws-backdrop" role="presentation">
          <section className="csv-ws-dialog csv-ws-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="csv-ws-reinterpret-title">
            <h2 id="csv-ws-reinterpret-title">再解釈</h2>
            <p className="csv-ws-dialog-lead">開いているデータを、別の読み方でもう一度読み込みます。文字化けや列のずれがあるときだけ変えてください。</p>
            <fieldset className="csv-ws-settings">
              <label>
                文字コード
                <select value={fileEncoding} onChange={(event) => setFileEncoding(event.target.value as CsvFileEncoding)}>
                  <option value="auto">自動判定</option>
                  <option value="utf-8">UTF-8</option>
                  <option value="shift_jis">Shift_JIS（日本語Windows）</option>
                  <option value="utf-16le">UTF-16LE（リトルエンディアン）</option>
                  <option value="utf-16be">UTF-16BE（ビッグエンディアン）</option>
                </select>
                <small className="csv-ws-hint">文字の読み方です。文字化けするときだけ指定します。</small>
              </label>
              <label>
                区切り文字
                <select value={settings.delimiter} onChange={(event) => setSettings((current) => ({ ...current, delimiter: event.target.value as CsvDelimiterSetting }))}>
                  <option value="auto">自動判定</option>
                  <option value=",">カンマ（,）</option>
                  <option value={"\t"}>タブ</option>
                  <option value=";">セミコロン（;）</option>
                  <option value="|">縦棒（|）</option>
                  <option value=" ">スペース</option>
                </select>
                <small className="csv-ws-hint">列と列のあいだの記号です。</small>
              </label>
              <label>
                囲み文字
                <select value={settings.quote} onChange={(event) => setSettings((current) => ({ ...current, quote: event.target.value as CsvQuote }))}>
                  <option value={'"'}>ダブルクォート（&quot;）</option>
                  <option value="'">シングルクォート（&apos;）</option>
                  <option value="">なし</option>
                </select>
                <small className="csv-ws-hint">値を囲んでいる記号です。通常はダブルクォートです。</small>
              </label>
              <label>
                囲み文字のエスケープ
                <select value={settings.escapeMode} onChange={(event) => setSettings((current) => ({ ...current, escapeMode: event.target.value as CsvEscapeMode }))}>
                  <option value="double">二重化（&quot;&quot;）</option>
                  <option value="backslash">バックスラッシュ（\&quot;）</option>
                </select>
                <small className="csv-ws-hint">囲み文字そのものを値に書くときの逃げ方です。</small>
              </label>
              <label>
                ヘッダー行
                <BoundedNumberInput value={settings.headerRow} min={1} max={100000} onCommit={(value) => setSettings((current) => ({ ...current, headerRow: value, dataStartRow: Math.max(current.dataStartRow, value + 1) }))} />
                <small className="csv-ws-hint">列名が書いてある行番号です。</small>
              </label>
              <label>
                読込開始行
                <BoundedNumberInput value={settings.dataStartRow} min={settings.headerRow + 1} max={100001} onCommit={(value) => setSettings((current) => ({ ...current, dataStartRow: value }))} />
                <small className="csv-ws-hint">データとして読み始める行です。</small>
              </label>
              <div className="csv-ws-settings-checks">
                <label className="csv-check">
                  <span className="csv-ws-check-line">
                    <input type="checkbox" checked={settings.skipEmptyLines} onChange={(event) => setSettings((current) => ({ ...current, skipEmptyLines: event.target.checked }))} />
                    空行を読み飛ばす
                  </span>
                  <small className="csv-ws-hint">何も書いていない行は無視します。</small>
                </label>
                <label className="csv-check">
                  <span className="csv-ws-check-line">
                    <input type="checkbox" checked={settings.trimFields} onChange={(event) => setSettings((current) => ({ ...current, trimFields: event.target.checked }))} />
                    前後の空白を削除
                  </span>
                  <small className="csv-ws-hint">値の前後にあるスペースを取り除きます。</small>
                </label>
              </div>
            </fieldset>
            <div className="csv-ws-dialog-actions">
              <button type="button" onClick={() => setDialog("none")}>キャンセル</button>
              <button type="button" className="primary" onClick={reinterpret}>再読込</button>
            </div>
          </section>
        </div>
      )}

      {dialog === "output" && (
        <div className="csv-ws-backdrop" role="presentation">
          <section className="csv-ws-dialog csv-ws-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="csv-ws-output-title">
            <h2 id="csv-ws-output-title">詳細な出力設定</h2>
            <p className="csv-ws-dialog-lead">保存するときの書き方です。開いているデータの読み方は変わりません。</p>
            <fieldset className="csv-ws-settings">
              <label>
                出力文字コード
                <select value={outputEncoding} onChange={(event) => {
                  const next = event.target.value as CsvOutputEncoding;
                  setOutputEncoding(next);
                  if (next === "utf-16le" || next === "utf-16be") setIncludeBom(true);
                }}>
                  <option value="utf-8">UTF-8</option>
                  <option value="shift_jis">Shift_JIS（日本語Windows）</option>
                  <option value="utf-16le">UTF-16LE（リトルエンディアン）</option>
                  <option value="utf-16be">UTF-16BE（ビッグエンディアン）</option>
                </select>
                <small className="csv-ws-hint">保存ファイルの文字の書き方です。</small>
              </label>
              <label>
                改行コード
                <select value={lineEnding} onChange={(event) => setLineEnding(event.target.value as CsvLineEnding)}>
                  <option value={"\r\n"}>CRLF（Windows）</option>
                  <option value={"\n"}>LF（macOS / Linux）</option>
                  <option value={"\r"}>CR</option>
                </select>
                <small className="csv-ws-hint">行の終わりの記号です。ExcelならCRLFが無難です。</small>
              </label>
              <label>
                囲み文字
                <select value={outputQuote} onChange={(event) => setOutputQuote(event.target.value as CsvQuote)}>
                  <option value={'"'}>ダブルクォート（&quot;）</option>
                  <option value="'">シングルクォート（&apos;）</option>
                  <option value="">なし</option>
                </select>
                <small className="csv-ws-hint">値を囲んで書き出す記号です。</small>
              </label>
              <label>
                囲み文字のエスケープ
                <select value={outputEscapeMode} onChange={(event) => setOutputEscapeMode(event.target.value as CsvEscapeMode)}>
                  <option value="double">二重化（&quot;&quot;）</option>
                  <option value="backslash">バックスラッシュ（\&quot;）</option>
                </select>
                <small className="csv-ws-hint">囲み文字そのものを値に書くときの逃げ方です。</small>
              </label>
              <div className="csv-ws-settings-checks">
                <label className="csv-check">
                  <span className="csv-ws-check-line">
                    <input type="checkbox" checked={includeBom} disabled={outputEncoding === "shift_jis"} onChange={(event) => setIncludeBom(event.target.checked)} />
                    {outputEncoding.startsWith("utf-16") ? "UTF-16 BOMを付ける" : "UTF-8 BOMを付ける"}
                  </span>
                  <small className="csv-ws-hint">Excelで文字化けしにくくする印です。</small>
                </label>
                <label className="csv-check">
                  <span className="csv-ws-check-line">
                    <input type="checkbox" checked={quoteAll} disabled={!outputQuote} onChange={(event) => setQuoteAll(event.target.checked)} />
                    すべての値を囲む
                  </span>
                  <small className="csv-ws-hint">カンマを含まない値も囲み文字で囲みます。</small>
                </label>
              </div>
            </fieldset>
            <p className="csv-output-note">{lineEndingToken(lineEnding)} · {outputEncoding}</p>
            <div className="csv-ws-dialog-actions">
              <button type="button" onClick={() => setDialog("none")}>閉じる</button>
            </div>
          </section>
        </div>
      )}

      {pendingLargeFile && (
        <div className="csv-ws-backdrop" role="presentation">
          <section className="csv-ws-dialog" role="dialog" aria-modal="true" aria-labelledby="csv-ws-large-title">
            <FileWarning size={24} />
            <h2 id="csv-ws-large-title">大容量ファイルです</h2>
            <p>{pendingLargeFile.name}（{(pendingLargeFile.size / 1024 / 1024).toFixed(1)}MB）。10MB以上で注意しています。</p>
            <div className="csv-ws-dialog-actions">
              <button type="button" onClick={() => setPendingLargeFile(null)}>キャンセル</button>
              <button type="button" onClick={() => void processFile(pendingLargeFile, true)}>先頭{PREVIEW_ROW_LIMIT.toLocaleString()}行</button>
              <button type="button" className="primary" onClick={() => void processFile(pendingLargeFile)}>全件読み込む</button>
            </div>
          </section>
        </div>
      )}

      {sjisDialog && (
        <div className="csv-ws-backdrop" role="presentation">
          <section className="csv-ws-dialog" role="dialog" aria-modal="true" aria-labelledby="csv-ws-sjis-title">
            <AlertTriangle size={24} />
            <h2 id="csv-ws-sjis-title">Shift_JISに変換できない文字が{sjisDialog.unmappable.length}件あります</h2>
            <ul>
              {sjisDialog.unmappable.slice(0, 8).map((item, index) => (
                <li key={`${item.row}-${item.column}-${item.char}-${index}`}>
                  {item.row ? `${item.row}行` : "位置不明"}
                  {item.column ? ` / ${columnLabels[columns[item.column - 1]] ?? `${item.column}列`}` : ""}
                  <code>{item.char}</code>
                </li>
              ))}
            </ul>
            <div className="csv-ws-dialog-actions">
              <button type="button" onClick={() => {
                downloadCsv(sjisDialog.records, sjisDialog.columns, utf8CsvPreset);
                setSjisDialog(null);
              }}>UTF-8で保存</button>
              <button type="button" onClick={() => {
                downloadCsv(sjisDialog.records, sjisDialog.columns, {
                  encoding: "shift_jis",
                  lineEnding,
                  includeBom: false,
                  quoteAll,
                  quote: outputQuote,
                  escapeMode: outputEscapeMode,
                  replaceUnmappable: true,
                });
                setSjisDialog(null);
              }}>置換して続行</button>
              <button type="button" className="primary" onClick={() => setSjisDialog(null)}>キャンセル</button>
            </div>
          </section>
        </div>
      )}
    </ToolShell>
  );
}
