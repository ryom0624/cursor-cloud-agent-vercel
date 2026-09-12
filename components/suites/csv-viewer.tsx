"use client";

import { AlertTriangle, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DataGrid,
  type DataGridRecord,
} from "@/components/data-grid";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  describeCsvFieldWarnings,
  findCsvFieldWarnings,
} from "@/lib/csv-field-warnings";
import { parseCsv } from "@/lib/tool-utils";

const csvViewerSample = `id,name,team,status,score,updated_at
101,DevSmith,Platform,active,98,2026-09-11
102,API Gateway,Backend,review,87,2026-09-10
103,Design Tokens,Design System,active,92,2026-09-09
104,Log Pipeline,SRE,paused,74,2026-09-08
105,Release Notes,Product,active,89,2026-09-07`;

const csvNumericRiskSample = `id,zip,phone,amount
1,00123,09012345678,1E10
2,0000000001,0312345678,1.2e3
3,1500001,08000000000,98`;

function parseRecords(input: string) {
  const [headers, ...rows] = parseCsv(input);
  if (!headers?.length || headers.every((header) => !header.trim())) {
    return { records: [] as DataGridRecord[], error: "ヘッダー行を入力してください。" };
  }
  const normalizedHeaders = headers.map((header, index) => header.trim() || `column_${index + 1}`);
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    return { records: [] as DataGridRecord[], error: "ヘッダー名が重複しています。" };
  }
  return {
    records: rows.map((row) =>
      Object.fromEntries(normalizedHeaders.map((header, index) => [header, row[index] ?? ""])),
    ),
    error: "",
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(records: DataGridRecord[], columns: string[]) {
  const output = [
    columns.map(csvEscape).join(","),
    ...records.map((record) => columns.map((column) => csvEscape(record[column])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${output}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "devsmith-data.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CsvViewerSuite() {
  const [input, setInput] = useState(csvViewerSample);
  const [editedRecords, setEditedRecords] = useState<DataGridRecord[] | null>(null);
  const parsed = useMemo(() => parseRecords(input), [input]);
  const records = editedRecords ?? parsed.records;
  const columns = useMemo(
    () => Array.from(new Set(records.flatMap((record) => Object.keys(record)))),
    [records],
  );
  const fieldWarnings = useMemo(
    () => findCsvFieldWarnings(records, columns),
    [columns, records],
  );
  const warningSummary = describeCsvFieldWarnings(fieldWarnings);
  const warningExamples = fieldWarnings.slice(0, 4);

  const updateInput = (value: string) => {
    setInput(value);
    setEditedRecords(null);
  };

  return (
    <ToolShell
      slug="csv-viewer"
      category="データ"
      title="CSV Viewer"
      description="CSVを貼り付けるかファイルで開き、表として絞り込み・並べ替え・編集します。"
      functionCount={1}
    >
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
                  if (file) updateInput(await file.text());
                }}
              />
            </label>
            <button type="button" onClick={() => updateInput(csvViewerSample)}>
              <RotateCcw size={14} />サンプル
            </button>
            <button type="button" onClick={() => updateInput(csvNumericRiskSample)}>
              先頭ゼロ・指数
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

      {fieldWarnings.length > 0 && (
        <section className="csv-field-warnings" role="status">
          <strong>
            <AlertTriangle size={15} />
            Excel変換リスク
          </strong>
          <p>
            {warningSummary}を検出しました。表計算ソフトが数値として読み、先頭ゼロや指数表記が消えることがあります。
          </p>
          <ul>
            {warningExamples.map((hit) => (
              <li key={`${hit.kind}-${hit.row}-${hit.column}`}>
                {hit.row}行 / {hit.column}: {hit.kind === "leadingZero" ? "先頭ゼロ" : "指数表記"}
                <code>{hit.value}</code>
              </li>
            ))}
          </ul>
          {fieldWarnings.length > warningExamples.length && (
            <small>ほか{fieldWarnings.length - warningExamples.length}件</small>
          )}
        </section>
      )}

      <section className="csv-viewer-output">
        <header>
          <span><FileSpreadsheet size={15} />OUTPUT GRID</span>
          <small>ドラッグ範囲選択 · 列ドラッグ移動 · セル直接編集</small>
        </header>
        <DataGrid
          records={records}
          editable
          onRecordsChange={setEditedRecords}
          onDownloadCsv={downloadCsv}
          emptyMessage="CSVの行がありません"
        />
      </section>
      <ToolStatus error={parsed.error}>
        {parsed.error ? undefined : `${records.length}行を読み込みました。編集内容はブラウザ内だけに保持されます`}
      </ToolStatus>
    </ToolShell>
  );
}
