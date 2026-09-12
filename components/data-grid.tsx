"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  GripVertical,
  KeyRound,
  Pin,
  PinOff,
  Plus,
  ScanSearch,
  TableProperties,
  Trash2,
} from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CopyButton, copyText } from "@/components/copy-button";

export type DataGridRecord = Record<string, unknown>;

type SortState =
  | { column: string; direction: "asc" | "desc" }
  | null;
type CellPosition = { row: number; column: number };

function displayValue(value: unknown) {
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function delimitedEscape(value: unknown, delimiter: "," | "\t") {
  const text = displayValue(value);
  if (delimiter === "\t") return text.replaceAll("\t", " ").replaceAll(/\r?\n/g, " ");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeGridRows(
  records: DataGridRecord[],
  columns: string[],
  delimiter: "," | "\t",
  includeHeader: boolean,
) {
  const lines = records.map((record) =>
    columns.map((column) => delimitedEscape(record[column], delimiter)).join(delimiter),
  );
  if (includeHeader) lines.unshift(columns.map((column) => delimitedEscape(column, delimiter)).join(delimiter));
  return lines.join("\n");
}

export type DataGridProps = {
  records: DataGridRecord[];
  emptyMessage?: string;
  editable?: boolean;
  onRecordsChange?: (records: DataGridRecord[]) => void;
  onDownloadCsv?: (records: DataGridRecord[], columns: string[]) => void;
  csvSerializer?: (
    records: DataGridRecord[],
    columns: string[],
    includeHeader: boolean,
  ) => string;
  rawPreview?: (
    records: DataGridRecord[],
    columns: string[],
  ) => { content: string; meta?: string };
  enableDuplicateValidation?: boolean;
};

export function DataGrid({
  records,
  emptyMessage = "表示できる行がありません",
  editable = false,
  onRecordsChange,
  onDownloadCsv,
  csvSerializer,
  rawPreview,
  enableDuplicateValidation = false,
}: DataGridProps) {
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [includeHeader, setIncludeHeader] = useState(true);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [selectionStart, setSelectionStart] = useState<CellPosition | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<CellPosition | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [newColumn, setNewColumn] = useState("new_column");
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<"grid" | "raw">("grid");
  const [uniqueKey, setUniqueKey] = useState("");
  const [duplicateColumns, setDuplicateColumns] = useState<string[]>([]);
  const [pinnedColumns, setPinnedColumns] = useState<string[]>([]);
  const dragColumnRef = useRef<string | null>(null);

  useEffect(() => {
    const stopSelecting = () => setSelecting(false);
    window.addEventListener("mouseup", stopSelecting);
    return () => window.removeEventListener("mouseup", stopSelecting);
  }, []);

  const sourceColumns = useMemo(
    () => Array.from(new Set(records.flatMap((record) => Object.keys(record)))),
    [records],
  );
  const columns = useMemo(() => [
    ...columnOrder.filter((column) => sourceColumns.includes(column)),
    ...sourceColumns.filter((column) => !columnOrder.includes(column)),
  ], [columnOrder, sourceColumns]);
  const indexedRows = useMemo(() => {
    const filtered = records
      .map((record, originalIndex) => ({ record, originalIndex }))
      .filter(({ record }) =>
        sourceColumns.every((column) => {
          const query = (filters[column] ?? "").trim().toLocaleLowerCase();
          return !query || displayValue(record[column]).toLocaleLowerCase().includes(query);
        }),
      );
    if (!sort) return filtered;
    return [...filtered].sort((left, right) => {
      const compared = sort.column === "__row"
        ? left.originalIndex - right.originalIndex
        : (() => {
            const a = left.record[sort.column];
            const b = right.record[sort.column];
            return typeof a === "number" && typeof b === "number"
              ? a - b
              : displayValue(a).localeCompare(displayValue(b), "ja", { numeric: true });
          })();
      return sort.direction === "asc" ? compared : -compared;
    });
  }, [filters, records, sort, sourceColumns]);
  const visibleRecords = indexedRows.map(({ record }) => record);
  const toCsv = (
    targetRecords: DataGridRecord[],
    targetColumns: string[],
    withHeader: boolean,
  ) => csvSerializer
    ? csvSerializer(targetRecords, targetColumns, withHeader)
    : serializeGridRows(targetRecords, targetColumns, ",", withHeader);

  const toggleSort = (column: string) => {
    setSort((current) => {
      if (current?.column !== column) return { column, direction: "asc" };
      if (current.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  };

  const reorderColumn = (source: string, target: string) => {
    if (!source || source === target) return;
    setColumnOrder((currentOrder) => {
      const ordered = [
        ...currentOrder.filter((column) => sourceColumns.includes(column)),
        ...sourceColumns.filter((column) => !currentOrder.includes(column)),
      ];
      const from = ordered.indexOf(source);
      const to = ordered.indexOf(target);
      if (from < 0 || to < 0) return currentOrder;
      ordered.splice(from, 1);
      ordered.splice(to, 0, source);
      return ordered;
    });
  };

  const startColumnResize = (
    event: ReactPointerEvent<HTMLSpanElement>,
    column: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const header = event.currentTarget.closest("th");
    if (!header) return;
    const startX = event.clientX;
    const startWidth = header.getBoundingClientRect().width;
    const measuredWidths = Object.fromEntries(
      Array.from(header.closest("table")?.querySelectorAll<HTMLElement>("[data-grid-column]") ?? [])
        .map((item) => [item.dataset.gridColumn ?? "", Math.round(item.getBoundingClientRect().width)])
        .filter(([name]) => Boolean(name)),
    );
    setColumnWidths(measuredWidths);
    const move = (pointerEvent: PointerEvent) => {
      const width = Math.round(Math.max(96, Math.min(640, startWidth + pointerEvent.clientX - startX)));
      setColumnWidths({ ...measuredWidths, [column]: width });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const bounds = useMemo(() => selectionStart && selectionEnd
    ? {
        rowStart: Math.min(selectionStart.row, selectionEnd.row),
        rowEnd: Math.max(selectionStart.row, selectionEnd.row),
        columnStart: Math.min(selectionStart.column, selectionEnd.column),
        columnEnd: Math.max(selectionStart.column, selectionEnd.column),
      }
    : null, [selectionEnd, selectionStart]);
  const selectionRecords = bounds
    ? visibleRecords.slice(bounds.rowStart, bounds.rowEnd + 1)
    : [];
  const selectionColumns = bounds
    ? columns.slice(bounds.columnStart, bounds.columnEnd + 1)
    : [];
  const selectionValue = toCsv(
    selectionRecords,
    selectionColumns,
    includeHeader,
  );
  const rawOutput = rawPreview?.(visibleRecords, columns);

  useEffect(() => {
    const copySelection = (event: KeyboardEvent) => {
      if (!bounds || !selectionValue) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "c") return;
      event.preventDefault();
      void copyText(selectionValue);
    };
    window.addEventListener("keydown", copySelection);
    return () => window.removeEventListener("keydown", copySelection);
  }, [bounds, selectionValue]);
  const isSelected = (row: number, column: number) =>
    Boolean(
      bounds
      && row >= bounds.rowStart
      && row <= bounds.rowEnd
      && column >= bounds.columnStart
      && column <= bounds.columnEnd,
    );
  const hasCustomWidths = Object.keys(columnWidths).length > 0;
  const customTableWidth = hasCustomWidths
    ? 58 + columns.reduce((total, column) => total + (columnWidths[column] ?? 160), 0)
    : undefined;
  const checkedColumns = useMemo(() => Array.from(new Set([
    ...(uniqueKey ? [uniqueKey] : []),
    ...duplicateColumns,
  ])).filter((column) => columns.includes(column)), [columns, duplicateColumns, uniqueKey]);
  const duplicateValues = useMemo(() => Object.fromEntries(
    checkedColumns.map((column) => {
      const counts = new Map<string, number>();
      records.forEach((record) => {
        const value = displayValue(record[column]);
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
      return [column, new Set(Array.from(counts).filter(([, count]) => count > 1).map(([value]) => value))];
    }),
  ) as Record<string, Set<string>>, [checkedColumns, records]);
  const uniqueDuplicateRows = uniqueKey
    ? records.filter((record) => duplicateValues[uniqueKey]?.has(displayValue(record[uniqueKey]))).length
    : 0;
  const duplicateSummary = duplicateColumns
    .filter((column) => columns.includes(column))
    .map((column) => `${column}: ${duplicateValues[column]?.size ?? 0}値`);
  const pinnedOffsets = useMemo(() => {
    let left = 58;
    const offsets: Record<string, number> = {};
    columns.forEach((column) => {
      if (!pinnedColumns.includes(column)) return;
      offsets[column] = left;
      left += columnWidths[column] ?? 160;
    });
    return offsets;
  }, [columnWidths, columns, pinnedColumns]);

  const freezeCurrentWidths = (table: HTMLTableElement | null) => {
    if (!table) return {};
    const measured = Object.fromEntries(
      Array.from(table.querySelectorAll<HTMLElement>("[data-grid-column]"))
        .map((item) => [item.dataset.gridColumn ?? "", Math.round(item.getBoundingClientRect().width)])
        .filter(([name]) => Boolean(name)),
    );
    setColumnWidths(measured);
    return measured;
  };

  const togglePinned = (column: string, table: HTMLTableElement | null) => {
    if (!hasCustomWidths) freezeCurrentWidths(table);
    setPinnedColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  };

  const columnStyle = (column: string) => ({
    ...(columnWidths[column]
      ? {
          width: columnWidths[column],
          minWidth: columnWidths[column],
          maxWidth: columnWidths[column],
        }
      : {}),
    ...(pinnedOffsets[column] !== undefined
      ? { position: "sticky" as const, left: pinnedOffsets[column] }
      : {}),
  });

  const addColumn = () => {
    const name = newColumn.trim();
    if (!name || columns.includes(name)) return;
    onRecordsChange?.(records.map((record) => ({ ...record, [name]: "" })));
    setColumnOrder([...columns, name]);
    setNewColumn("new_column");
  };

  const deleteColumn = (column: string) => {
    onRecordsChange?.(records.map((record) =>
      Object.fromEntries(Object.entries(record).filter(([key]) => key !== column)),
    ));
    setColumnOrder(columns.filter((item) => item !== column));
  };

  const updateCell = (originalIndex: number, column: string, value: string) => {
    onRecordsChange?.(records.map((record, index) =>
      index === originalIndex ? { ...record, [column]: value } : record,
    ));
  };

  if (!records.length || !columns.length) {
    return (
      <div className="json-grid-empty">
        <TableProperties size={24} />
        <strong>{emptyMessage}</strong>
        <span>ヘッダーを含むデータを入力してください。</span>
      </div>
    );
  }

  return (
    <div className="json-grid-panel">
      {rawPreview && (
        <div className="data-grid-view-tabs" role="tablist" aria-label="出力表示">
          <button type="button" role="tab" aria-selected={viewMode === "grid"} className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>
            Grid
          </button>
          <button type="button" role="tab" aria-selected={viewMode === "raw"} className={viewMode === "raw" ? "active" : ""} onClick={() => setViewMode("raw")}>
            Raw CSV
          </button>
        </div>
      )}
      <div className="json-grid-toolbar data-grid-toolbar">
        <div>
          <CopyButton value={JSON.stringify(visibleRecords, null, 2)} label="表示行 JSON" />
          <span><TableProperties size={15} />{visibleRecords.length} / {records.length} ROWS · {columns.length} COLUMNS</span>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={includeHeader}
              onChange={(event) => setIncludeHeader(event.target.checked)}
            />
            ヘッダーあり
          </label>
          <CopyButton value={toCsv([], columns, true)} label="列名のみ" />
          <CopyButton
            value={toCsv(visibleRecords, columns, includeHeader)}
            label="CSVコピー"
          />
          <CopyButton
            value={serializeGridRows(visibleRecords, columns, "\t", includeHeader)}
            label="TSVコピー"
          />
          <CopyButton value={selectionValue} label="選択範囲をコピー" />
          {onDownloadCsv && (
            <button type="button" onClick={() => onDownloadCsv(visibleRecords, columns)}>
              <Download size={14} />CSV
            </button>
          )}
        </div>
      </div>
      {editable && viewMode === "grid" && (
        <div className="data-grid-column-editor">
          <label>
            列名
            <input value={newColumn} onChange={(event) => setNewColumn(event.target.value)} />
          </label>
          <button type="button" onClick={addColumn} disabled={!newColumn.trim() || columns.includes(newColumn.trim())}>
            <Plus size={14} />列を追加
          </button>
          {enableDuplicateValidation && (
            <label>
              <KeyRound size={14} />
              UNIQUE KEY
              <select value={uniqueKey} onChange={(event) => setUniqueKey(event.target.value)}>
                <option value="">指定なし</option>
                {columns.map((column) => <option value={column} key={column}>{column}</option>)}
              </select>
            </label>
          )}
          <small>列のピンで横スクロール時に固定できます。</small>
        </div>
      )}
      {viewMode === "raw" && rawOutput ? (
        <div className="data-grid-raw">
          <div>
            <span>{rawOutput.meta ?? "DOWNLOAD PREVIEW"}</span>
            <CopyButton value={rawOutput.content} label="Rawをコピー" />
          </div>
          <pre>{rawOutput.content}</pre>
        </div>
      ) : <div className="json-grid-scroll" onMouseLeave={() => setSelecting(false)}>
        <table
          className={hasCustomWidths ? "has-custom-widths" : ""}
          style={customTableWidth
            ? { width: customTableWidth, minWidth: customTableWidth, maxWidth: customTableWidth }
            : undefined}
        >
          <colgroup>
            <col className="row-number-column" />
            {columns.map((column) => (
              <col
                key={column}
                style={columnWidths[column] ? { width: columnWidths[column] } : undefined}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="row-number">
                <button type="button" onClick={() => toggleSort("__row")} aria-label="行番号でソート">
                  {sort?.column === "__row"
                    ? sort.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    : <ArrowUpDown size={12} />}
                  <span>#</span>
                </button>
              </th>
              {columns.map((column) => (
                <th
                  key={column}
                  data-grid-column={column}
                  className={`${draggedColumn === column ? "dragging" : ""} ${pinnedOffsets[column] !== undefined ? "pinned" : ""}`.trim()}
                  style={columnStyle(column)}
                >
                  <div
                    onPointerDown={(event) => {
                      if ((event.target as HTMLElement).closest("button,input")) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      dragColumnRef.current = column;
                      setDraggedColumn(column);
                    }}
                    onPointerMove={(event) => {
                      if (!dragColumnRef.current || event.buttons !== 1) return;
                      const target = document
                        .elementFromPoint(event.clientX, event.clientY)
                        ?.closest<HTMLElement>("[data-grid-column]")
                        ?.dataset.gridColumn;
                      if (target) reorderColumn(dragColumnRef.current, target);
                    }}
                    onPointerUp={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                      dragColumnRef.current = null;
                      setDraggedColumn(null);
                    }}
                    title="ドラッグして列を移動"
                  >
                    <span
                      className="data-grid-drag-handle"
                    >
                      <GripVertical size={12} />
                      <strong>{column}</strong>
                    </span>
                    <span>
                      <CopyButton
                        value={toCsv(visibleRecords, [column], includeHeader)}
                        label={`${column}列をコピー`}
                        iconOnly
                      />
                      <button type="button" onClick={() => toggleSort(column)} aria-label={`${column}列をソート`}>
                        {sort?.column === column
                          ? sort.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          : <ArrowUpDown size={12} />}
                      </button>
                      <button
                        type="button"
                        className={pinnedColumns.includes(column) ? "active" : ""}
                        onClick={(event) => togglePinned(column, event.currentTarget.closest("table"))}
                        aria-label={`${column}列を${pinnedColumns.includes(column) ? "固定解除" : "左に固定"}`}
                        title={pinnedColumns.includes(column) ? "列の固定を解除" : "横スクロール時に左へ固定"}
                      >
                        {pinnedColumns.includes(column) ? <PinOff size={12} /> : <Pin size={12} />}
                      </button>
                      {enableDuplicateValidation && (
                        <button
                          type="button"
                          className={duplicateColumns.includes(column) ? "active" : ""}
                          onClick={() => setDuplicateColumns((current) =>
                            current.includes(column)
                              ? current.filter((item) => item !== column)
                              : [...current, column]
                          )}
                          aria-label={`${column}列の重複チェック`}
                          title="この列の重複を色付け"
                        >
                          <ScanSearch size={12} />
                        </button>
                      )}
                      {editable && (
                        <button type="button" onClick={() => deleteColumn(column)} aria-label={`${column}列を削除`}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </span>
                  </div>
                  <input
                    value={filters[column] ?? ""}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, [column]: event.target.value }))
                    }
                    placeholder="フィルタ"
                    aria-label={`${column}列をフィルタ`}
                  />
                  <span
                    className="data-grid-column-resizer"
                    role="separator"
                    aria-label={`${column}列の幅を変更`}
                    aria-orientation="vertical"
                    title="ドラッグして列幅を変更・ダブルクリックで初期化"
                    onPointerDown={(event) => startColumnResize(event, column)}
                    onDoubleClick={() =>
                      setColumnWidths((current) => {
                        const next = { ...current };
                        delete next[column];
                        return next;
                      })
                    }
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indexedRows.map(({ record, originalIndex }, rowIndex) => (
              <tr
                key={originalIndex}
                className={uniqueKey && duplicateValues[uniqueKey]?.has(displayValue(record[uniqueKey])) ? "duplicate-key-row" : ""}
              >
                <th className="row-number">
                  <CopyButton
                    value={toCsv([record], columns, includeHeader)}
                    label={`${originalIndex + 1}行目をコピー`}
                    iconOnly
                  />
                  <span>{originalIndex + 1}</span>
                </th>
                {columns.map((column, columnIndex) => (
                  <td
                    key={column}
                    className={[
                      isSelected(rowIndex, columnIndex) ? "selected" : "",
                      displayValue(record[column]).includes("\n") || displayValue(record[column]).includes("\r") ? "multiline" : "",
                      duplicateValues[column]?.has(displayValue(record[column])) ? "duplicate-value" : "",
                      pinnedOffsets[column] !== undefined ? "pinned" : "",
                    ].filter(Boolean).join(" ")}
                    style={columnStyle(column)}
                    title={displayValue(record[column])}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setSelectionStart({ row: rowIndex, column: columnIndex });
                      setSelectionEnd({ row: rowIndex, column: columnIndex });
                      setSelecting(true);
                    }}
                    onMouseEnter={() => {
                      if (selecting) setSelectionEnd({ row: rowIndex, column: columnIndex });
                    }}
                    onDoubleClick={(event) => {
                      if (editable) event.currentTarget.focus();
                    }}
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(event) => {
                      if (editable) updateCell(originalIndex, column, event.currentTarget.textContent ?? "");
                    }}
                  >
                    {displayValue(record[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleRecords.length && <div className="json-grid-no-results">フィルタに一致する行がありません</div>}
      </div>}
      <div className="data-grid-selection-status">
        <span>
          {bounds
            ? `${bounds.rowEnd - bounds.rowStart + 1}行 × ${bounds.columnEnd - bounds.columnStart + 1}列を選択 · Ctrl/⌘+CでCSVコピー`
            : "セルをドラッグして範囲選択"}
        </span>
        <span>グリップ=列移動 · ピン=スクロール固定 · 虫眼鏡=重複チェック</span>
      </div>
      {enableDuplicateValidation && (uniqueKey || duplicateColumns.length > 0) && (
        <div className={`data-grid-duplicate-status ${uniqueDuplicateRows ? "error" : ""}`} role="status">
          <strong>{uniqueKey ? `UNIQUE ${uniqueKey}` : "DUPLICATE CHECK"}</strong>
          <span>
            {uniqueKey
              ? uniqueDuplicateRows
                ? `${uniqueDuplicateRows}行が重複しています`
                : "重複はありません"
              : duplicateSummary.join(" · ")}
          </span>
          {uniqueKey && duplicateSummary.length > 0 && <small>{duplicateSummary.join(" · ")}</small>}
        </div>
      )}
    </div>
  );
}
