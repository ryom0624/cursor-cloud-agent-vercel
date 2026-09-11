"use client";

import {
  Braces,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  FileJson,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  RotateCcw,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { tools } from "@/lib/tools";

const sample = `{"project":"devsmith","version":"0.1.0","private":true,"tools":["format","validate","minify"],"settings":{"theme":"paper","localOnly":true}}`;

type Mode = "format" | "validate" | "minify" | "tree";

export function JsonWorkbench() {
  const [mode, setMode] = useState<Mode>("format");
  const [input, setInput] = useState(sample);
  const [copied, setCopied] = useState(false);
  const [inputExpanded, setInputExpanded] = useState(false);

  const result = useMemo(() => {
    try {
      const parsed = JSON.parse(input);
      if (mode === "minify") return JSON.stringify(parsed);
      if (mode === "tree") return JSON.stringify(parsed, null, 2);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return "";
    }
  }, [input, mode]);

  const valid = useMemo(() => {
    try {
      JSON.parse(input);
      return true;
    } catch {
      return false;
    }
  }, [input]);

  const copy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main className="workbench-shell">
      <aside className="workbench-sidebar">
        <div className="sidebar-title">
          <span>WORKSPACES</span>
          <PanelLeftClose size={15} />
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

      <section className="workbench-main">
        <div className="breadcrumb">
          <Link href="/">道具箱</Link>
          <span>/</span>
          <span>データ</span>
          <span>/</span>
          <strong>JSON Tools</strong>
        </div>

        <div className="workbench-heading">
          <div className="workbench-icon"><Braces size={25} /></div>
          <div>
            <div className="workbench-kicker">DATA · 4 FUNCTIONS</div>
            <h1>JSON Tools</h1>
            <p>JSONの整形、検証、圧縮、構造確認をひとつの作業台で。</p>
          </div>
          <span className="local-badge"><span />LOCAL ONLY</span>
        </div>

        <div className="mode-tabs" role="tablist" aria-label="JSON処理">
          {([
            ["format", "整形"],
            ["validate", "検証"],
            ["minify", "圧縮"],
            ["tree", "ツリー表示"],
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

        <div className="editor-toolbar">
          <div>
            <button type="button"><FileJson size={15} />ファイルを開く</button>
            <button type="button" onClick={() => setInput(sample)}><RotateCcw size={15} />サンプル</button>
          </div>
          <div>
            <label>インデント</label>
            <button type="button" className="select-button">2 spaces <ChevronDown size={13} /></button>
            <button type="button" className="clear-button" onClick={() => setInput("")}>すべて消去</button>
          </div>
        </div>

        <div className={`editors ${inputExpanded ? "input-expanded" : ""}`}>
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
                value={input}
                onChange={(event) => setInput(event.target.value)}
                spellCheck={false}
                aria-label="JSON入力"
              />
            </div>
          </div>
          <div className="editor-pane output-pane">
            <div className="pane-heading">
              <span>OUTPUT</span>
              <div>
                <button type="button" onClick={copy} disabled={!result}><Copy size={14} />{copied ? "コピー済み" : "コピー"}</button>
                <button type="button" disabled={!result}><Download size={14} /></button>
              </div>
            </div>
            <div className="textarea-wrap">
              <div className="editor-lines">1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9<br />10</div>
              <textarea value={result} readOnly spellCheck={false} aria-label="JSON出力" />
            </div>
          </div>
        </div>

        <div className={`validation-bar ${valid ? "valid" : "invalid"}`}>
          <span>{valid ? <Check size={15} /> : <WandSparkles size={15} />}</span>
          <strong>{valid ? "有効なJSONです" : "JSONを確認してください"}</strong>
          <small>{valid ? "構文エラーは見つかりませんでした" : "入力に構文エラーがあります"}</small>
          <em>{valid ? `${result.split("\n").length} LINES · ${new Blob([result]).size} BYTES` : "INVALID"}</em>
        </div>

        <div className="shortcut-row">
          <span>SHORTCUTS</span>
          <span><kbd>⌘</kbd> <kbd>Enter</kbd> 実行</span>
          <span><kbd>⌘</kbd> <kbd>K</kbd> ツール検索</span>
          <span><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>C</kbd> コピー</span>
        </div>
      </section>
    </main>
  );
}
