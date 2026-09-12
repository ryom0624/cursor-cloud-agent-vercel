"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  GripVertical,
  Plus,
  TableProperties,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";

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

function serializeRows(
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
};

export function DataGrid({
  records,
  emptyMessage = "表示できる行がありません",
  editable = false,
  onRecordsChange,
  onDownloadCsv,
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

  useEffect(() => {
    const stopSelecting = () => setSelecting(false);
    window.addEventListener("mouseup", stopSelecting);
    return () => window.removeEventListener("mouseup", stopSelecting);
  }, []);

  const sourceColumns = useMemo(
    () => Array.from(new Set(records.flatMap((record) => Object.keys(record)))),
    [records],
  );
  const columns = [
    ...columnOrder.filter((column) => sourceColumns.includes(column)),
    ...sourceColumns.filter((column) => !columnOrder.includes(column)),
  ];
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

  const toggleSort = (column: string) => {
    setSort((current) => {
      if (current?.column !== column) return { column, direction: "asc" };
      if (current.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  };

  const dropColumn = (source: string, target: string) => {
    if (!source || source === target) return;
    const next = [...columns];
    const from = next.indexOf(source);
    const to = next.indexOf(target);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, source);
    setColumnOrder(next);
    setDraggedColumn(null);
  };

  const bounds = selectionStart && selectionEnd
    ? {
        rowStart: Math.min(selectionStart.row, selectionEnd.row),
        rowEnd: Math.max(selectionStart.row, selectionEnd.row),
        columnStart: Math.min(selectionStart.column, selectionEnd.column),
        columnEnd: Math.max(selectionStart.column, selectionEnd.column),
      }
    : null;
  const selectionRecords = bounds
    ? visibleRecords.slice(bounds.rowStart, bounds.rowEnd + 1)
    : [];
  const selectionColumns = bounds
    ? columns.slice(bounds.columnStart, bounds.columnEnd + 1)
    : [];
  const selectionValue = serializeRows(
    selectionRecords,
    selectionColumns,
    "\t",
    includeHeader,
  );
  const isSelected = (row: number, column: number) =>
    Boolean(
      bounds
      && row >= bounds.rowStart
      && row <= bounds.rowEnd
      && column >= bounds.columnStart
      && column <= bounds.columnEnd,
    );

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
          <CopyButton
            value={serializeRows(visibleRecords, columns, ",", includeHeader)}
            label="CSVコピー"
          />
          <CopyButton
            value={serializeRows(visibleRecords, columns, "\t", includeHeader)}
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
      {editable && (
        <div className="data-grid-column-editor">
          <label>
            列名
            <input value={newColumn} onChange={(event) => setNewColumn(event.target.value)} />
          </label>
          <button type="button" onClick={addColumn} disabled={!newColumn.trim() || columns.includes(newColumn.trim())}>
            <Plus size={14} />列を追加
          </button>
          <small>セルは直接編集できます。列削除は各ヘッダーのごみ箱から行えます。</small>
        </div>
      )}
      <div className="json-grid-scroll" onMouseLeave={() => setSelecting(false)}>
        <table>
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
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropColumn(event.dataTransfer.getData("text/plain") || draggedColumn || "", column);
                  }}
                  className={draggedColumn === column ? "dragging" : ""}
                >
                  <div
                    draggable
                    onDragStart={(event) => {
                      setDraggedColumn(column);
                      event.dataTransfer.setData("text/plain", column);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDraggedColumn(null)}
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
                        value={serializeRows(visibleRecords, [column], "\t", includeHeader)}
                        label={`${column}列をコピー`}
                        iconOnly
                      />
                      <button type="button" onClick={() => toggleSort(column)} aria-label={`${column}列をソート`}>
                        {sort?.column === column
                          ? sort.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          : <ArrowUpDown size={12} />}
                      </button>
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
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indexedRows.map(({ record, originalIndex }, rowIndex) => (
              <tr key={originalIndex}>
                <th className="row-number">
                  <CopyButton
                    value={serializeRows([record], columns, "\t", includeHeader)}
                    label={`${originalIndex + 1}行目をコピー`}
                    iconOnly
                  />
                  <span>{originalIndex + 1}</span>
                </th>
                {columns.map((column, columnIndex) => (
                  <td
                    key={column}
                    className={isSelected(rowIndex, columnIndex) ? "selected" : ""}
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
      </div>
      <div className="data-grid-selection-status">
        <span>
          {bounds
            ? `${bounds.rowEnd - bounds.rowStart + 1}行 × ${bounds.columnEnd - bounds.columnStart + 1}列を選択`
            : "セルをドラッグして範囲選択"}
        </span>
        <span>列名のグリップをドラッグして移動</span>
      </div>
    </div>
  );
}
