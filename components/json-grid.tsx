"use client";

import { DataGrid, type DataGridRecord } from "@/components/data-grid";

export function JsonGrid({ value }: { value: unknown }) {
  const items = Array.isArray(value) ? value : [value];
  const records = items.filter(
    (item): item is DataGridRecord =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
  const supported = records.length > 0
    && (Array.isArray(value) ? records.length === value.length : true);

  return (
    <DataGrid
      records={supported ? records : []}
      emptyMessage="表へ変換できないJSONです"
    />
  );
}
