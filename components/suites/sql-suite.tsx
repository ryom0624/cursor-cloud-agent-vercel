"use client";

import { Download, Play, Upload } from "lucide-react";
import Link from "next/link";
import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ToolShell, ToolStatus, TextWorkspace } from "@/components/tool-shell";
import { describeTables, dropCsvTable, getDuckDb, registerCsvTable, runDuckDbQuery } from "@/lib/sql/engine";
import { describeSqlError, formatSqlEngineError } from "@/lib/sql/errors";
import { sqlExercises, type SqlExercise } from "@/lib/sql/exercises";
import { formatDuckDbSql, minifyDuckDbSql } from "@/lib/sql/formatter";
import { sanitizeTableName } from "@/lib/sql/identifiers";
import { compareSqlResults, rowsToCsv, rowsToJson, type SqlResultRow } from "@/lib/sql/results";
import { sqlJoinExample, sqlSampleCatalog, sqlSampleTables } from "@/lib/sql/samples";
import { takeHandoff, type SqlTableHandoff } from "@/lib/workspace-handoff";

type SqlTab = "playground" | "exercise" | "format";
type LoadedTable = { name: string; fileName: string; csv: string };
type EngineState = "idle" | "loading" | "ready" | "error";

function downloadText(filename: string, value: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SqlSuite() {
  const [tab, setTab] = useState<SqlTab>("playground");
  const [tables, setTables] = useState<LoadedTable[]>([]);
  const [sql, setSql] = useState(sqlJoinExample);
  const [resultRows, setResultRows] = useState<SqlResultRow[]>([]);
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [engineState, setEngineState] = useState<EngineState>("idle");
  const [engineError, setEngineError] = useState("");
  const [schemas, setSchemas] = useState<Awaited<ReturnType<typeof describeTables>>>([]);
  const [dragging, setDragging] = useState(false);
  const [formatInput, setFormatInput] = useState(sqlJoinExample);
  const [minify, setMinify] = useState(false);
  const [exerciseId, setExerciseId] = useState(sqlExercises[0].id);
  const [exerciseSql, setExerciseSql] = useState(sqlExercises[0].starterSql);
  const [exerciseMessage, setExerciseMessage] = useState("");
  const [exerciseCorrect, setExerciseCorrect] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connRef = useRef<Awaited<ReturnType<Awaited<ReturnType<typeof getDuckDb>>["db"]["connect"]>> | null>(null);

  const exercise = sqlExercises.find((item) => item.id === exerciseId) ?? sqlExercises[0];

  const ensureEngine = useCallback(async () => {
    if (connRef.current) return connRef.current;
    setEngineState("loading");
    try {
      const { db } = await getDuckDb();
      const conn = await db.connect();
      connRef.current = conn;
      setEngineState("ready");
      setEngineError("");
      return conn;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "DuckDBを初期化できませんでした。";
      setEngineState("error");
      setEngineError(message);
      throw caught;
    }
  }, []);

  const syncSchemas = useCallback(async (names: string[]) => {
    const conn = connRef.current;
    if (!conn) return;
    setSchemas(await describeTables(conn, names));
  }, []);

  const loadTables = useCallback(async (incoming: Array<{ fileName: string; csv: string }>, replace = false) => {
    const conn = await ensureEngine();
    const { db } = await getDuckDb();
    const used = replace ? new Set<string>() : new Set(tables.map((table) => table.name));
    if (replace) {
      for (const table of tables) await dropCsvTable(conn, table.name);
    }
    const next: LoadedTable[] = replace ? [] : [...tables];
    for (const item of incoming) {
      if (!item.csv.trim()) throw new Error("CSV Parse Error\n空のCSVです。");
      const name = sanitizeTableName(item.fileName, used);
      await registerCsvTable(db, conn, name, item.csv);
      next.push({ name, fileName: item.fileName, csv: item.csv });
    }
    setTables(next);
    await syncSchemas(next.map((table) => table.name));
    setError("");
  }, [ensureEngine, syncSchemas, tables]);

  useEffect(() => {
    const handed = takeHandoff<SqlTableHandoff[]>("devsmith:handoff:sql-tables");
    if (!handed?.length) return;
    const timer = window.setTimeout(() => {
      void loadTables(handed.map((item) => ({ fileName: item.name, csv: item.csv })), true).catch((caught) => {
        setError(caught instanceof Error ? caught.message : "CSVを読み込めませんでした。");
      });
    }, 0);
    return () => window.clearTimeout(timer);
    // Load handed-off tables once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runQuery = async (query: string) => {
    setError("");
    setExerciseMessage("");
    try {
      const conn = await ensureEngine();
      const result = await runDuckDbQuery(conn, query);
      setElapsedMs(result.elapsedMs);
      if (!result.ok) {
        setResultRows([]);
        setResultColumns([]);
        setRowCount(0);
        setError(result.error);
        setExerciseCorrect(null);
        return result;
      }
      setResultRows(result.rows);
      setResultColumns(result.columns);
      setRowCount(result.rowCount);
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "SQLを実行できませんでした。";
      setError(describeSqlError(formatSqlEngineError(message)));
      return null;
    }
  };

  const onDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files].filter((file) => /\.(csv|tsv|txt)$/i.test(file.name) || file.type.includes("csv"));
    if (!files.length) {
      setError("CSV Parse Error\nCSVファイルをドロップしてください。");
      return;
    }
    try {
      const incoming = await Promise.all(files.map(async (file) => ({ fileName: file.name, csv: await file.text() })));
      await loadTables(incoming);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CSVを読み込めませんでした。");
    }
  };

  const loadSample = async (ids: Array<keyof typeof sqlSampleTables>, replace = false) => {
    try {
      await loadTables(
        ids.map((id) => ({ fileName: `${id}.csv`, csv: sqlSampleTables[id] })),
        replace,
      );
      if (ids.includes("customers") && ids.includes("orders")) setSql(sqlJoinExample);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "サンプルを読み込めませんでした。");
    }
  };

  const runExercise = async () => {
    try {
      await loadTables(
        exercise.tables.map((id) => ({ fileName: `${id}.csv`, csv: sqlSampleTables[id] })),
        true,
      );
      const result = await runQuery(exerciseSql);
      if (!result || !result.ok) {
        setExerciseCorrect(false);
        setExerciseMessage("Try again");
        return;
      }
      const comparison = compareSqlResults(result.rows, exercise.expected, { ordered: exercise.ordered });
      setExerciseCorrect(comparison.equal);
      setExerciseMessage(
        comparison.equal
          ? "Correct"
          : `Try again${comparison.hints?.length ? ` — ${comparison.hints.join(" / ")}` : ""}`,
      );
    } catch (caught) {
      setExerciseCorrect(false);
      setError(caught instanceof Error ? caught.message : "問題を実行できませんでした。");
    }
  };

  const formatted = useMemo(() => {
    try {
      return {
        output: minify ? minifyDuckDbSql(formatInput) : formatDuckDbSql(formatInput),
        error: "",
      };
    } catch (caught) {
      return {
        output: "",
        error: caught instanceof Error ? caught.message : "SQLを整形できません。",
      };
    }
  }, [formatInput, minify]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (tab === "playground") void runQuery(sql);
        if (tab === "exercise") void runExercise();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const selectExercise = (next: SqlExercise) => {
    setExerciseId(next.id);
    setExerciseSql(next.starterSql);
    setExerciseCorrect(null);
    setExerciseMessage("");
    setError("");
  };

  return (
    <ToolShell
      slug="sql"
      category="データ"
      title="SQL Tools"
      description="CSVをブラウザ内の仮想テーブルにして、DuckDB SQLでQueryします。入力は外部へ送信しません。"
      functionCount={5}
      tabs={[
        { id: "playground", label: "Playground" },
        { id: "exercise", label: "Exercise" },
        { id: "format", label: "Format" },
      ]}
      activeTab={tab}
      onTabChange={(value) => setTab(value as SqlTab)}
    >
      {tab === "format" ? (
        <TextWorkspace
          input={formatInput}
          output={formatted.output}
          onInput={setFormatInput}
          error={formatted.error}
          inputLabel="SQL"
          outputLabel={minify ? "MINIFIED" : "FORMATTED"}
          toolbar={
            <>
              <div className="segmented-control">
                <button type="button" className={!minify ? "active" : ""} onClick={() => setMinify(false)}>Format</button>
                <button type="button" className={minify ? "active" : ""} onClick={() => setMinify(true)}>Minify</button>
              </div>
              <span className="engine-note">Engine: DuckDB SQL。PostgreSQL / MySQL / SQL Server と完全互換ではありません。</span>
            </>
          }
        />
      ) : tab === "exercise" ? (
        <div className="sql-layout">
          <aside className="sql-schema">
            <header>EXERCISES</header>
            {(["Beginner", "Intermediate", "Advanced"] as const).map((level) => (
              <div key={level}>
                <strong>{level}</strong>
                {sqlExercises.filter((item) => item.level === level).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === exercise.id ? "active" : ""}
                    onClick={() => selectExercise(item)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ))}
          </aside>
          <div className="sql-main">
            <div className="sql-exercise-prompt">
              <strong>{exercise.title}</strong>
              <p>{exercise.prompt}</p>
              <small>Hint: {exercise.hint}</small>
            </div>
            <textarea
              value={exerciseSql}
              onChange={(event) => setExerciseSql(event.target.value)}
              spellCheck={false}
              aria-label="練習用SQL"
            />
            <div className="suite-toolbar">
              <button type="button" className="primary-button" onClick={() => void runExercise()}>
                <Play size={14} />実行して採点
              </button>
              <span className={`sql-verdict ${exerciseCorrect === true ? "ok" : exerciseCorrect === false ? "ng" : ""}`}>
                {exerciseMessage || "結果セットを比較します。Query文字列は見ません。"}
              </span>
            </div>
            <ResultTable columns={resultColumns} rows={resultRows} />
            <ToolStatus error={error}>
              {exerciseCorrect === true ? "Correct" : "DuckDB SQL · ブラウザ内で採点します"}
            </ToolStatus>
          </div>
        </div>
      ) : (
        <div
          className={`sql-layout ${dragging ? "is-dragging" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
          onDrop={(event) => void onDrop(event)}
        >
          <aside className="sql-schema">
            <header>TABLES</header>
            {schemas.length ? schemas.map((schema) => (
              <details key={schema.name} open>
                <summary>▼ {schema.name}</summary>
                <ul>
                  {schema.columns.map((column) => (
                    <li key={`${schema.name}-${column.name}`}>
                      <span>{column.name}</span>
                      <small>{column.type}</small>
                    </li>
                  ))}
                </ul>
              </details>
            )) : (
              <p>CSVをドロップすると仮想テーブルになります。</p>
            )}
          </aside>
          <div className="sql-main">
            <div className="suite-toolbar sql-toolbar">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,text/csv"
                multiple
                hidden
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])];
                  void Promise.all(files.map(async (file) => ({ fileName: file.name, csv: await file.text() })))
                    .then((incoming) => loadTables(incoming))
                    .catch((caught) => setError(caught instanceof Error ? caught.message : "CSVを読めませんでした。"));
                  event.currentTarget.value = "";
                }}
              />
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} />CSVを開く
              </button>
              <button type="button" className="primary-button" onClick={() => void runQuery(sql)}>
                <Play size={14} />Query実行
              </button>
              <span className="engine-note">DuckDB SQL · LOCAL</span>
            </div>
            <div className="sql-samples">
              <span>SAMPLE DATA</span>
              <button type="button" onClick={() => void loadSample(["customers", "orders"], true)}>E-commerceセット</button>
              {sqlSampleCatalog.map((sample) => (
                <button key={sample.id} type="button" onClick={() => void loadSample([sample.id])}>
                  {sample.label}
                </button>
              ))}
            </div>
            <div className="sql-loaded">
              {tables.map((table) => (
                <span key={table.name}>{table.fileName} → {table.name}</span>
              ))}
            </div>
            <textarea
              value={sql}
              onChange={(event) => setSql(event.target.value)}
              spellCheck={false}
              aria-label="SQLエディタ"
              placeholder="SELECT * FROM customers"
            />
            <div className="suite-toolbar">
              <CopyButton value={rowsToCsv(resultRows)} label="CSVコピー" />
              <CopyButton value={rowsToJson(resultRows)} label="JSONコピー" />
              <button type="button" disabled={!resultRows.length} onClick={() => downloadText("query-result.csv", rowsToCsv(resultRows), "text/csv")}>
                <Download size={14} />CSV Download
              </button>
              <Link className="text-button" href="/tools/csv-viewer">CSV Viewerで開く</Link>
              {elapsedMs !== null && <small>{rowCount.toLocaleString()} rows · {elapsedMs} ms</small>}
            </div>
            <ResultTable columns={resultColumns} rows={resultRows} />
            <ToolStatus error={error || engineError}>
              {engineState === "loading"
                ? "DuckDB Wasmを読み込んでいます"
                : tables.length
                  ? `${tables.length}テーブルをブラウザ内に読み込み済み`
                  : "CSVはサーバーへアップロードしません"}
            </ToolStatus>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

function ResultTable({ columns, rows }: { columns: string[]; rows: SqlResultRow[] }) {
  if (!columns.length) {
    return <div className="sql-result empty">結果はまだありません</div>;
  }
  return (
    <div className="sql-result">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && <p>先頭200行を表示しています。Copy / Downloadは全件です。</p>}
    </div>
  );
}
