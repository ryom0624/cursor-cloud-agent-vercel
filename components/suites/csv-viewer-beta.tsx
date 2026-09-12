"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Columns2,
  FileSpreadsheet,
  FileWarning,
  LoaderCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sheet,
  Upload,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoundedNumberInput } from "@/components/bounded-number-input";
import { DataGrid, type DataGridRecord } from "@/components/data-grid";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  buildXlsxBuffer,
  checkXlsxLimits,
  countCsvInjectionValues,
  decodeCsvBytes,
  defaultViewerSettings,
  delimiterLabel,
  delimiterToken,
  diagnoseExcelRisks,
  encodeCsvText,
  encodingLabel,
  excelCellToText,
  excelOrientedCsvPreset,
  findSjisUnmappableInRecords,
  formatCsvOutputMeta,
  formatCsvTimestamp,
  inspectCsv,
  lineEndingToken,
  locateReplacementCharacters,
  parseCsvTable,
  repairUtf8ReadAsShiftJis,
  rowsToCsv,
  serializeCsv,
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

const LARGE_FILE_WARNING_BYTES = 10 * 1024 * 1024;
const PREVIEW_ROW_LIMIT = 10_000;

type ExcelSheet = { name: string; csv: string };

function previewCsv(text: string, settings: ViewerSettings): string {
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

export function CsvViewerBetaSuite() {
  const [input, setInput] = useState(csvViewerSample);
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
  const [viewerMode, setViewerMode] = useState<"simple" | "pro">("simple");
  const [repairError, setRepairError] = useState("");
  const [repairMessage, setRepairMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingLargeFile, setPendingLargeFile] = useState<File | null>(null);
  const [excelSheets, setExcelSheets] = useState<ExcelSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [fullscreenMode, setFullscreenMode] = useState<"none" | "output" | "split">("none");
  const [previewNotice, setPreviewNotice] = useState("");
  const [replacementCount, setReplacementCount] = useState(0);
  const [sjisDialog, setSjisDialog] = useState<{
    unmappable: SjisUnmappable[];
    records: DataGridRecord[];
    columns: string[];
  } | null>(null);
  const [xlsxError, setXlsxError] = useState("");
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const fileBytesRef = useRef<Uint8Array | null>(null);
  const parsed = useMemo(() => parseCsvTable(input, settings), [input, settings]);
  const records = editedRecords ?? parsed.records;
  const columns = useMemo(() => {
    const extraColumns = recordColumns(records).filter((column) => !parsed.columns.includes(column));
    return [...parsed.columns, ...extraColumns];
  }, [parsed.columns, records]);
  const headerValues = columns.map((column, index) => parsed.headerValues[index] ?? column);
  const columnLabels = useMemo(() => ({
    ...parsed.columnLabels,
    ...Object.fromEntries(
      columns.filter((column) => !parsed.columns.includes(column)).map((column) => [column, column]),
    ),
  }), [columns, parsed.columnLabels, parsed.columns]);
  const usingCustomSettings = settings.delimiter !== "auto"
    || settings.quote !== '"'
    || settings.escapeMode !== "double"
    || settings.trimFields
    || !settings.skipEmptyLines
    || settings.headerRow !== 1
    || settings.dataStartRow !== 2
    || fileEncoding !== "auto"
    || outputEncoding !== "utf-8"
    || lineEnding !== "\r\n"
    || !includeBom
    || quoteAll
    || outputQuote !== '"'
    || outputEscapeMode !== "double";
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
    ...(injectionCount ? [`表計算ソフトで数式として実行され得る値が${injectionCount}件あります。値は変更していません。`] : []),
    ...encodingIssues,
    ...(excelRowOverflow ? ["Excel向けCSVは1,048,576行を超えるとExcelで完全表示できない可能性があります。"] : []),
    ...(xlsxLimitErrors.length ? xlsxLimitErrors : []),
  ];
  const uniqueWarnings = Array.from(new Set(extraWarnings));

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
    const mimeEncoding = options.encoding === "shift_jis" ? "shift_jis" : "utf-8";
    triggerDownload(encoded.bytes, `devsmith-data_${formatCsvTimestamp()}.csv`, `text/csv;charset=${mimeEncoding}`);
  };

  const downloadWithCurrentSettings = (targetRecords: DataGridRecord[], targetColumns: string[]) =>
    downloadCsv(targetRecords, targetColumns, {
      encoding: outputEncoding,
      lineEnding,
      includeBom: outputEncoding === "utf-8" && includeBom,
      quoteAll,
      quote: outputQuote,
      escapeMode: outputEscapeMode,
    });

  const downloadInherited = (targetRecords: DataGridRecord[], targetColumns: string[]) => {
    if (inputSource !== "file" || !detectedEncoding) return;
    const inheritedEncoding: CsvOutputEncoding = detectedEncoding === "shift_jis" ? "shift_jis" : "utf-8";
    downloadCsv(targetRecords, targetColumns, {
      encoding: inheritedEncoding,
      lineEnding: lineEndingFromInspection(parsed.inspection.lineEnding),
      includeBom: inheritedEncoding === "utf-8" && Boolean(fileHasBom),
      quoteAll,
      quote: settings.quote,
      escapeMode: settings.escapeMode,
      delimiter: parsed.inspection.delimiter,
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
    setEditedRecords(null);
    setRepairError("");
    setRepairMessage("");
    setXlsxError("");
    setInputSource(source);
    if (source === "paste") {
      fileBytesRef.current = null;
      setDetectedEncoding(null);
      setFileHasBom(null);
      setReplacementCount(0);
    }
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
      if (event.key === "Escape") setFullscreenMode("none");
    };
    window.addEventListener("keydown", closeFullscreen);
    return () => window.removeEventListener("keydown", closeFullscreen);
  }, []);

  const decodeFile = (bytes: Uint8Array, encoding: CsvFileEncoding) => {
    const decoded = decodeCsvBytes(bytes, encoding);
    updateInput(decoded.text, "file");
    setDetectedEncoding(decoded.encoding);
    setFileHasBom(decoded.hasBom);
    setReplacementCount(decoded.replacementCount);
  };

  const changeFileEncoding = (encoding: CsvFileEncoding) => {
    setFileEncoding(encoding);
    if (fileBytesRef.current) decodeFile(fileBytesRef.current, encoding);
  };

  const repairMojibake = () => {
    const result = repairUtf8ReadAsShiftJis(input);
    const unrepaired = result.failures
      .slice(0, 8)
      .map((failure) => `${failure.row}行目,${failure.column}列`)
      .join(" / ");
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
    fileBytesRef.current = null;
    setDetectedEncoding(null);
    setFileHasBom(null);
    setExcelSheets([]);
    setSelectedSheet("");
    setPreviewNotice("");
    setReplacementCount(0);
    updateInput(value, "paste");
  };

  const loadExcelFile = async (file: File, previewOnly: boolean) => {
    const excelJsModule = await import("exceljs");
    const ExcelJS = excelJsModule.default;
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
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
      setPreviewNotice("複数シートがあります。読み込むシートを選択してください。最初のシートは自動選択しません。");
    }
  };

  const processFile = async (file: File, previewOnly = false) => {
    setLoading(true);
    setRepairError("");
    setPreviewNotice("");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (["xlsm", "xlsb", "xlam", "xls"].includes(extension)) {
        throw new Error("マクロ・バイナリ形式は安全のため読み込めません。.xlsxへ保存してから開いてください。");
      }
      if (extension === "xlsx") {
        await loadExcelFile(file, previewOnly);
        if (previewOnly) setPreviewNotice(`大容量Excelの各シート先頭${PREVIEW_ROW_LIMIT.toLocaleString()}行だけを表示しています。`);
        return;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      fileBytesRef.current = bytes;
      const decoded = decodeCsvBytes(bytes, fileEncoding);
      const text = previewOnly ? previewCsv(decoded.text, settings) : decoded.text;
      updateInput(text, "file");
      setDetectedEncoding(decoded.encoding);
      setFileHasBom(decoded.hasBom);
      setReplacementCount(decoded.replacementCount);
      setExcelSheets([]);
      setSelectedSheet("");
      if (previewOnly) setPreviewNotice(`大容量ファイルの先頭${PREVIEW_ROW_LIMIT.toLocaleString()}行だけを表示しています。`);
    } catch (error) {
      setRepairError(error instanceof Error ? error.message : "ファイルを読み込めませんでした。");
    } finally {
      setLoading(false);
      setPendingLargeFile(null);
    }
  };

  const selectFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (["xlsm", "xlsb", "xlam", "xls"].includes(extension)) {
      setRepairError("マクロ・バイナリ形式は安全のため読み込めません。.xlsxへ保存してから開いてください。");
      return;
    }
    if (file.size >= LARGE_FILE_WARNING_BYTES) {
      setPendingLargeFile(file);
      return;
    }
    void processFile(file);
  };

  const detectedItems = inputSource === "paste"
    ? [
      "入力: 貼り付けテキスト",
      "文字コード: 判定対象外",
      "BOM: 判定対象外",
      `区切り: ${delimiterLabel(parsed.inspection.delimiter).replace("区切り", "")}`,
      `現在の改行: ${parsed.inspection.lineEnding}`,
      `${records.length.toLocaleString()} rows`,
      `${columns.length} columns`,
    ]
    : inputSource === "xlsx"
      ? [
        "入力: XLSX",
        "文字コード: 判定対象外",
        "BOM: 判定対象外",
        delimiterLabel(parsed.inspection.delimiter),
        parsed.inspection.lineEnding,
        `${records.length.toLocaleString()} rows`,
        `${columns.length} columns`,
      ]
      : [
        encodingLabel(detectedEncoding, inputSource),
        fileHasBom ? "BOMあり" : "BOMなし",
        delimiterLabel(parsed.inspection.delimiter),
        parsed.inspection.lineEnding,
        `${records.length.toLocaleString()} rows`,
        `${columns.length} columns`,
      ];

  const validationSummary = [
    { ok: structureIssues.length === 0, label: "CSV構造", detail: structureIssues.length ? `${structureIssues.length}件` : "" },
    { ok: encodingIssues.length === 0, label: "文字コード", detail: encodingIssues.length ? `${encodingIssues.length}件` : "" },
    { ok: excelRiskSummary.kinds === 0, label: "Excel変換リスク", detail: excelRiskSummary.kinds ? `${excelRiskSummary.kinds}種類` : "", warn: excelRiskSummary.kinds > 0 },
    { ok: sjisUnmappable.length === 0, label: "Shift_JIS変換不可", detail: sjisUnmappable.length ? `${sjisUnmappable.length}セル` : "", warn: sjisUnmappable.length > 0 },
    { ok: injectionCount === 0, label: "CSV Injection", detail: injectionCount ? `${injectionCount}件` : "", warn: injectionCount > 0 },
  ];

  return (
    <ToolShell
      slug="csv-viewer-beta"
      category="データ"
      title="CSV Viewer Beta"
      description="現行CSV Viewerを基準にした次期版です。解析・変換の安全性を改善しています。"
      functionCount={1}
      tabs={[
        { id: "simple", label: "Simple" },
        { id: "pro", label: "Pro" },
      ]}
      activeTab={viewerMode}
      onTabChange={(tab) => setViewerMode(tab as "simple" | "pro")}
    >
      <div className="csv-viewer-flow">
        <section className="csv-beta-banner" aria-label="Beta注意">
          <strong>BETA</strong>
          <p>Beta版です。CSV解析・変換機能を改善中です。重要なデータは出力結果を確認してから使用してください。</p>
          <Link href="/tools/csv-viewer">安定版CSV Viewerを開く</Link>
        </section>

        {viewerMode === "pro" ? (
        <details open className="csv-settings-group">
          <summary><span>INPUT SETTINGS</span><ChevronDown size={15} /></summary>
          <fieldset>
            <label>
              ファイル文字コード
              <select value={fileEncoding} onChange={(event) => changeFileEncoding(event.target.value as CsvFileEncoding)}>
                <option value="auto">自動判定</option>
                <option value="utf-8">UTF-8</option>
                <option value="shift_jis">Shift_JIS（encoding-japanese SJIS）</option>
                <option value="utf-16le">UTF-16LE</option>
                <option value="utf-16be">UTF-16BE</option>
              </select>
            </label>
            <label>
              区切り文字
              <select
                value={settings.delimiter}
                onChange={(event) => setSettings((current) => ({ ...current, delimiter: event.target.value as CsvDelimiterSetting }))}
              >
                <option value="auto">自動判定（comma / tab / semicolon / pipe）</option>
                <option value=",">カンマ</option>
                <option value={"\t"}>タブ</option>
                <option value=";">セミコロン</option>
                <option value="|">縦棒</option>
                <option value=" ">スペース</option>
              </select>
            </label>
            <label>
              囲み文字
              <select
                value={settings.quote}
                onChange={(event) => setSettings((current) => ({ ...current, quote: event.target.value as CsvQuote }))}
              >
                <option value={'"'}>ダブルクォート</option>
                <option value="'">シングルクォート</option>
                <option value="">なし</option>
              </select>
            </label>
            <label>
              囲み文字のエスケープ
              <select
                value={settings.escapeMode}
                onChange={(event) => setSettings((current) => ({ ...current, escapeMode: event.target.value as CsvEscapeMode }))}
              >
                <option value="double">二重化（&quot;&quot;）</option>
                <option value="backslash">バックスラッシュ（\&quot;）</option>
              </select>
            </label>
            <label>
              ヘッダー行
              <BoundedNumberInput
                value={settings.headerRow}
                min={1}
                max={100000}
                onCommit={(value) => setSettings((current) => ({
                  ...current,
                  headerRow: value,
                  dataStartRow: Math.max(current.dataStartRow, value + 1),
                }))}
                ariaLabel="ヘッダー行"
              />
            </label>
            <label>
              読込開始行
              <BoundedNumberInput
                value={settings.dataStartRow}
                min={1}
                max={100000}
                onCommit={(value) => setSettings((current) => ({ ...current, dataStartRow: value }))}
                ariaLabel="読込開始行"
              />
            </label>
            <label className="csv-check">
              <input
                type="checkbox"
                checked={settings.trimFields}
                onChange={(event) => setSettings((current) => ({ ...current, trimFields: event.target.checked }))}
              />
              囲まれていない値の前後空白を削除
            </label>
            <label className="csv-check">
              <input
                type="checkbox"
                checked={settings.skipEmptyLines}
                onChange={(event) => setSettings((current) => ({ ...current, skipEmptyLines: event.target.checked }))}
              />
              空行を読み飛ばす
            </label>
          </fieldset>
        </details>
        ) : null}

      <section className="csv-viewer-input">
        <header>
          <span>INPUT CSV</span>
          <div>
            <label>
              <Upload size={14} />
              CSV / TSV / XLSXを開く
              <input
                type="file"
                accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) selectFile(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <div className="csv-sample-group" role="group" aria-label="サンプルCSV">
              <span>サンプル</span>
              <button type="button" onClick={() => loadSample(csvViewerSample)}>
                <RotateCcw size={14} />基本
              </button>
              <button type="button" onClick={() => loadSample(csvViewerJapaneseSample)}>
                日本語
              </button>
              <button type="button" onClick={() => loadSample(csvViewerComplexSample)}>
                複雑
              </button>
            </div>
            {(viewerMode === "pro" || looksMojibake) && (
            <button type="button" onClick={repairMojibake} title="UTF-8のバイト列をShift_JISとして読んだ文字化けだけを修復します">
              <Wrench size={14} />UTF-8→SJIS誤読を修復
            </button>
            )}
          </div>
        </header>
        {(excelSheets.length > 1 || (excelSheets.length > 0 && !selectedSheet)) && (
          <div className="csv-sheet-selector">
            <Sheet size={15} />
            <label>
              シート
              <select
                value={selectedSheet}
                onChange={(event) => {
                  const sheet = excelSheets.find((item) => item.name === event.target.value);
                  setSelectedSheet(event.target.value);
                  if (!sheet) {
                    updateInput("", "xlsx");
                    return;
                  }
                  updateInput(sheet.csv, "xlsx");
                }}
              >
                <option value="">シートを選択</option>
                {excelSheets.map((sheet) => <option value={sheet.name} key={sheet.name}>{sheet.name}</option>)}
              </select>
            </label>
            <small>.xlsxのみ対応。.xls / マクロ形式は読み込みません。数式は計算結果、日付はISO文字列、数値・文字列はその値をテキストとして取り込みます。</small>
          </div>
        )}
        {loading && (
          <div className="csv-loading" role="status">
            <LoaderCircle size={18} />
            ファイルを読み込んでいます…
          </div>
        )}
        <textarea
          value={input}
          onChange={(event) => updateInput(event.target.value, "paste")}
          spellCheck={false}
          placeholder={viewerMode === "simple" ? "CSVを貼り付け" : "ヘッダーを含むCSVを貼り付け"}
          aria-label="CSV入力"
        />
        {(repairMessage || previewNotice) && <div className="csv-input-notice">{repairMessage || previewNotice}</div>}
      </section>

        {viewerMode === "simple" ? (
          <section className="csv-simple-summary">
            <div className="csv-detection">
              <strong>DETECTED</strong>
              {detectedItems.map((item) => <span key={item}>{item}</span>)}
              {usingCustomSettings && <span className="csv-custom-flag">カスタム設定を使用中</span>}
            </div>
            <div className="csv-validation-summary">
              <strong>CSV検証</strong>
              <ul>
                {validationSummary.map((item) => (
                  <li key={item.label}>
                    {item.ok ? "✓" : "⚠"} {item.label}{item.detail ? ` ${item.detail}` : ""}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setShowValidationDetails((current) => !current)}>
                {showValidationDetails ? "詳細を閉じる" : "詳細を見る"}
              </button>
            </div>
            {showValidationDetails && (
              <div className="csv-simple-warnings">
                <ul>{uniqueWarnings.length ? uniqueWarnings.map((warning) => <li key={warning}>{warning}</li>) : <li>詳細な問題は見つかりませんでした。</li>}</ul>
                {excelRiskSummary.kinds > 0 && (
                  <ul>
                    <li>先頭ゼロ {excelRiskSummary.leadingZero}件</li>
                    <li>16桁以上の整数 {excelRiskSummary.longInteger}件</li>
                    <li>日付変換候補 {excelRiskSummary.dateLike}件</li>
                    <li>scientific notation候補 {excelRiskSummary.scientific}件</li>
                  </ul>
                )}
              </div>
            )}
            <div className="csv-simple-downloads">
              <span>ダウンロード · 編集済み全件 {records.length.toLocaleString()}件</span>
              <button
                type="button"
                title="UTF-8 / BOMなし"
                onClick={() => downloadCsv(records, columns, utf8CsvPreset)}
              >
                UTF-8 CSV
              </button>
              <button
                type="button"
                title={"UTF-8 BOM付き・CRLFで出力します。\nExcelでの文字化けを抑えますが、先頭ゼロや長い数値、日付などの自動変換は防げません。"}
                onClick={() => downloadCsv(records, columns, excelOrientedCsvPreset)}
              >
                Excel向けCSV
              </button>
              <button type="button" onClick={() => void downloadXlsxSafe(records, columns)}>XLSX</button>
            </div>
            {excelRiskSummary.kinds > 0 && (
              <div className="csv-excel-risk">
                <strong>⚠ Excelで値が変わる可能性があります</strong>
                <p>先頭ゼロ: {excelRiskSummary.leadingZero}件 · 16桁以上の整数: {excelRiskSummary.longInteger}件 · 日付変換候補: {excelRiskSummary.dateLike}件 · 指数表記: {excelRiskSummary.scientific}件</p>
                <button type="button" onClick={() => void downloadXlsxSafe(records, columns)}>XLSXで保存</button>
              </div>
            )}
          </section>
        ) : (
        <details open className="csv-settings-group">
          <summary><span>OUTPUT / DOWNLOAD SETTINGS</span><ChevronDown size={15} /></summary>
          <fieldset>
            <label>
              出力文字コード
              <select value={outputEncoding} onChange={(event) => setOutputEncoding(event.target.value as CsvOutputEncoding)}>
                <option value="utf-8">UTF-8</option>
                <option value="shift_jis">Shift_JIS（encoding-japanese SJIS）</option>
              </select>
            </label>
            <label>
              改行コード
              <select value={lineEnding} onChange={(event) => setLineEnding(event.target.value as CsvLineEnding)}>
                <option value={"\r\n"}>CRLF（Windows）</option>
                <option value={"\n"}>LF（macOS / Linux）</option>
                <option value={"\r"}>CR</option>
              </select>
            </label>
            <label>
              出力の囲み文字
              <select value={outputQuote} onChange={(event) => setOutputQuote(event.target.value as CsvQuote)}>
                <option value={'"'}>ダブルクォート</option>
                <option value="'">シングルクォート</option>
                <option value="">なし</option>
              </select>
            </label>
            <label>
              出力エスケープ
              <select value={outputEscapeMode} onChange={(event) => setOutputEscapeMode(event.target.value as CsvEscapeMode)}>
                <option value="double">囲み文字を二重化</option>
                <option value="backslash">バックスラッシュ</option>
              </select>
            </label>
            <label className="csv-check">
              <input
                type="checkbox"
                checked={includeBom}
                disabled={outputEncoding === "shift_jis"}
                onChange={(event) => setIncludeBom(event.target.checked)}
              />
              UTF-8 BOMを付ける
            </label>
            <label className="csv-check">
              <input
                type="checkbox"
                checked={quoteAll}
                disabled={!outputQuote}
                onChange={(event) => setQuoteAll(event.target.checked)}
              />
              全フィールドを囲む
            </label>
            <div className="csv-io-compare">
              <div>
                <strong>INPUT</strong>
                <span>{inputSource === "paste" ? "貼り付けテキスト" : inputSource === "xlsx" ? "XLSX" : "ファイル"}</span>
                <span>{encodingLabel(detectedEncoding, inputSource)}</span>
                <span>{parsed.inspection.lineEnding}</span>
                <span>{delimiterToken(parsed.inspection.delimiter)}</span>
                <span>{fileHasBom === null ? "BOM 判定対象外" : fileHasBom ? "BOMあり" : "BOMなし"}</span>
              </div>
              <div>
                <strong>OUTPUT</strong>
                <span>{outputEncoding === "shift_jis" ? "Shift_JIS" : "UTF-8"}</span>
                <span>{lineEndingToken(lineEnding)}</span>
                <span>{delimiterToken(",")}</span>
                <span>{outputEncoding === "utf-8" ? (includeBom ? "BOMあり" : "BOMなし") : "BOMなし"}</span>
              </div>
            </div>
            {inputSource === "file" && (
              <div className="csv-inherit-save">
                <button type="button" onClick={() => downloadInherited(records, columns)}>
                  入力形式を引き継いで保存
                </button>
                <small>
                  文字コード・BOM・区切り・改行を入力ファイルから引き継ぎます。再serializeするため quote 配置などは正規化され、元ファイルとbyte一致は保証しません。
                  {detectedEncoding === "utf-16le" || detectedEncoding === "utf-16be" ? " UTF-16入力はUTF-8として保存します。" : ""}
                </small>
              </div>
            )}
          </fieldset>
        </details>
        )}

      <div className={`csv-output-stage ${fullscreenMode !== "none" ? "fullscreen" : ""} ${fullscreenMode === "split" ? "split" : ""}`}>
        {fullscreenMode === "split" && (
          <section className="csv-fullscreen-input">
            <header><span>INPUT CSV</span><small>{input.length.toLocaleString()} CHARS</small></header>
            <textarea value={input} onChange={(event) => updateInput(event.target.value, "paste")} spellCheck={false} aria-label="全画面CSV入力" />
          </section>
        )}
        <section className="csv-viewer-output">
          <header>
            <span><FileSpreadsheet size={15} />OUTPUT</span>
            <div>
              <small>Grid操作 · Raw CSV確認 · 全件保存と表示中エクスポートは別ボタン</small>
              {fullscreenMode === "none" ? (
                <>
                  <button type="button" onClick={() => setFullscreenMode("output")}><Maximize2 size={14} />全画面</button>
                  <button type="button" onClick={() => setFullscreenMode("split")}><Columns2 size={14} />左右で全画面</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setFullscreenMode(fullscreenMode === "split" ? "output" : "split")}>
                    <Columns2 size={14} />{fullscreenMode === "split" ? "出力のみ" : "左右ペイン"}
                  </button>
                  <button type="button" onClick={() => setFullscreenMode("none")}><Minimize2 size={14} />縮小 <kbd>Esc</kbd></button>
                </>
              )}
            </div>
          </header>
          <DataGrid
          records={records}
          editable
          enableDuplicateValidation
          columnLabels={columnLabels}
          exportSplit
          onRecordsChange={setEditedRecords}
          csvSerializer={(targetRecords, targetColumns, includeHeader) =>
            serializeOutput(targetRecords, targetColumns, includeHeader)
          }
          rawPreview={(targetRecords, targetColumns) => ({
            content: serializeOutput(targetRecords, targetColumns),
            meta: formatCsvOutputMeta({
              encoding: outputEncoding,
              lineEnding,
              includeBom,
              escapeMode: outputEscapeMode,
            }),
          })}
          onDownloadAllCsv={downloadWithCurrentSettings}
          onDownloadCsv={downloadWithCurrentSettings}
          onDownloadAllXlsx={(downloadRecords, downloadColumns) => void downloadXlsxSafe(downloadRecords, downloadColumns)}
          onDownloadXlsx={(downloadRecords, downloadColumns) => void downloadXlsxSafe(downloadRecords, downloadColumns)}
          emptyMessage="CSVの行がありません"
          />
        </section>
      </div>
      </div>
      <ToolStatus error={parsed.error || repairError || xlsxError}>
        {parsed.error ? undefined : `${records.length}行を読み込みました。編集内容はブラウザ内だけに保持されます`}
      </ToolStatus>

      {pendingLargeFile && (
        <div className="csv-large-file-backdrop" role="presentation">
          <section className="csv-large-file-dialog" role="dialog" aria-modal="true" aria-labelledby="large-file-title-beta">
            <FileWarning size={24} />
            <div>
              <span>LARGE FILE</span>
              <h2 id="large-file-title-beta">大容量ファイルです</h2>
              <p>
                {pendingLargeFile.name}（{(pendingLargeFile.size / 1024 / 1024).toFixed(1)}MB）を読み込もうとしています。
                ブラウザに固定上限はありませんが、端末メモリの数倍を使う場合があります。
              </p>
              <small>10MB以上で注意を表示しています。50MB以上では先頭プレビューを推奨します。</small>
              <div>
                <button type="button" onClick={() => setPendingLargeFile(null)}>キャンセル</button>
                <button type="button" onClick={() => void processFile(pendingLargeFile, true)}>
                  先頭{PREVIEW_ROW_LIMIT.toLocaleString()}行
                </button>
                <button type="button" className="primary" onClick={() => void processFile(pendingLargeFile)}>
                  全件読み込む
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {sjisDialog && (
        <div className="csv-large-file-backdrop" role="presentation">
          <section className="csv-large-file-dialog csv-sjis-dialog" role="dialog" aria-modal="true" aria-labelledby="sjis-unmappable-title">
            <AlertTriangle size={24} />
            <div>
              <span>SHIFT_JIS</span>
              <h2 id="sjis-unmappable-title">⚠ Shift_JISに変換できない文字が{sjisDialog.unmappable.length}件あります</h2>
              <ul>
                {sjisDialog.unmappable.slice(0, 8).map((item, index) => (
                  <li key={`${item.row}-${item.column}-${item.char}-${index}`}>
                    {item.row ? `${item.row}行` : "位置不明"}
                    {item.column ? ` / ${columnLabels[columns[item.column - 1]] ?? `${item.column}列`}` : ""}
                    <code>{item.char}</code>
                  </li>
                ))}
              </ul>
              {sjisDialog.unmappable.length > 8 && <small>ほか{sjisDialog.unmappable.length - 8}件</small>}
              <div>
                <button type="button" onClick={() => { setShowValidationDetails(true); setSjisDialog(null); }}>該当箇所を見る</button>
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
            </div>
          </section>
        </div>
      )}

      <section className="csv-validation" aria-labelledby="csv-validation-title-beta">
        <header>
          <span id="csv-validation-title-beta">
            {uniqueWarnings.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            CSV検証
          </span>
          <strong>{uniqueWarnings.length ? `${uniqueWarnings.length}件の注意` : "問題は見つかりませんでした"}</strong>
        </header>
        {viewerMode === "simple" ? (
          <div className="csv-validation-simple">
            <ul>
              {validationSummary.map((item) => (
                <li key={item.label}>{item.ok ? "✓" : "⚠"} {item.label}{item.detail ? ` ${item.detail}` : ""}</li>
              ))}
            </ul>
            <button type="button" onClick={() => setShowValidationDetails((current) => !current)}>
              {showValidationDetails ? "詳細を閉じる" : "詳細を見る"}
            </button>
            {showValidationDetails && uniqueWarnings.length > 0 && (
              <ul>{uniqueWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            )}
          </div>
        ) : uniqueWarnings.length ? (
          <ul>{uniqueWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        ) : (
          <p>囲み文字、列数、NUL、改行混在、デコード不能、Excel変換リスク、CSV Injection、Shift_JIS変換不能を確認しました。値は自動修正していません。</p>
        )}
      </section>

      <section className="csv-guide" aria-labelledby="csv-guide-title-beta">
        <div className="csv-guide-heading">
          <span>GUIDE / TROUBLESHOOTING</span>
          <h2 id="csv-guide-title-beta">Betaの安全なCSV取り扱い</h2>
          <p>このページは安定版と別実装です。CSV内容の自動修正、黙った文字置換、文字コードの断定は行いません。</p>
        </div>
        <div className="csv-guide-grid">
          <article>
            <span>01</span>
            <h3>文字コード</h3>
            <p>ファイル読込時のみbyteから判定します。貼り付けテキストに元文字コードとBOMはありません。Shift_JIS出力はencoding-japanese 2.3.0のSJIS変換です。CP932専用エンコーダではありません。変換不能文字は停止します。</p>
          </article>
          <article>
            <span>02</span>
            <h3>区切り・改行</h3>
            <p>Simpleの自動判定はcomma / tab / semicolon / pipeです。quote内の区切りは除外し、列数の安定を見ます。spaceはProで手動指定できます。quoted field内改行は1セルです。混在改行は警告します。</p>
          </article>
          <article>
            <span>03</span>
            <h3>ヘッダー</h3>
            <p>重複・空ヘッダーでも開けます。内部キーはcol_N、表示は元ヘッダー、出力は元ヘッダーを保持します。空列の表示名は(空列N)ですが、未編集なら空のまま出力します。</p>
          </article>
          <article>
            <span>04</span>
            <h3>Excel向けCSVとXLSX</h3>
            <p>Excel向けCSVはUTF-8 BOMあり・CRLFです。文字化け対策であり、先頭ゼロや日付変換は防げません。リスクがある場合はXLSX（文字列保持）を推奨します。XLSX入力は.xlsxのみ。複数シートは選択必須です。</p>
          </article>
          <article>
            <span>05</span>
            <h3>エクスポート対象</h3>
            <p>Simpleの用途別ボタンは編集済み全件です。Gridの「CSVを保存 N件」も全件、「表示中のN件をエクスポート」はfilter/sort後です。sort/filterは表示中エクスポートにだけ反映します。</p>
          </article>
          <article>
            <span>06</span>
            <h3>入力形式の引き継ぎ</h3>
            <p>ファイル読込時のみ「入力形式を引き継いで保存」を使えます。再serializeするためquote配置のbyte一致は保証しません。貼り付けには適用しません。</p>
          </article>
        </div>
      </section>
    </ToolShell>
  );
}
