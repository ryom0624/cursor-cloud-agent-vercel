import { quoteDuckDbIdent } from "./identifiers";
import { describeSqlError, formatSqlEngineError } from "./errors";
import type { SqlResultRow } from "./results";

type DuckDbModule = typeof import("@duckdb/duckdb-wasm");
type AsyncDuckDB = InstanceType<DuckDbModule["AsyncDuckDB"]>;
type AsyncDuckDBConnection = Awaited<ReturnType<AsyncDuckDB["connect"]>>;

export type SqlColumn = {
  name: string;
  type: string;
};

export type SqlTableSchema = {
  name: string;
  columns: SqlColumn[];
};

export type SqlQuerySuccess = {
  ok: true;
  rows: SqlResultRow[];
  columns: string[];
  rowCount: number;
  elapsedMs: number;
};

export type SqlQueryFailure = {
  ok: false;
  error: string;
  elapsedMs: number;
};

let duckdbPromise: Promise<{ db: AsyncDuckDB; module: DuckDbModule }> | null = null;

async function instantiateDuckDb() {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const bundle = await duckdb.selectBundle({
    mvp: {
      mainModule: "/duckdb/duckdb-mvp.wasm",
      mainWorker: "/duckdb/duckdb-browser-mvp.worker.js",
    },
    eh: {
      mainModule: "/duckdb/duckdb-eh.wasm",
      mainWorker: "/duckdb/duckdb-browser-eh.worker.js",
    },
  });
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? undefined);
  return { db, module: duckdb };
}

export async function getDuckDb() {
  if (!duckdbPromise) duckdbPromise = instantiateDuckDb();
  return duckdbPromise;
}

function cellValue(value: unknown): unknown {
  if (typeof value === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  return value;
}

export async function runDuckDbQuery(
  conn: AsyncDuckDBConnection,
  sql: string,
): Promise<SqlQuerySuccess | SqlQueryFailure> {
  const started = performance.now();
  try {
    const table = await conn.query(sql);
    const columns = table.schema.fields.map((field) => field.name);
    const rows: SqlResultRow[] = [];
    for (const row of table.toArray()) {
      const record: SqlResultRow = {};
      for (const column of columns) {
        record[column] = cellValue(row[column]);
      }
      rows.push(record);
    }
    return {
      ok: true,
      rows,
      columns,
      rowCount: rows.length,
      elapsedMs: Math.round((performance.now() - started) * 10) / 10,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SQLを実行できませんでした。";
    return {
      ok: false,
      error: describeSqlError(formatSqlEngineError(message)),
      elapsedMs: Math.round((performance.now() - started) * 10) / 10,
    };
  }
}

export async function registerCsvTable(
  db: AsyncDuckDB,
  conn: AsyncDuckDBConnection,
  tableName: string,
  csv: string,
) {
  const fileName = `${tableName}.csv`;
  await db.registerFileText(fileName, csv);
  await conn.query(`CREATE OR REPLACE TABLE ${quoteDuckDbIdent(tableName)} AS SELECT * FROM read_csv_auto('${fileName}', HEADER=true)`);
}

export async function dropCsvTable(conn: AsyncDuckDBConnection, tableName: string) {
  await conn.query(`DROP TABLE IF EXISTS ${quoteDuckDbIdent(tableName)}`);
}

export async function describeTables(
  conn: AsyncDuckDBConnection,
  tableNames: string[],
): Promise<SqlTableSchema[]> {
  const schemas: SqlTableSchema[] = [];
  for (const name of tableNames) {
    const result = await runDuckDbQuery(conn, `DESCRIBE ${quoteDuckDbIdent(name)}`);
    if (!result.ok) continue;
    schemas.push({
      name,
      columns: result.rows.map((row) => ({
        name: String(row.column_name ?? row.ColumnName ?? ""),
        type: String(row.column_type ?? row.ColumnType ?? "UNKNOWN"),
      })),
    });
  }
  return schemas;
}
