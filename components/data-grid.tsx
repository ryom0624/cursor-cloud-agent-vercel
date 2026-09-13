"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Asterisk,
  Download,
  Filter,
  GripVertical,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  SquareStack,
  TableProperties,
  Trash2,
  WrapText,
} from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CopyButton, copyText } from "@/components/copy-button";
import { parseCsv } from "@/lib/csv-utils";
import {
  countBlankRows,
  describeRequiredColumnValidation,
  describeUniqueKeyValidation,
  isBlankGridValue,
} from "@/lib/grid-validation";

export type DataGridRecord = Record<string, unknown>;

type SortState =
  | { column: string; direction: "asc" | "desc" }
  | null;
type CellPosition = { row: number; column: number };

function readEditableText(element: HTMLElement) {
  return (element.innerText ?? element.textContent ?? "").replaceAll("\u00a0", " ").replace(/\n$/, "");
}

function focusGridCell(row: number, column: number, placeCaret = false) {
  const element = document.querySelector<HTMLElement>(
    `td[data-grid-row="${row}"][data-grid-col="${column}"]`,
  );
  if (!element) {
    return;
  }
  element.focus();
  if (!placeCaret) {
    return;
  }
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

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
  onDownloadXlsx?: (records: DataGridRecord[], columns: string[]) => void;
  onDownloadAllCsv?: (records: DataGridRecord[], columns: string[]) => void;
  onDownloadAllXlsx?: (records: DataGridRecord[], columns: string[]) => void;
  columnLabels?: Record<string, string>;
  exportSplit?: boolean;
  allExportCount?: number;
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
  onReset?: () => void;
  resetDisabled?: boolean;
  resetLabel?: string;
  resetTitle?: string;
  enableRowDelete?: boolean;
  enableColumnRename?: boolean;
  onRenameColumn?: (column: string, nextLabel: string) => void;
};

