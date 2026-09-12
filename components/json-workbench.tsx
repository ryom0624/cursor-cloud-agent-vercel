"use client";

import {
  Braces,
  Check,
  Clock3,
  Download,
  FileJson,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelRightOpen,
  RotateCcw,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton, copyText } from "@/components/copy-button";
import { ToolBreadcrumb } from "@/components/tool-breadcrumb";
import { JsonGrid } from "@/components/json-grid";
import { tools } from "@/lib/tools";

const sample = `[
  {
    "id": "PRJ-1042",
    "name": "DevSmith Web",
    "status": "active",
    "priority": 1,
    "owner": { "name": "Aki Tanaka", "team": "Platform" },
    "tags": ["nextjs", "typescript", "vercel"],
    "metrics": { "users": 18420, "uptime": 99.98 },
    "updatedAt": "2026-09-11T14:32:00Z"
  },
  {
    "id": "PRJ-1077",
    "name": "API Gateway",
    "status": "review",
    "priority": 2,
    "owner": { "name": "Mina Sato", "team": "Backend" },
    "tags": ["go", "grpc"],
    "metrics": { "users": 7320, "uptime": 99.91 },
    "updatedAt": "2026-09-10T09:15:00Z"
  },
  {
    "id": "PRJ-1091",
    "name": "Design Tokens",
    "status": "active",
    "priority": 3,
    "owner": { "name": "Ren Ito", "team": "Design System" },
    "tags": ["css", "figma"],
    "metrics": { "users": 2260, "uptime": 100 },
    "updatedAt": "2026-09-09T18:05:00Z"
  },
  {
    "id": "PRJ-1103",
    "name": "Log Pipeline",
    "status": "paused",
    "priority": 2,
    "owner": { "name": "Yui Mori", "team": "SRE" },
    "tags": ["kafka", "clickhouse"],
    "metrics": { "users": 840, "uptime": 98.72 },
    "updatedAt": "2026-09-08T03:42:00Z"
  }
]`;

type Mode = "format" | "validate" | "minify" | "tree" | "grid";

const modeDescriptions: Record<Mode, string> = {
  format: "インデントと改行を付け、JSONを読みやすい形へ整えます。",
  validate: "内容は書き換えず、構文エラーの有無とJSONの概要を確認します。",
  minify: "不要な空白と改行を取り除き、データサイズを小さくします。",
  tree: "オブジェクトと配列の階層を、開閉できるツリーで確認します。",
  grid: "オブジェクト配列を表にし、列の移動、ソート、フィルタを操作できます。",
};

function JsonTreeNode({ value, name }: { value: unknown; name?: string }) {
  if (typeof value !== "object" || value === null) {
    return (
      <div className="json-tree-leaf">
        {name !== undefined && <span className="json-tree-key">{name}: </span>}
        <span className={`json-tree-${value === null ? "null" : typeof value}`}>
          {typeof value === "string" ? `"${value}"` : String(value)}
        </span>
      </div>
    );
  }

  const entries = Object.entries(value);
  return (
    <details open className="json-tree-branch">
      <summary>
        {name !== undefined && <span className="json-tree-key">{name} </span>}
        <small>{Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}</small>
      </summary>
      <div>
        {entries.map(([key, child]) => (
          <JsonTreeNode key={key} name={key} value={child} />
        ))}
      </div>
    </details>
  );
}

