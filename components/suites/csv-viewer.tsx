"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Columns2,
  FileCog,
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
import { useEffect, useMemo, useRef, useState } from "react";
import { BoundedNumberInput } from "@/components/bounded-number-input";
import { DataGrid, type DataGridRecord } from "@/components/data-grid";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  decodeCsvBytes,
  encodeCsvText,
  formatCsvTimestamp,
  inspectCsv,
  repairUtf8ReadAsShiftJis,
  serializeCsv,
  type CsvDelimiterSetting,
  type CsvEscapeMode,
  type CsvFileEncoding,
  type CsvLineEnding,
  type CsvOutputEncoding,
  type CsvQuote,
} from "@/lib/csv-utils";

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
4,空データ,,"  前後に空白  ",-450,"@external"`;

const LARGE_FILE_WARNING_BYTES = 10 * 1024 * 1024;
const PREVIEW_ROW_LIMIT = 10_000;

type ExcelSheet = { name: string; csv: string };

function excelValueToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);
  if ("result" in value) return excelValueToText((value as { result?: unknown }).result);
  if ("text" in value) return String((value as { text?: unknown }).text ?? "");
  if ("richText" in value && Array.isArray((value as { richText?: unknown[] }).richText)) {
    return (value as { richText: { text?: string }[] }).richText.map((part) => part.text ?? "").join("");
  }
  return JSON.stringify(value);
}

function rowsToCsv(rows: string[][]): string {
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const columns = Array.from({ length: width }, (_, index) => `column_${index}`);
  const records = rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ""])));
  return serializeCsv(records, columns, { includeHeader: false });
}

function previewCsv(text: string, settings: ViewerSettings): string {
  const rows = inspectCsv(text, settings).rows.slice(0, PREVIEW_ROW_LIMIT + 1);
  return rowsToCsv(rows);
}

type ViewerSettings = {
  delimiter: CsvDelimiterSetting;
  quote: CsvQuote;
  escapeMode: CsvEscapeMode;
  trimFields: boolean;
  skipEmptyLines: boolean;
  headerRow: number;
  dataStartRow: number;
};

const defaultSettings: ViewerSettings = {
  delimiter: "auto",
  quote: '"',
  escapeMode: "double",
  trimFields: false,
  skipEmptyLines: true,
  headerRow: 1,
  dataStartRow: 2,
};

function parseRecords(input: string, settings: ViewerSettings) {
  const inspection = inspectCsv(input, settings);
  const headers = inspection.rows[settings.headerRow - 1];
  if (!headers?.length || headers.every((header) => !header.trim())) {
    return {
      records: [] as DataGridRecord[],
      error: "指定したヘッダー行にフィールドがありません。",
      inspection,
      warnings: inspection.warnings,
    };
  }
  const normalizedHeaders = headers.map((header, index) => header.trim() || `column_${index + 1}`);
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    return {
      records: [] as DataGridRecord[],
      error: "ヘッダー名が重複しています。",
      inspection,
      warnings: inspection.warnings,
    };
  }
  const rows = inspection.rows.slice(Math.max(settings.dataStartRow - 1, settings.headerRow));
  const formulaCells = rows.flat().filter((value) => /^[=+@]|^-(?!\d)/.test(value.trim())).length;
  const warnings = [...inspection.warnings];
  if (headers.some((header) => !header.trim())) warnings.push("空のヘッダー名をcolumn_Nへ補完しました。");
  if (formulaCells) warnings.push(`表計算ソフトで数式として実行され得る値が${formulaCells}件あります。`);
  return {
    records: rows.map((row) =>
      Object.fromEntries(normalizedHeaders.map((header, index) => [header, row[index] ?? ""])),
    ),
    error: "",
    inspection,
    warnings,
  };
}

function downloadCsv(
  records: DataGridRecord[],
  columns: string[],
  options: {
    encoding: CsvOutputEncoding;
    lineEnding: CsvLineEnding;
    includeBom: boolean;
    quoteAll: boolean;
    quote: CsvQuote;
    escapeMode: CsvEscapeMode;
  },
) {
  const output = serializeCsv(records, columns, {
    lineEnding: options.lineEnding,
    quoteAll: options.quoteAll,
    quote: options.quote,
    escapeMode: options.escapeMode,
    finalLineEnding: true,
  });
  const bytes = encodeCsvText(output, options.encoding, options.includeBom);
  const content = new Uint8Array(bytes.length);
  content.set(bytes);
  const mimeEncoding = options.encoding === "shift_jis" ? "shift_jis" : "utf-8";
  const url = URL.createObjectURL(new Blob([content.buffer], { type: `text/csv;charset=${mimeEncoding}` }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `devsmith-data_${formatCsvTimestamp()}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CsvViewerSuite() {
  const [input, setInput] = useState(csvViewerSample);
  const [editedRecords, setEditedRecords] = useState<DataGridRecord[] | null>(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [fileEncoding, setFileEncoding] = useState<CsvFileEncoding>("auto");
  const [detectedEncoding, setDetectedEncoding] = useState<"utf-8" | "shift_jis" | null>(null);
  const [fileHasBom, setFileHasBom] = useState(false);
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
  const [fullscreenMode, setFullscreenMode] = useState<"none" | "output" | "split">("none");
  const [previewNotice, setPreviewNotice] = useState("");
  const fileBytesRef = useRef<Uint8Array | null>(null);
  const parsed = useMemo(() => parseRecords(input, settings), [input, settings]);
  const records = editedRecords ?? parsed.records;
  const serializeOutput = (
    targetRecords: DataGridRecord[],
    columns: string[],
    includeHeader = true,
  ) => serializeCsv(targetRecords, columns, {
    lineEnding,
    quoteAll,
    quote: outputQuote,
    escapeMode: outputEscapeMode,
    includeHeader,
    finalLineEnding: true,
  });

  const updateInput = (value: string) => {
    setInput(value);
    setEditedRecords(null);
    setRepairError("");
    setRepairMessage("");
  };

  useEffect(() => {
    const storedValue = sessionStorage.getItem("devsmith:paste-anything:value");
    const storedType = sessionStorage.getItem("devsmith:paste-anything:type");
    if (storedValue && (storedType === "csv" || storedType === "tsv")) {
      updateInput(storedValue);
      if (storedType === "tsv") setSettings((current) => ({ ...current, delimiter: "\t" }));
      sessionStorage.removeItem("devsmith:paste-anything:value");
      sessionStorage.removeItem("devsmith:paste-anything:type");
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
    updateInput(decoded.text);
    setDetectedEncoding(decoded.encoding);
    setFileHasBom(decoded.hasBom);
  };

  const changeFileEncoding = (encoding: CsvFileEncoding) => {
    setFileEncoding(encoding);
    if (fileBytesRef.current) decodeFile(fileBytesRef.current, encoding);
  };

  const repairMojibake = () => {
    try {
      updateInput(repairUtf8ReadAsShiftJis(input));
      setRepairMessage("UTF-8をShift_JISとして誤読した可逆な文字化けを修復しました。");
    } catch (error) {
      setRepairError(error instanceof Error ? error.message : "文字化けを修復できませんでした。");
    }
  };

  const loadSample = (value: string) => {
    fileBytesRef.current = null;
    setDetectedEncoding(null);
    setFileHasBom(false);
    setExcelSheets([]);
    setSelectedSheet("");
    setPreviewNotice("");
    updateInput(value);
  };

  const loadExcelFile = async (file: File, previewOnly: boolean) => {
    const module = await import("exceljs");
    const ExcelJS = module.default;
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer as unknown as Buffer);
    const sheets = workbook.worksheets.map((worksheet) => {
      const rows: string[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (previewOnly && rowNumber > PREVIEW_ROW_LIMIT + 1) return;
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows.push(values.map(excelValueToText));
      });
      return { name: worksheet.name, csv: rowsToCsv(rows) };
    });
    if (!sheets.length) throw new Error("読み込めるシートがありません。");
    setExcelSheets(sheets);
    setSelectedSheet(sheets[0].name);
    setSettings((current) => ({ ...current, delimiter: ",", quote: '"', escapeMode: "double" }));
    updateInput(sheets[0].csv);
    fileBytesRef.current = null;
    setDetectedEncoding(null);
    setFileHasBom(false);
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
      updateInput(text);
      setDetectedEncoding(decoded.encoding);
      setFileHasBom(decoded.hasBom);
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

  return (
    <ToolShell
      slug="csv-viewer"
      category="データ"
      title="CSV Viewer"
      description="CSVを貼り付けるかファイルで開き、表として絞り込み・並べ替え・編集します。"
      functionCount={1}
    >
      <section className="csv-settings" aria-labelledby="csv-settings-title">
        <header>
          <span id="csv-settings-title"><FileCog size={15} />CSV解析・出力設定</span>
          <small>ファイル読込時に文字コードを判定し、解析条件と出力形式を個別に指定できます。</small>
        </header>
        <div className="csv-settings-grid">
          <details open className="csv-settings-group">
            <summary><span>INPUT SETTINGS</span><ChevronDown size={15} /></summary>
            <fieldset>
            <label>
              ファイル文字コード
              <select value={fileEncoding} onChange={(event) => changeFileEncoding(event.target.value as CsvFileEncoding)}>
                <option value="auto">自動判定</option>
                <option value="utf-8">UTF-8</option>
                <option value="shift_jis">Shift_JIS / Windows-31J</option>
              </select>
            </label>
            <label>
              区切り文字
              <select
                value={settings.delimiter}
                onChange={(event) => setSettings((current) => ({ ...current, delimiter: event.target.value as CsvDelimiterSetting }))}
              >
                <option value="auto">自動判定</option>
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
          <details open className="csv-settings-group">
            <summary><span>OUTPUT / DOWNLOAD SETTINGS</span><ChevronDown size={15} /></summary>
            <fieldset>
            <label>
              出力文字コード
              <select value={outputEncoding} onChange={(event) => setOutputEncoding(event.target.value as CsvOutputEncoding)}>
                <option value="utf-8">UTF-8</option>
                <option value="shift_jis">Shift_JIS / Windows-31J</option>
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
            <div className="csv-detection">
              <strong>DETECTED</strong>
              <span>{detectedEncoding ? detectedEncoding.toUpperCase() : "貼り付けテキスト"}</span>
              <span>{parsed.inspection.delimiter === "\t" ? "TAB" : parsed.inspection.delimiter}</span>
              <span>{parsed.inspection.lineEnding}</span>
              <span>{fileHasBom || parsed.inspection.hasBom ? "BOMあり" : "BOMなし"}</span>
            </div>
            </fieldset>
          </details>
        </div>
      </section>

      <section className="csv-viewer-input">
        <header>
          <span>INPUT CSV</span>
          <div>
            <label>
              <Upload size={14} />
              CSV / Excelを開く
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
            <button type="button" onClick={() => loadSample(csvViewerSample)}>
              <RotateCcw size={14} />標準
            </button>
            <button type="button" onClick={() => loadSample(csvViewerJapaneseSample)}>
              日本語
            </button>
            <button type="button" onClick={() => loadSample(csvViewerComplexSample)}>
              複雑
            </button>
            <button type="button" onClick={repairMojibake} title="UTF-8のバイト列をShift_JISとして読んだ文字化けだけを修復します">
              <Wrench size={14} />UTF-8→SJIS誤読を修復
            </button>
          </div>
        </header>
        {excelSheets.length > 1 && (
          <div className="csv-sheet-selector">
            <Sheet size={15} />
            <label>
              シート
              <select
                value={selectedSheet}
                onChange={(event) => {
                  const sheet = excelSheets.find((item) => item.name === event.target.value);
                  if (!sheet) return;
                  setSelectedSheet(sheet.name);
                  updateInput(sheet.csv);
                }}
              >
                {excelSheets.map((sheet) => <option value={sheet.name} key={sheet.name}>{sheet.name}</option>)}
              </select>
            </label>
            <small>.xlsxのみ対応。マクロ形式は読み込みません。</small>
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
          onChange={(event) => updateInput(event.target.value)}
          spellCheck={false}
          placeholder="ヘッダーを含むCSVを貼り付け"
          aria-label="CSV入力"
        />
        {(repairMessage || previewNotice) && <div className="csv-input-notice">{repairMessage || previewNotice}</div>}
      </section>

      <div className={`csv-output-stage ${fullscreenMode !== "none" ? "fullscreen" : ""} ${fullscreenMode === "split" ? "split" : ""}`}>
        {fullscreenMode === "split" && (
          <section className="csv-fullscreen-input">
            <header><span>INPUT CSV</span><small>{input.length.toLocaleString()} CHARS</small></header>
            <textarea value={input} onChange={(event) => updateInput(event.target.value)} spellCheck={false} aria-label="全画面CSV入力" />
          </section>
        )}
        <section className="csv-viewer-output">
          <header>
            <span><FileSpreadsheet size={15} />OUTPUT</span>
            <div>
              <small>Grid操作 · Raw CSV確認 · ダウンロード</small>
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
          onRecordsChange={setEditedRecords}
          csvSerializer={(targetRecords, columns, includeHeader) =>
            serializeOutput(targetRecords, columns, includeHeader)
          }
          rawPreview={(targetRecords, columns) => ({
            content: serializeOutput(targetRecords, columns),
            meta: `${outputEncoding.toUpperCase()} · ${lineEnding === "\r\n" ? "CRLF" : lineEnding === "\n" ? "LF" : "CR"} · ${outputEncoding === "utf-8" && includeBom ? "BOMあり" : "BOMなし"} · ${outputEscapeMode === "double" ? "引用符二重化" : "バックスラッシュ"}`,
          })}
          onDownloadCsv={(downloadRecords, columns) =>
            downloadCsv(downloadRecords, columns, {
              encoding: outputEncoding,
              lineEnding,
              includeBom: outputEncoding === "utf-8" && includeBom,
              quoteAll,
              quote: outputQuote,
              escapeMode: outputEscapeMode,
            })
          }
          emptyMessage="CSVの行がありません"
          />
        </section>
      </div>
      <ToolStatus error={parsed.error || repairError}>
        {parsed.error ? undefined : `${records.length}行を読み込みました。編集内容はブラウザ内だけに保持されます`}
      </ToolStatus>

      {pendingLargeFile && (
        <div className="csv-large-file-backdrop" role="presentation">
          <section className="csv-large-file-dialog" role="dialog" aria-modal="true" aria-labelledby="large-file-title">
            <FileWarning size={24} />
            <div>
              <span>LARGE FILE</span>
              <h2 id="large-file-title">大容量ファイルです</h2>
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

      <section className="csv-validation" aria-labelledby="csv-validation-title">
        <header>
          <span id="csv-validation-title">
            {parsed.warnings.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            CSV検証
          </span>
          <strong>{parsed.warnings.length ? `${parsed.warnings.length}件の注意` : "問題は見つかりませんでした"}</strong>
        </header>
        {parsed.warnings.length ? (
          <ul>{parsed.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        ) : (
          <p>囲み文字、列数、NUL文字、表計算ソフトの数式として解釈され得る値を確認しました。</p>
        )}
      </section>

      <section className="csv-guide" aria-labelledby="csv-guide-title">
        <div className="csv-guide-heading">
          <span>GUIDE / TROUBLESHOOTING</span>
          <h2 id="csv-guide-title">CSVを安全に扱うための設定ガイド</h2>
          <p>CSVには単一の完全な仕様がなく、作成元のOS・表計算ソフト・業務システムによって解釈が変わります。</p>
        </div>
        <div className="csv-guide-grid">
          <article>
            <span>01</span>
            <h3>文字コードと文字化け</h3>
            <p>ファイルはバイト列を保持しているためUTF-8／Shift_JISを切り替えて再読込できます。貼り付け後の文字列には元の文字コード情報がありません。「縺薙」のようなUTF-8をShift_JISとして読んだ可逆な文字化けだけ修復できますが、「�」へ置換済みの文字は復元できません。</p>
          </article>
          <article>
            <span>02</span>
            <h3>区切り・囲み・改行</h3>
            <p>カンマのほかタブ、セミコロン、縦棒、スペースを選べます。値に区切り文字や改行を含める場合は囲み文字が必要です。引用符自体は二重化してエスケープします。Windows連携ではCRLF、macOS／LinuxではLFが一般的です。</p>
          </article>
          <article>
            <span>03</span>
            <h3>ヘッダーと読み込み開始行</h3>
            <p>帳票名や注記が先頭にあるファイルはヘッダー行と読込開始行を指定します。重複ヘッダーはデータ参照が曖昧になるためエラーにし、空ヘッダーはcolumn_Nへ補完します。行ごとの列数差も検証欄に表示します。</p>
          </article>
          <article>
            <span>04</span>
            <h3>Excel互換とBOM</h3>
            <p>日本語版ExcelでUTF-8を開く場合はBOM付きが安定します。古い業務システムにはShift_JISが必要な場合があります。機種依存文字や絵文字はShift_JISに存在せず、出力時に文字参照へ置き換わる可能性があります。</p>
          </article>
          <article>
            <span>05</span>
            <h3>型・先頭ゼロ・日付</h3>
            <p>CSV自体に型情報はありません。郵便番号やIDの先頭ゼロ、長い数値、日付は表計算ソフトが自動変換することがあります。このViewerでは文字列として保持しますが、別ソフトへ渡す際はインポート列型を明示してください。</p>
          </article>
          <article>
            <span>06</span>
            <h3>数式注入と大容量ファイル</h3>
            <p>=、+、-、@で始まる値は表計算ソフトで数式として実行されることがあります。外部由来データは確認してから開いてください。処理はすべてブラウザ内ですが、大容量ファイルは端末メモリを消費します。</p>
          </article>
        </div>
      </section>
    </ToolShell>
  );
}