export function DataGrid({
  records,
  emptyMessage = "表示できる行がありません",
  editable = false,
  onRecordsChange,
  onDownloadCsv,
  onDownloadXlsx,
  onDownloadAllCsv,
  onDownloadAllXlsx,
  columnLabels,
  exportSplit = false,
  allExportCount,
  csvSerializer,
  rawPreview,
  enableDuplicateValidation = false,
  onReset,
  resetDisabled = false,
  resetLabel = "出力をリセット",
  resetTitle = "Gridの編集を破棄し、いまの入力CSVの解析結果に戻します",
  enableRowDelete = false,
  enableColumnRename = false,
  onRenameColumn,
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
  const [requiredColumns, setRequiredColumns] = useState<string[]>([]);
  const [duplicateColumns, setDuplicateColumns] = useState<string[]>([]);
  const [duplicateFilterColumns, setDuplicateFilterColumns] = useState<string[]>([]);
  const [openHeaderMenu, setOpenHeaderMenu] = useState<string | null>(null);
  const [pinnedColumns, setPinnedColumns] = useState<string[]>([]);
  const [wrappedColumns, setWrappedColumns] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [renamingColumn, setRenamingColumn] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const dragColumnRef = useRef<string | null>(null);
  const editingCellRef = useRef<CellPosition | null>(null);
  const selectionEndRef = useRef<CellPosition | null>(null);

  useEffect(() => {
    editingCellRef.current = editingCell;
  }, [editingCell]);

  useEffect(() => {
    selectionEndRef.current = selectionEnd;
  }, [selectionEnd]);

  useEffect(() => {
    const stopSelecting = () => setSelecting(false);
    window.addEventListener("mouseup", stopSelecting);
    return () => window.removeEventListener("mouseup", stopSelecting);
  }, []);

  useEffect(() => {
    if (!openHeaderMenu) return;
    const closeMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-column-header-menu]")) return;
      setOpenHeaderMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenHeaderMenu(null);
    };
    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openHeaderMenu]);

  const sourceColumns = useMemo(() => {
    const fromRecords = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
    if (fromRecords.length) {
      return fromRecords;
    }
    return Object.keys(columnLabels ?? {});
  }, [columnLabels, records]);
  const columns = useMemo(() => [
    ...columnOrder.filter((column) => sourceColumns.includes(column)),
    ...sourceColumns.filter((column) => !columnOrder.includes(column)),
  ], [columnOrder, sourceColumns]);
  const checkedColumns = useMemo(() => Array.from(new Set([
    ...(uniqueKey ? [uniqueKey] : []),
    ...duplicateColumns,
    ...duplicateFilterColumns,
  ])).filter((column) => columns.includes(column)), [columns, duplicateColumns, duplicateFilterColumns, uniqueKey]);
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
  const indexedRows = useMemo(() => {
    const filtered = records
      .map((record, originalIndex) => ({ record, originalIndex }))
      .filter(({ record }) => {
        const matchesTextFilters = sourceColumns.every((column) => {
          const query = (filters[column] ?? "").trim().toLocaleLowerCase();
          return !query || displayValue(record[column]).toLocaleLowerCase().includes(query);
        });
        if (!matchesTextFilters) return false;
        if (!duplicateFilterColumns.length) return true;
        return duplicateFilterColumns.some((column) =>
          duplicateValues[column]?.has(displayValue(record[column])),
        );
      });
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
  }, [duplicateFilterColumns, duplicateValues, filters, records, sort, sourceColumns]);
  const visibleRecords = indexedRows.map(({ record }) => record);
  const rowCount = indexedRows.length;
  const columnCount = columns.length;
  const moveCell = useMemo(() => (
    row: number,
    column: number,
    rowDelta: number,
    columnDelta: number,
  ) => {
    let nextRow = row + rowDelta;
    let nextColumn = column + columnDelta;
    if (columnDelta !== 0) {
      if (nextColumn >= columnCount) {
        nextColumn = 0;
        nextRow += 1;
      } else if (nextColumn < 0) {
        nextColumn = columnCount - 1;
        nextRow -= 1;
      }
    }
    return {
      row: Math.max(0, Math.min(Math.max(rowCount - 1, 0), nextRow)),
      column: Math.max(0, Math.min(Math.max(columnCount - 1, 0), nextColumn)),
    };
  }, [columnCount, rowCount]);
  const labelFor = (column: string) => columnLabels?.[column] ?? column;
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
  const selectionValue = bounds
    ? bounds.rowStart === bounds.rowEnd && bounds.columnStart === bounds.columnEnd
      ? displayValue(selectionRecords[0]?.[selectionColumns[0]])
      : toCsv(selectionRecords, selectionColumns, false)
    : "";
  const rawOutput = rawPreview?.(visibleRecords, columns);

  useEffect(() => {
    const copySelection = (event: KeyboardEvent) => {
      if (!bounds || viewMode !== "grid") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      if (target?.closest("[contenteditable='true']") && editingCell) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "c") return;
      event.preventDefault();
      void copyText(selectionValue);
    };
    window.addEventListener("keydown", copySelection);
    return () => window.removeEventListener("keydown", copySelection);
  }, [bounds, editingCell, selectionValue, viewMode]);

  useEffect(() => {
    const navigateSelection = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!editable || !bounds || viewMode !== "grid") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      if (editingCellRef.current) return;
      const inGrid = Boolean(
        target?.closest(".json-grid-scroll, .json-grid-panel, td[data-grid-row]")
        || (document.activeElement instanceof HTMLElement
          && document.activeElement.closest("td[data-grid-row]")),
      );
      if (!inGrid) return;

      const origin = selectionEndRef.current ?? {
        row: bounds.rowStart,
        column: bounds.columnStart,
      };
      const applyMove = (rowDelta: number, columnDelta: number) => {
        event.preventDefault();
        const next = moveCell(origin.row, origin.column, rowDelta, columnDelta);
        setSelectionStart(next);
        setSelectionEnd(next);
        setSelecting(false);
        requestAnimationFrame(() => focusGridCell(next.row, next.column));
      };

      if ((event.key === "Delete" || event.key === "Backspace") && onRecordsChange) {
        event.preventDefault();
        const nextRecords = records.map((record) => ({ ...record }));
        for (let row = bounds.rowStart; row <= bounds.rowEnd; row += 1) {
          const targetRow = indexedRows[row];
          if (!targetRow) continue;
          for (let column = bounds.columnStart; column <= bounds.columnEnd; column += 1) {
            const targetColumn = columns[column];
            if (targetColumn) nextRecords[targetRow.originalIndex][targetColumn] = "";
          }
        }
        onRecordsChange(nextRecords);
        return;
      }

      if (event.key === "ArrowUp") {
        applyMove(-1, 0);
        return;
      }
      if (event.key === "ArrowDown") {
        applyMove(1, 0);
        return;
      }
      if (event.key === "ArrowLeft") {
        applyMove(0, -1);
        return;
      }
      if (event.key === "ArrowRight") {
        applyMove(0, 1);
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        applyMove(1, 0);
        return;
      }

      if (event.key === "Tab") {
        applyMove(0, event.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener("keydown", navigateSelection);
    return () => window.removeEventListener("keydown", navigateSelection);
  }, [bounds, columns, editable, indexedRows, moveCell, onRecordsChange, records, viewMode]);

  useEffect(() => {
    if (!editingCell) {
      return;
    }
    const frame = requestAnimationFrame(() => focusGridCell(editingCell.row, editingCell.column, true));
    return () => cancelAnimationFrame(frame);
  }, [editingCell]);

  useEffect(() => {
    const pasteSelection = (event: ClipboardEvent) => {
      if (!editable || !bounds || !onRecordsChange || viewMode !== "grid") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      if (target?.closest("[contenteditable='true']") && editingCell) return;
      const clipboard = event.clipboardData?.getData("text/plain") ?? "";
      if (!clipboard) return;

      const isSingleValue = !/[\t\r\n]/.test(clipboard);
      const pastedRows = isSingleValue
        ? [[clipboard]]
        : parseCsv(clipboard, {
            delimiter: clipboard.includes("\t") ? "\t" : "auto",
            skipEmptyLines: false,
          });
      if (!pastedRows.length) return;

      event.preventDefault();
      const nextRecords = records.map((record) => ({ ...record }));
      let pastedRowCount = 0;
      let pastedColumnCount = 0;
      pastedRows.forEach((row, rowOffset) => {
        const targetRow = indexedRows[bounds.rowStart + rowOffset];
        if (!targetRow) return;
        pastedRowCount = rowOffset + 1;
        row.forEach((value, columnOffset) => {
          const targetColumn = columns[bounds.columnStart + columnOffset];
          if (!targetColumn) return;
          nextRecords[targetRow.originalIndex][targetColumn] = value;
          pastedColumnCount = Math.max(pastedColumnCount, columnOffset + 1);
        });
      });
      if (!pastedRowCount || !pastedColumnCount) return;
      onRecordsChange(nextRecords);
      setSelectionEnd({
        row: bounds.rowStart + pastedRowCount - 1,
        column: bounds.columnStart + pastedColumnCount - 1,
      });
    };
    window.addEventListener("paste", pasteSelection);
    return () => window.removeEventListener("paste", pasteSelection);
  }, [bounds, columns, editable, editingCell, indexedRows, onRecordsChange, records, viewMode]);
  const isSelected = (row: number, column: number) =>
    Boolean(
      bounds
      && row >= bounds.rowStart
      && row <= bounds.rowEnd
      && column >= bounds.columnStart
      && column <= bounds.columnEnd,
    );
  const hasCustomWidths = Object.keys(columnWidths).length > 0;
  const rowNumberWidth = enableRowDelete ? 82 : 58;
  const customTableWidth = hasCustomWidths
    ? rowNumberWidth + columns.reduce((total, column) => total + (columnWidths[column] ?? 160), 0)
    : undefined;
  const uniqueDuplicateRows = uniqueKey
    ? records.filter((record) => duplicateValues[uniqueKey]?.has(displayValue(record[uniqueKey]))).length
    : 0;
  const uniqueBlankRows = uniqueKey ? countBlankRows(records, uniqueKey) : 0;
  const requiredColumnStats = requiredColumns
    .filter((column) => columns.includes(column))
    .map((column) => ({ column, blankRows: countBlankRows(records, column) }));
  const requiredBlankTotal = requiredColumnStats.reduce((total, item) => total + item.blankRows, 0);
  const duplicateSummary = duplicateColumns
    .filter((column) => columns.includes(column))
    .map((column) => `${labelFor(column)}: ${duplicateValues[column]?.size ?? 0}値`);
  const duplicateFilterSummary = duplicateFilterColumns
    .filter((column) => columns.includes(column))
    .map((column) => `${labelFor(column)}の重複行`);
  const duplicateValueTotal = duplicateColumns
    .filter((column) => columns.includes(column))
    .reduce((total, column) => total + (duplicateValues[column]?.size ?? 0), 0);
  const validationHasError =
    uniqueBlankRows > 0
    || uniqueDuplicateRows > 0
    || requiredBlankTotal > 0
    || duplicateValueTotal > 0;
  const toggleDuplicateColumn = (column: string) => {
    setDuplicateColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  };
  const toggleDuplicateFilter = (column: string) => {
    setDuplicateFilterColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  };
  const toggleWrappedColumn = (column: string) => {
    setWrappedColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  };
  const isRequiredColumn = (column: string) => requiredColumns.includes(column) || column === uniqueKey;
  const isBlankValidatedCell = (column: string, value: unknown) =>
    isRequiredColumn(column) && isBlankGridValue(value);
  const toggleRequiredColumn = (column: string) => {
    setRequiredColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  };
  const pinnedOffsets = useMemo(() => {
    let left = rowNumberWidth;
    const offsets: Record<string, number> = {};
    columns.forEach((column) => {
      if (!pinnedColumns.includes(column)) return;
      offsets[column] = left;
      left += columnWidths[column] ?? 160;
    });
    return offsets;
  }, [columnWidths, columns, pinnedColumns, rowNumberWidth]);

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
    const baseRecords = records.length
      ? records
      : [Object.fromEntries(columns.map((column) => [column, ""]))];
    onRecordsChange?.(baseRecords.map((record) => ({ ...record, [name]: "" })));
    setColumnOrder([...columns, name]);
    setNewColumn("new_column");
  };

  const addRow = () => {
    if (!columns.length || !onRecordsChange) {
      return;
    }
    onRecordsChange([
      ...records,
      Object.fromEntries(columns.map((column) => [column, ""])),
    ]);
  };

  const stopHeaderGesture = (event: { stopPropagation: () => void; preventDefault?: () => void }) => {
    event.stopPropagation();
  };

  const startColumnDrag = (event: ReactPointerEvent<HTMLElement>, column: string) => {
    event.preventDefault();
    event.stopPropagation();
    dragColumnRef.current = column;
    setDraggedColumn(column);
    const move = (pointerEvent: PointerEvent) => {
      if (!dragColumnRef.current) return;
      const target = document
        .elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
        ?.closest<HTMLElement>("[data-grid-column]")
        ?.dataset.gridColumn;
      if (target) reorderColumn(dragColumnRef.current, target);
    };
    const stop = () => {
      dragColumnRef.current = null;
      setDraggedColumn(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const deleteRow = (originalIndex: number) => {
    if (!onRecordsChange) return;
    onRecordsChange(records.filter((_, index) => index !== originalIndex));
  };

  const commitColumnRename = (column: string) => {
    const next = renameDraft.trim();
    setRenamingColumn(null);
    if (!next || next === labelFor(column)) return;
    onRenameColumn?.(column, next);
  };

  const deleteColumn = (column: string) => {
    onRecordsChange?.(records.map((record) =>
      Object.fromEntries(Object.entries(record).filter(([key]) => key !== column)),
    ));
    setColumnOrder(columns.filter((item) => item !== column));
    if (uniqueKey === column) setUniqueKey("");
    setRequiredColumns((current) => current.filter((item) => item !== column));
    setDuplicateColumns((current) => current.filter((item) => item !== column));
  };

  const updateCell = (originalIndex: number, column: string, value: string) => {
    onRecordsChange?.(records.map((record, index) =>
      index === originalIndex ? { ...record, [column]: value } : record,
    ));
  };

  const commitEditingCell = () => {
    if (!editingCell || !editable) {
      return null;
    }
    const element = document.querySelector<HTMLElement>(
      `td[data-grid-row="${editingCell.row}"][data-grid-col="${editingCell.column}"]`,
    );
    const targetRow = indexedRows[editingCell.row];
    const targetColumn = columns[editingCell.column];
    if (element && targetRow && targetColumn) {
      updateCell(targetRow.originalIndex, targetColumn, readEditableText(element));
    }
    const current = editingCell;
    setEditingCell(null);
    return current;
  };

  const commitAndMove = (rowDelta: number, columnDelta: number) => {
    const current = commitEditingCell() ?? editingCell;
    if (!current) {
      return;
    }
    const next = moveCell(current.row, current.column, rowDelta, columnDelta);
    setSelectionStart(next);
    setSelectionEnd(next);
    setSelecting(false);
    requestAnimationFrame(() => focusGridCell(next.row, next.column));
  };

  if (!columns.length) {
    return (
      <div className="json-grid-empty">
        <TableProperties size={24} />
        <strong>{emptyMessage}</strong>
        <span>ヘッダーを含むデータを入力してください。</span>
      </div>
    );
  }

  return (
    <div
      className="json-grid-panel"
      onMouseDown={(event) => {
        if (!editingCell) {
          return;
        }
        const target = event.target as HTMLElement;
        if (target.closest("[contenteditable='true']")) {
          return;
        }
        commitEditingCell();
      }}
    >
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
          <CopyButton value={selectionValue} label="選択セルをコピー" />
          {exportSplit && onDownloadAllCsv && (
            <button
              type="button"
              title="編集済みの全行をCSVで保存します。filter / sort は反映しません。"
              onClick={() => onDownloadAllCsv(records, columns)}
            >
              <Download size={14} />全件をCSV {allExportCount ?? records.length}件
            </button>
          )}
          {onDownloadCsv && (
            <button
              type="button"
              title={exportSplit ? "いま見えている行だけをCSVで保存します。filter / sort 後の結果です。" : "CSV"}
              onClick={() => onDownloadCsv(visibleRecords, columns)}
            >
              <Download size={14} />
              {exportSplit ? `表示中をCSV ${visibleRecords.length}件` : "CSV"}
            </button>
          )}
          {exportSplit && onDownloadAllXlsx && (
            <button
              type="button"
              title="編集済みの全行をXLSXで保存します。filter / sort は反映しません。"
              onClick={() => onDownloadAllXlsx(records, columns)}
            >
              <Download size={14} />全件をXLSX {allExportCount ?? records.length}件
            </button>
          )}
          {onDownloadXlsx && (
            <button
              type="button"
              title={exportSplit ? "いま見えている行だけをXLSXで保存します。filter / sort 後の結果です。" : "XLSX"}
              onClick={() => onDownloadXlsx(visibleRecords, columns)}
            >
              <Download size={14} />
              {exportSplit ? `表示中をXLSX ${visibleRecords.length}件` : "XLSX"}
            </button>
          )}
          {exportSplit && (
            <small className="data-grid-export-hint">全件=編集後の全行 / 表示中=filter・sort後</small>
          )}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              disabled={resetDisabled}
              title={resetTitle}
            >
              <RotateCcw size={14} />{resetLabel}
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
          <button type="button" onClick={addRow}>
            <Plus size={14} />行を追加
          </button>
          {enableDuplicateValidation && (
            <>
              <label>
                <KeyRound size={14} />
                UNIQUE KEY
                <select value={uniqueKey} onChange={(event) => setUniqueKey(event.target.value)}>
                  <option value="">指定なし</option>
                  {columns.map((column) => <option value={column} key={column}>{labelFor(column)}</option>)}
                </select>
              </label>
              <label>
                <Asterisk size={14} />
                必須列
                <select
                  value=""
                  onChange={(event) => {
                    const column = event.target.value;
                    if (column) toggleRequiredColumn(column);
                  }}
                  aria-label="必須列を追加"
                >
                  <option value="">列を追加</option>
                  {columns.filter((column) => !requiredColumns.includes(column)).map((column) => (
                    <option value={column} key={column}>{labelFor(column)}</option>
                  ))}
                </select>
              </label>
              {requiredColumns.filter((column) => columns.includes(column)).map((column) => (
                <button
                  type="button"
                  className="data-grid-chip"
                  key={column}
                  onClick={() => toggleRequiredColumn(column)}
                  title={`${labelFor(column)}を必須列から外す`}
                >
                  {labelFor(column)}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </>
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
          className={`${hasCustomWidths ? "has-custom-widths" : ""} ${enableRowDelete ? "has-row-delete" : ""}`.trim()}
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
              {columns.map((column) => {
                const isPinned = pinnedColumns.includes(column);
                const isRequired = requiredColumns.includes(column);
                const isDuplicateCheck = duplicateColumns.includes(column);
                const isDuplicateFilter = duplicateFilterColumns.includes(column);
                const isWrapped = wrappedColumns.includes(column);
                const menuOpen = openHeaderMenu === column;
                const hiddenActionActive = isPinned || isRequired || isDuplicateCheck || isDuplicateFilter || isWrapped;
                return (
                <th
                  key={column}
                  data-grid-column={column}
                  className={[
                    draggedColumn === column ? "dragging" : "",
                    pinnedOffsets[column] !== undefined ? "pinned" : "",
                    menuOpen ? "menu-open" : "",
                  ].filter(Boolean).join(" ")}
                  style={columnStyle(column)}
                >
                  <div className="data-grid-column-heading">
                    <span
                      className="data-grid-drag-handle"
                      title="ドラッグして列を移動"
                      onPointerDown={(event) => startColumnDrag(event, column)}
                    >
                      <GripVertical size={12} />
                      {enableColumnRename && renamingColumn === column ? (
                        <input
                          className="data-grid-rename"
                          value={renameDraft}
                          aria-label={`${labelFor(column)}列名を編集`}
                          onPointerDown={stopHeaderGesture}
                          onMouseDown={stopHeaderGesture}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={() => commitColumnRename(column)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitColumnRename(column);
                            }
                            if (event.key === "Escape") setRenamingColumn(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <strong
                          className={enableColumnRename ? "is-renamable" : undefined}
                          title={enableColumnRename ? "クリックして列名を編集" : undefined}
                          onPointerDown={enableColumnRename ? stopHeaderGesture : undefined}
                          onMouseDown={enableColumnRename ? stopHeaderGesture : undefined}
                          onClick={enableColumnRename ? (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setRenamingColumn(column);
                            setRenameDraft(labelFor(column));
                          } : undefined}
                        >
                          {labelFor(column)}
                        </strong>
                      )}
                    </span>
                    <span
                      className="data-grid-column-actions"
                      data-column-header-menu={column}
                      onPointerDown={stopHeaderGesture}
                      onMouseDown={stopHeaderGesture}
                    >
                      <CopyButton
                        value={toCsv(visibleRecords, [column], includeHeader)}
                        label={`${labelFor(column)}列をコピー`}
                        iconOnly
                      />
                      <button type="button" onClick={() => toggleSort(column)} aria-label={`${labelFor(column)}列をソート`}>
                        {sort?.column === column
                          ? sort.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          : <ArrowUpDown size={12} />}
                      </button>
                      <button
                        type="button"
                        className={[
                          "data-grid-more-button",
                          hiddenActionActive ? "has-active" : "",
                          isDuplicateCheck || isDuplicateFilter ? "dup-active" : "",
                          hiddenActionActive && !isDuplicateCheck && !isDuplicateFilter ? "active" : "",
                        ].filter(Boolean).join(" ")}
                        aria-label={`${labelFor(column)}列のその他の操作`}
                        aria-expanded={menuOpen}
                        title="その他の列操作"
                        onClick={() => setOpenHeaderMenu((current) => current === column ? null : column)}
                      >
                        <MoreHorizontal size={12} />
                      </button>
                      {menuOpen && (
                        <div className="data-grid-column-menu" role="menu" data-column-header-menu={column}>
                          {enableColumnRename && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setRenamingColumn(column);
                                setRenameDraft(labelFor(column));
                                setOpenHeaderMenu(null);
                              }}
                            >
                              <Pencil size={12} />
                              列名を編集
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            className={isPinned ? "is-active" : ""}
                            onClick={(event) => {
                              togglePinned(column, event.currentTarget.closest("table"));
                              setOpenHeaderMenu(null);
                            }}
                          >
                            {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                            {isPinned ? "列の固定を解除" : "列を左に固定"}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className={isWrapped ? "is-active" : ""}
                            onClick={() => {
                              toggleWrappedColumn(column);
                              setOpenHeaderMenu(null);
                            }}
                          >
                            <WrapText size={12} />
                            {isWrapped ? "折り返しを解除" : "長い文字を折り返して表示"}
                          </button>
                          {enableDuplicateValidation && (
                            <>
                              <button
                                type="button"
                                role="menuitem"
                                className={isRequired ? "is-active" : ""}
                                onClick={() => {
                                  toggleRequiredColumn(column);
                                  setOpenHeaderMenu(null);
                                }}
                              >
                                <Asterisk size={12} />
                                {isRequired ? "必須を解除" : "必須列にする"}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={isDuplicateCheck ? "is-dup-active" : ""}
                                onClick={() => {
                                  toggleDuplicateColumn(column);
                                  setOpenHeaderMenu(null);
                                }}
                              >
                                <SquareStack size={12} />
                                {isDuplicateCheck ? "重複ハイライトをオフ" : "重複をハイライト"}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={isDuplicateFilter ? "is-dup-active" : ""}
                                onClick={() => {
                                  toggleDuplicateFilter(column);
                                  setOpenHeaderMenu(null);
                                }}
                              >
                                <Filter size={12} />
                                {isDuplicateFilter ? "重複絞り込みを解除" : "この列の重複行だけ表示"}
                              </button>
                            </>
                          )}
                          {editable && (
                            <button
                              type="button"
                              role="menuitem"
                              className="is-danger"
                              onClick={() => {
                                deleteColumn(column);
                                setOpenHeaderMenu(null);
                              }}
                            >
                              <Trash2 size={12} />
                              列を削除
                            </button>
                          )}
                        </div>
                      )}
                    </span>
                  </div>
                  <input
                    value={filters[column] ?? ""}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, [column]: event.target.value }))
                    }
                    placeholder="フィルタ"
                    aria-label={`${labelFor(column)}列をフィルタ`}
                  />
                  <span
                    className="data-grid-column-resizer"
                    role="separator"
                    aria-label={`${labelFor(column)}列の幅を変更`}
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
                );
              })}
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
                  {editable && enableRowDelete && (
                    <button
                      type="button"
                      className="data-grid-delete-row"
                      onClick={() => deleteRow(originalIndex)}
                      aria-label={`${originalIndex + 1}行目を削除`}
                      title="この行を削除"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </th>
                {columns.map((column, columnIndex) => (
                  <td
                    key={column}
                    data-grid-row={rowIndex}
                    data-grid-col={columnIndex}
                    className={[
                      isSelected(rowIndex, columnIndex) ? "selected" : "",
                      displayValue(record[column]).includes("\n") || displayValue(record[column]).includes("\r") || wrappedColumns.includes(column) ? "multiline" : "",
                      wrappedColumns.includes(column) ? "wrap-text" : "",
                      duplicateValues[column]?.has(displayValue(record[column])) ? "duplicate-value" : "",
                      isBlankValidatedCell(column, record[column]) ? "blank-value" : "",
                      pinnedOffsets[column] !== undefined ? "pinned" : "",
                    ].filter(Boolean).join(" ")}
                    style={columnStyle(column)}
                    title={
                      isBlankValidatedCell(column, record[column])
                        ? column === uniqueKey ? "UNIQUE KEYが空欄です" : "必須列が空欄です"
                        : displayValue(record[column])
                    }
                    tabIndex={-1}
                    onMouseDown={(event) => {
                      if (event.detail >= 2 && editable) {
                        event.preventDefault();
                        if (!(editingCell?.row === rowIndex && editingCell.column === columnIndex)) {
                          commitEditingCell();
                        }
                        setSelecting(false);
                        setSelectionStart({ row: rowIndex, column: columnIndex });
                        setSelectionEnd({ row: rowIndex, column: columnIndex });
                        setEditingCell({ row: rowIndex, column: columnIndex });
                        return;
                      }
                      if (editingCell?.row === rowIndex && editingCell.column === columnIndex) return;
                      commitEditingCell();
                      event.preventDefault();
                      setSelectionStart({ row: rowIndex, column: columnIndex });
                      setSelectionEnd({ row: rowIndex, column: columnIndex });
                      setSelecting(true);
                      event.currentTarget.focus();
                    }}
                    onMouseEnter={() => {
                      if (selecting) setSelectionEnd({ row: rowIndex, column: columnIndex });
                    }}
                    onPointerMove={(event) => {
                      if (!selecting || event.buttons !== 1) return;
                      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("td");
                      if (!target) return;
                      const targetRow = Number(target.dataset.gridRow);
                      const targetColumn = Number(target.dataset.gridCol);
                      if (Number.isNaN(targetRow) || Number.isNaN(targetColumn)) return;
                      setSelectionEnd({ row: targetRow, column: targetColumn });
                    }}
                    onPointerUp={(event) => {
                      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("td");
                      if (!target) return;
                      const targetRow = Number(target.dataset.gridRow);
                      const targetColumn = Number(target.dataset.gridCol);
                      if (Number.isNaN(targetRow) || Number.isNaN(targetColumn)) return;
                      setSelectionEnd({ row: targetRow, column: targetColumn });
                    }}
                    onDoubleClick={(event) => {
                      if (!editable) return;
                      event.preventDefault();
                      setSelecting(false);
                      setSelectionStart({ row: rowIndex, column: columnIndex });
                      setSelectionEnd({ row: rowIndex, column: columnIndex });
                      setEditingCell({ row: rowIndex, column: columnIndex });
                    }}
                    contentEditable={editable && editingCell?.row === rowIndex && editingCell.column === columnIndex}
                    suppressContentEditableWarning
                    onKeyDown={(event) => {
                      if (!editingCell) {
                        return;
                      }
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.stopPropagation();
                        commitAndMove(1, 0);
                        return;
                      }
                      if (event.key === "Tab") {
                        event.preventDefault();
                        event.stopPropagation();
                        commitAndMove(0, event.shiftKey ? -1 : 1);
                      }
                    }}
                    onBlur={(event) => {
                      if (editable) updateCell(originalIndex, column, readEditableText(event.currentTarget));
                      setEditingCell(null);
                    }}
                  >
                    {displayValue(record[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleRecords.length && (
          <div className="json-grid-no-results">
            {records.length ? "フィルタに一致する行がありません" : "行がありません。行を追加してください。"}
          </div>
        )}
      </div>}
      <div className="data-grid-selection-status">
        <span>
          {bounds
            ? `${bounds.rowEnd - bounds.rowStart + 1}行 × ${bounds.columnEnd - bounds.columnStart + 1}列を選択 · 矢印で移動 · Deleteで空 · Enterで下へ · Tabで右へ`
            : "ダブルクリックで編集 · 矢印で移動 · Deleteで空にする · Enterで下へ · Tabで右へ · Shift+Enterで改行"}
        </span>
        <span>グリップ=列移動 · コピーとソート以外は⋯メニュー · 折り返し=長い文字を表示 · 重なり=重複ハイライト · フィルタ=重複行だけ表示</span>
      </div>
      {enableDuplicateValidation && (uniqueKey || requiredColumns.length > 0 || duplicateColumns.length > 0 || duplicateFilterColumns.length > 0) && (
        <div className={`data-grid-duplicate-status ${validationHasError ? "error" : "ok"}`} role="status">
          <strong>
            {uniqueKey ? `UNIQUE ${labelFor(uniqueKey)}` : requiredColumns.length ? "REQUIRED" : "DUPLICATE CHECK"}
          </strong>
          <span>
            {[
              uniqueKey ? describeUniqueKeyValidation(uniqueBlankRows, uniqueDuplicateRows) : "",
              requiredColumnStats.length
                ? describeRequiredColumnValidation(requiredColumnStats.map((item) => ({
                  ...item,
                  column: labelFor(item.column),
                })))
                : "",
              !uniqueKey && !requiredColumnStats.length ? duplicateSummary.join(" · ") : "",
              duplicateFilterSummary.length ? `絞り込み ${duplicateFilterSummary.join(" · ")}` : "",
            ].filter(Boolean).join(" · ")}
          </span>
          {(uniqueKey || requiredColumnStats.length > 0) && (duplicateSummary.length > 0 || duplicateFilterSummary.length > 0) && (
            <small>
              {[
                duplicateSummary.join(" · "),
                duplicateFilterSummary.length ? `絞り込み ${duplicateFilterSummary.join(" · ")}` : "",
              ].filter(Boolean).join(" · ")}
            </small>
          )}
        </div>
      )}
    </div>
  );
}
