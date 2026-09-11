"use client";

import {
  Clock3,
  Copy,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { tools } from "@/lib/tools";

type ToolShellProps = {
  slug: string;
  category: string;
  title: string;
  description: string;
  functionCount: number;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  children: ReactNode;
};

export function ToolShell({
  slug,
  category,
  title,
  description,
  functionCount,
  tabs,
  activeTab,
  onTabChange,
  children,
}: ToolShellProps) {
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
            className={tool.href === `/tools/${slug}` ? "current" : ""}
          >
            <span>{tool.index}</span>
            {tool.name}
          </Link>
        ))}
        <div className="sidebar-foot">
          <Clock3 size={14} />
          <span>
            入力したデータは
            <br />
            外部へ送信されません
          </span>
        </div>
      </aside>

      <section className="workbench-main suite-main">
        <div className="breadcrumb">
          <Link href="/">道具箱</Link>
          <span>/</span>
          <span>{category}</span>
          <span>/</span>
          <strong>{title}</strong>
        </div>

        <div className="workbench-heading">
          <div className="workbench-icon" aria-hidden="true">
            {"{ }"}
          </div>
          <div>
            <div className="workbench-kicker">
              {category.toUpperCase()} · {functionCount} FUNCTIONS
            </div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <span className="local-badge">
            <ShieldCheck size={12} />
            LOCAL ONLY
          </span>
        </div>

        {tabs && tabs.length > 1 && (
          <div className="mode-tabs" role="tablist" aria-label={`${title}の機能`}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => onTabChange?.(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        <div className="suite-content">{children}</div>
      </section>
    </main>
  );
}

export function CopyAction({ value }: { value: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(value);
  };
  return (
    <button type="button" className="compact-button" onClick={copy} disabled={!value}>
      コピー
    </button>
  );
}

export function ToolStatus({
  error,
  children,
}: {
  error?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`tool-status ${error ? "error" : ""}`} role="status">
      <strong>{error ? "ERROR" : "READY"}</strong>
      <span>{error || children || "入力内容はブラウザ内で処理されます"}</span>
    </div>
  );
}

type TextWorkspaceProps = {
  input: string;
  output: string;
  onInput: (value: string) => void;
  inputLabel?: string;
  outputLabel?: string;
  inputPlaceholder?: string;
  outputPlaceholder?: string;
  toolbar?: ReactNode;
  error?: string;
  readOnlyOutput?: boolean;
};

export function TextWorkspace({
  input,
  output,
  onInput,
  inputLabel = "INPUT",
  outputLabel = "OUTPUT",
  inputPlaceholder,
  outputPlaceholder,
  toolbar,
  error,
  readOnlyOutput = true,
}: TextWorkspaceProps) {
  const [expanded, setExpanded] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(output);
  };

  return (
    <>
      {toolbar && <div className="suite-toolbar">{toolbar}</div>}
      <div className={`suite-editors ${expanded ? "input-expanded" : ""}`}>
        <section className="suite-editor input-editor">
          <header>
            <span>{inputLabel}</span>
            <div>
              <small>{input.length} CHARS</small>
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-label={expanded ? "入力欄を元に戻す" : "入力欄を広げる"}
              >
                {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                {expanded ? "元に戻す" : "広げる"}
              </button>
            </div>
          </header>
          <textarea
            name="tool-input"
            value={input}
            onChange={(event) => onInput(event.target.value)}
            placeholder={inputPlaceholder}
            spellCheck={false}
          />
        </section>
        <section className="suite-editor output-editor">
          <header>
            <span>{outputLabel}</span>
            <button type="button" onClick={copy} disabled={!output}>
              <Copy size={13} />
              コピー
            </button>
          </header>
          <textarea
            name="tool-output"
            value={output}
            readOnly={readOnlyOutput}
            placeholder={outputPlaceholder}
            spellCheck={false}
          />
        </section>
      </div>
      <ToolStatus error={error}>
        {output ? `${output.length}文字の結果を生成しました` : undefined}
      </ToolStatus>
    </>
  );
}
