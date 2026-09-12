"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  TableProperties,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";

type JsonRecord = Record<string, unknown>;
type SortState = { column: string; direction: "asc" | "desc" } | null;

function displayValue(value: unknown) {
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

export function JsonGrid({ value }: { value: unknown }) {
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const records = useMemo<JsonRecord[]>(() => {
    const items = Array.isArray(value) ? value : [value];
    return items.filter(
      (item): item is JsonRecord =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    );
  }, [value]);
  const supportsGrid = records.length > 0
    && (Array.isArray(value) ? records.length === value.length : true);
  const sourceColumns = useMemo(
    () => Array.from(new Set(records.flatMap((record) => Object.keys(record)))),
    [records],
  );
  const columns = [
    ...columnOrder.filter((column) => sourceColumns.includes(column)),
    ...sourceColumns.filter((column) => !columnOrder.includes(column)),
  ];
  const rows = useMemo(() => {
    if (!supportsGrid) return [];
    const filtered = records.filter((record) =>
      sourceColumns.every((column) => {
        const query = (filters[column] ?? "").trim().toLocaleLowerCase();
        return !query || displayValue(record[column]).toLocaleLowerCase().includes(query);
      }),
    );
    if (!sort) return filtered;
    return [...filtered].sort((left, right) => {
      const a = left[sort.column];
      const b = right[sort.column];
      const compared = typeof a === "number" && typeof b === "number"
        ? a - b
        : displayValue(a).localeCompare(displayValue(b), "ja", { numeric: true });
      return sort.direction === "asc" ? compared : -compared;
    });
  }, [filters, records, sort, sourceColumns, supportsGrid]);

  const moveColumn = (column: string, offset: -1 | 1) => {
    const current = columns.indexOf(column);
    const target = current + offset;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[current], next[target]] = [next[target], next[current]];
    setColumnOrder(next);
  };

  const toggleSort = (column: string) => {
    setSort((current) => {
      if (current?.column !== column) return { column, direction: "asc" };
      if (current.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  };

  if (!supportsGrid) {
    return (
      <div className="json-grid-empty">
        <TableProperties size={24} />
        <strong>表へ変換できないJSONです</strong>
        <span>オブジェクト、またはオブジェクトの配列を入力してください。</span>
      </div>
    );
  }

  return (
    <div className="json-grid-panel">
      <div className="json-grid-toolbar">
        <span><TableProperties size={15} />{rows.length} / {records.length} ROWS · {columns.length} COLUMNS</span>
        <CopyButton value={JSON.stringify(rows, null, 2)} label="表示行をコピー" />
      </div>
      <div className="json-grid-scroll">
        <table>
          <thead>
            <tr>
              <th className="row-number">#</th>
              {columns.map((column, index) => (
                <th key={column}>
                  <div>
                    <strong>{column}</strong>
                    <span>
                      <button type="button" onClick={() => moveColumn(column, -1)} disabled={index === 0} aria-label={`${column}列を左へ`}>
                        <ArrowLeft size={12} />
                      </button>
                      <button type="button" onClick={() => moveColumn(column, 1)} disabled={index === columns.length - 1} aria-label={`${column}列を右へ`}>
                        <ArrowRight size={12} />
                      </button>
                      <button type="button" onClick={() => toggleSort(column)} aria-label={`${column}列をソート`}>
                        {sort?.column === column
                          ? sort.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          : <ArrowUpDown size={12} />}
                      </button>
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
            {rows.map((record, rowIndex) => (
              <tr key={rowIndex}>
                <th className="row-number">{rowIndex + 1}</th>
                {columns.map((column) => (
                  <td key={column} title={displayValue(record[column])}>
                    {displayValue(record[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="json-grid-no-results">フィルタに一致する行がありません</div>}
      </div>
    </div>
  );
}
