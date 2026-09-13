"use client";

import {
  Maximize2,
  Minimize2,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ToolBreadcrumb } from "@/components/tool-breadcrumb";
import { useRecordToolUse, WorkspaceSidebar } from "@/components/workspace-sidebar";
import { toolBySlug, wideWorkspaceSlugs } from "@/lib/tools";

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

const extraWideSlugs = new Set([
  "csv-viewer-beta",
  "csv-viewer-legacy",
  "csv-viewer-legacy2",
]);

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const tool = toolBySlug[slug];
  const layout = wideWorkspaceSlugs.has(slug) || extraWideSlugs.has(slug) || tool?.layout === "wide" ? "wide" : "form";
  useRecordToolUse(slug);

  return (
    <main className={`workbench-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <WorkspaceSidebar
        currentSlug={slug}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />

      <section className={`workbench-main suite-main layout-${layout}`}>
        <ToolBreadcrumb title={title} />

        <div className="workbench-heading">
          <div className="workbench-icon" aria-hidden="true">
            {"{ }"}
          </div>
          <div>
            <div className="workbench-kicker">
              {category.toUpperCase()} · {tool?.functions ?? functionCount} FUNCTIONS
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
  return <CopyButton value={value} className="compact-button" />;
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
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fullscreen) {
        event.preventDefault();
        setFullscreen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFullscreen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  return (
    <div className={`text-workspace ${fullscreen ? "fullscreen" : ""}`}>
      {fullscreen && (
        <button
          type="button"
          className="fullscreen-exit"
          onClick={() => setFullscreen(false)}
        >
          <Minimize2 size={15} />
          縮小 <kbd>Esc</kbd>
        </button>
      )}
      {toolbar && <div className="suite-toolbar">{toolbar}</div>}
      <div className={`suite-editors ${expanded ? "input-expanded" : ""}`}>
        <section className="suite-editor input-editor">
          <header>
            <span>{inputLabel}</span>
            <div>
              <small>{input.length} CHARS</small>
              <button
                type="button"
                onClick={() => setFullscreen((current) => !current)}
                aria-label={fullscreen ? "全画面表示を終了" : "全画面表示"}
                title={fullscreen ? "縮小（Esc）" : "全画面表示（Ctrl/⌘+Shift+F）"}
              >
                {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                {fullscreen ? "縮小" : "全画面"}
              </button>
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
            <CopyButton value={output} />
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
    </div>
  );
}