export function JsonWorkbench() {
  const [mode, setMode] = useState<Mode>("format");
  const [input, setInput] = useState(sample);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [indent, setIndent] = useState(2);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [splitPercent, setSplitPercent] = useState(42);

  const parsed = useMemo(() => {
    try {
      return { value: JSON.parse(input) as unknown, error: "" };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : "JSONを解析できません。",
      };
    }
  }, [input]);

  const valid = !parsed.error;
  const result = valid
    ? mode === "minify"
      ? JSON.stringify(parsed.value)
      : JSON.stringify(parsed.value, null, indent)
    : "";
  const rootType = Array.isArray(parsed.value)
    ? "Array"
    : parsed.value === null
      ? "null"
      : typeof parsed.value === "object"
        ? "Object"
        : typeof parsed.value;
  const rootEntries = parsed.value && typeof parsed.value === "object"
    ? Object.keys(parsed.value).length
    : 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fullscreen) {
        event.preventDefault();
        setFullscreen(false);
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFullscreen((current) => !current);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        setMode("format");
      }
      if (event.shiftKey && event.key.toLowerCase() === "c" && result) {
        event.preventDefault();
        void copyText(result);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, result]);

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([result], { type: "application/json;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "devsmith-output.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const move = (pointerEvent: PointerEvent) => {
      const next = ((pointerEvent.clientX - bounds.left) / bounds.width) * 100;
      setSplitPercent(Math.max(25, Math.min(75, next)));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <main className={`workbench-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="workbench-sidebar">
        <div className="sidebar-title">
          <span>WORKSPACES</span>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={sidebarCollapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
          >
            {sidebarCollapsed ? <PanelRightOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>
        {tools.map((tool) => (
          <Link
            href={tool.href}
            key={tool.index}
            className={tool.name === "JSON Tools" ? "current" : ""}
          >
            <span>{tool.index}</span>
            {tool.name}
          </Link>
        ))}
        <div className="sidebar-foot">
          <Clock3 size={14} />
          <span>最近使った道具は<br />この端末だけに保存されます</span>
        </div>
      </aside>

      <section
        className={`workbench-main layout-wide ${fullscreen ? "json-fullscreen" : ""}`}
      >
        <ToolBreadcrumb title="JSON Tools" />

        <div className="workbench-heading">
          <div className="workbench-icon"><Braces size={25} /></div>
          <div>
            <div className="workbench-kicker">DATA · 5 FUNCTIONS</div>
            <h1>JSON Tools</h1>
            <p>JSONの整形、検証、圧縮、構造・表形式の確認をひとつの作業台で。</p>
          </div>
          <span className="local-badge"><span />LOCAL ONLY</span>
        </div>

        <div className="mode-tabs" role="tablist" aria-label="JSON処理">
          {([
            ["format", "整形"],
            ["validate", "検証"],
            ["minify", "圧縮"],
            ["tree", "ツリー表示"],
            ["grid", "Grid"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              className={mode === value ? "active" : ""}
              onClick={() => setMode(value)}
              role="tab"
              aria-selected={mode === value}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mode-description">
          <strong>{mode === "format" ? "整形" : mode === "validate" ? "検証" : mode === "minify" ? "圧縮" : mode === "tree" ? "ツリー表示" : "Grid"}</strong>
          <span>{modeDescriptions[mode]}</span>
        </div>

        <div className="editor-toolbar">
          <div>
            <label className="editor-file-button">
              <FileJson size={15} />ファイルを開く
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) setInput(await file.text());
                }}
              />
            </label>
            <button type="button" onClick={() => setInput(sample)}><RotateCcw size={15} />サンプル</button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setFullscreen((current) => !current)}
              title={fullscreen ? "縮小（Esc）" : "全画面表示（Ctrl/⌘+Shift+F）"}
            >
              {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {fullscreen ? "縮小" : "全画面"}
            </button>
            <label>インデント</label>
            <select
              className="select-button"
              value={indent}
              onChange={(event) => setIndent(Number(event.target.value))}
              aria-label="JSONのインデント幅"
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
            </select>
            <button type="button" className="clear-button" onClick={() => setInput("")}>すべて消去</button>
          </div>
        </div>

        <div
          className={`editors ${inputExpanded ? "input-expanded" : ""} ${mode === "grid" ? "grid-mode" : ""}`}
          style={{
            gridTemplateColumns: inputExpanded
              ? "1fr"
              : `minmax(220px, ${splitPercent}fr) 7px minmax(0, ${100 - splitPercent}fr)`,
          }}
        >
          <div className="editor-pane input-pane">
            <div className="pane-heading">
              <span>INPUT</span>
              <div>
                <small>{input.length} CHARACTERS</small>
                <button
                  type="button"
                  onClick={() => setInputExpanded((expanded) => !expanded)}
                  aria-label={inputExpanded ? "入力欄を元の大きさに戻す" : "入力欄を広げる"}
                  title={inputExpanded ? "元の大きさに戻す" : "入力欄を広げる"}
                >
                  {inputExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span>{inputExpanded ? "元に戻す" : "広げる"}</span>
                </button>
              </div>
            </div>
            <div className="textarea-wrap">
              <div className="editor-lines">1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9<br />10</div>
              <textarea
                id="json-input"
                name="json-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                spellCheck={false}
                aria-label="JSON入力"
              />
            </div>
          </div>
          <div
            className="editor-resizer"
            role="separator"
            aria-label="入力と出力の幅を変更"
            aria-orientation="vertical"
            aria-valuemin={25}
            aria-valuemax={75}
            aria-valuenow={Math.round(splitPercent)}
            tabIndex={inputExpanded ? -1 : 0}
            onPointerDown={startResize}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") setSplitPercent((current) => Math.max(25, current - 5));
              if (event.key === "ArrowRight") setSplitPercent((current) => Math.min(75, current + 5));
            }}
          >
            <span />
          </div>
          <div className="editor-pane output-pane">
            <div className="pane-heading">
              <span>{mode === "validate" ? "VALIDATION REPORT" : mode === "grid" ? "DATA GRID" : "OUTPUT"}</span>
              <div>
                {mode !== "validate" && mode !== "grid" && (
                  <>
                    <CopyButton value={result} />
                    <button type="button" disabled={!result} onClick={download} aria-label="JSONをダウンロード"><Download size={14} /></button>
                  </>
                )}
              </div>
            </div>
            {mode === "grid" && valid ? (
              <JsonGrid value={parsed.value} />
            ) : mode === "validate" ? (
              <div className={`json-validation-report ${valid ? "valid" : "invalid"}`}>
                <span>{valid ? <Check size={22} /> : <WandSparkles size={22} />}</span>
                <div>
                  <strong>{valid ? "構文エラーはありません" : "構文エラーがあります"}</strong>
                  <p>{valid ? "入力内容は有効なJSONとして解析できます。" : parsed.error}</p>
                </div>
                {valid && (
                  <dl>
                    <div><dt>ROOT TYPE</dt><dd>{rootType}</dd></div>
                    <div><dt>ROOT ITEMS</dt><dd>{rootEntries}</dd></div>
                    <div><dt>INPUT SIZE</dt><dd>{new Blob([input]).size} Bytes</dd></div>
                  </dl>
                )}
              </div>
            ) : mode === "tree" && valid ? (
              <div className="json-tree" aria-label="JSONツリー">
                <JsonTreeNode value={parsed.value} />
              </div>
            ) : (
              <div className="textarea-wrap">
                <div className="editor-lines">1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9<br />10</div>
                <textarea id="json-output" name="json-output" value={result} readOnly spellCheck={false} aria-label="JSON出力" />
              </div>
            )}
          </div>
        </div>

        <div className={`validation-bar ${valid ? "valid" : "invalid"}`}>
          <span>{valid ? <Check size={15} /> : <WandSparkles size={15} />}</span>
          <strong>{valid ? "有効なJSONです" : "JSONを確認してください"}</strong>
          <small>{valid ? "構文エラーは見つかりませんでした" : parsed.error}</small>
          <em>{valid ? `${result.split("\n").length} LINES · ${new Blob([result]).size} BYTES` : "INVALID"}</em>
        </div>

        <div className="shortcut-row">
          <span>SHORTCUTS</span>
          <span><kbd>⌘</kbd> <kbd>Enter</kbd> 実行</span>
          <span><kbd>⌘</kbd> <kbd>K</kbd> ツール検索</span>
          <span><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>C</kbd> コピー</span>
          <span><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>F</kbd> 全画面</span>
        </div>
      </section>
    </main>
  );
}
