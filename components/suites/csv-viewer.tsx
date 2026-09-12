"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileCog,
  FileSpreadsheet,
  RotateCcw,
  Upload,
  Wrench,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { BoundedNumberInput } from "@/components/bounded-number-input";
import { DataGrid, type DataGridRecord } from "@/components/data-grid";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  decodeCsvBytes,
  encodeCsvText,
  inspectCsv,
  repairUtf8ReadAsShiftJis,
  serializeCsv,
  type CsvDelimiterSetting,
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

type ViewerSettings = {
  delimiter: CsvDelimiterSetting;
  quote: CsvQuote;
  trimFields: boolean;
  skipEmptyLines: boolean;
  headerRow: number;
  dataStartRow: number;
};

const defaultSettings: ViewerSettings = {
  delimiter: "auto",
  quote: '"',
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
  },
) {
  const output = serializeCsv(records, columns, {
    lineEnding: options.lineEnding,
    quoteAll: options.quoteAll,
  });
  const bytes = encodeCsvText(output, options.encoding, options.includeBom);
  const content = new Uint8Array(bytes.length);
  content.set(bytes);
  const url = URL.createObjectURL(new Blob([content.buffer], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `devsmith-data-${options.encoding}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
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
  const [repairError, setRepairError] = useState("");
  const fileBytesRef = useRef<Uint8Array | null>(null);
  const parsed = useMemo(() => parseRecords(input, settings), [input, settings]);
  const records = editedRecords ?? parsed.records;

  const updateInput = (value: string) => {
    setInput(value);
    setEditedRecords(null);
    setRepairError("");
  };

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
    } catch (error) {
      setRepairError(error instanceof Error ? error.message : "文字化けを修復できませんでした。");
    }
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
          <fieldset>
            <legend>INPUT</legend>
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
          <fieldset>
            <legend>OUTPUT / DOWNLOAD</legend>
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
              <input type="checkbox" checked={quoteAll} onChange={(event) => setQuoteAll(event.target.checked)} />
              全フィールドをダブルクォートで囲む
            </label>
            <div className="csv-detection">
              <strong>DETECTED</strong>
              <span>{detectedEncoding ? detectedEncoding.toUpperCase() : "貼り付けテキスト"}</span>
              <span>{parsed.inspection.delimiter === "\t" ? "TAB" : parsed.inspection.delimiter}</span>
              <span>{parsed.inspection.lineEnding}</span>
              <span>{fileHasBom || parsed.inspection.hasBom ? "BOMあり" : "BOMなし"}</span>
            </div>
          </fieldset>
        </div>
      </section>

      <section className="csv-viewer-input">
        <header>
          <span>INPUT CSV</span>
          <div>
            <label>
              <Upload size={14} />
              CSVファイルを開く
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    fileBytesRef.current = bytes;
                    decodeFile(bytes, fileEncoding);
                  }
                }}
              />
            </label>
            <button type="button" onClick={() => updateInput(csvViewerSample)}>
              <RotateCcw size={14} />サンプル
            </button>
            <button type="button" onClick={repairMojibake} title="UTF-8のバイト列をShift_JISとして読んだ文字化けだけを修復します">
              <Wrench size={14} />UTF-8→SJIS誤読を修復
            </button>
          </div>
        </header>
        <textarea
          value={input}
          onChange={(event) => updateInput(event.target.value)}
          spellCheck={false}
          placeholder="ヘッダーを含むCSVを貼り付け"
          aria-label="CSV入力"
        />
      </section>

      <section className="csv-viewer-output">
        <header>
          <span><FileSpreadsheet size={15} />OUTPUT GRID</span>
          <small>ドラッグ範囲選択 · 列ドラッグ移動 · セル直接編集</small>
        </header>
        <DataGrid
          records={records}
          editable
          onRecordsChange={setEditedRecords}
          onDownloadCsv={(downloadRecords, columns) =>
            downloadCsv(downloadRecords, columns, {
              encoding: outputEncoding,
              lineEnding,
              includeBom: outputEncoding === "utf-8" && includeBom,
              quoteAll,
            })
          }
          emptyMessage="CSVの行がありません"
        />
      </section>
      <ToolStatus error={parsed.error || repairError}>
        {parsed.error ? undefined : `${records.length}行を読み込みました。編集内容はブラウザ内だけに保持されます`}
      </ToolStatus>

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
