"use client";

import Link from "next/link";
import {
  ArrowRight,
  Asterisk,
  Braces,
  ChevronRight,
  Command,
  LockKeyhole,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  categories,
  functionCount,
  storePasteAnythingHandoff,
  resetPasteAnythingHandoff,
  toolCount,
  tools,
} from "@/lib/tools";
import { looksLikeMermaid } from "@/lib/mermaid-utils";

type PasteType = "json" | "csv" | "tsv" | "jwt" | "url" | "timestamp" | "base64" | "mermaid" | "text";

type PasteDetection = {
  type: PasteType;
  label: string;
  reason: string;
  tool: string;
  href: string;
};

const detections: Record<PasteType, Omit<PasteDetection, "type" | "reason">> = {
  json: { label: "JSON", tool: "JSON Tools", href: "/tools/json" },
  mermaid: { label: "MERMAID", tool: "Mermaid Viewer", href: "/tools/mermaid" },
  csv: { label: "CSV", tool: "CSV Viewer", href: "/tools/csv-viewer" },
  tsv: { label: "TSV", tool: "CSV Viewer", href: "/tools/csv-viewer" },
  jwt: { label: "JWT", tool: "JWT Decoder", href: "/tools/jwt" },
  url: { label: "URL", tool: "Encoder / Decoder", href: "/tools/encoder" },
  timestamp: { label: "UNIX TIMESTAMP", tool: "Date & Time", href: "/tools/date-time" },
  base64: { label: "BASE64", tool: "Encoder / Decoder", href: "/tools/encoder" },
  text: { label: "TEXT", tool: "Text Tools", href: "/tools/text" },
};

function result(type: PasteType, reason: string): PasteDetection {
  return { type, reason, ...detections[type] };
}

function delimiterColumns(line: string, delimiter: "," | "\t") {
  let columns = 1;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && line[index] === delimiter) {
      columns += 1;
    }
  }
  return columns;
}

function detectPaste(value: string): PasteDetection | null {
  const input = value.trim();
  if (!input) return null;

  const jwtParts = input.split(".");
  if (
    jwtParts.length === 3 &&
    jwtParts.every((part) => /^[A-Za-z0-9_-]+={0,2}$/.test(part))
  ) {
    return result("jwt", "Base64URL形式の3セグメントを検出しました。");
  }

  try {
    const url = new URL(input);
    if (url.protocol && url.hostname) {
      return result("url", `${url.protocol}//${url.hostname} として解析できます。`);
    }
  } catch {
    // Continue with the remaining local checks.
  }

  if (/^\d{10}$/.test(input) || /^\d{13}$/.test(input)) {
    return result(
      "timestamp",
      `${input.length}桁の数字のみで構成されています。`,
    );
  }

  try {
    JSON.parse(input);
    return result("json", "JSON.parseで構文を正しく解析できました。");
  } catch {
    // Continue with the remaining local checks.
  }

  if (looksLikeMermaid(input)) {
    return result("mermaid", "Mermaid記法のダイアグラム定義を検出しました。");
  }

  const lines = input.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length >= 2) {
    for (const delimiter of ["\t", ","] as const) {
      const counts = lines.slice(0, 20).map((line) => delimiterColumns(line, delimiter));
      if (counts[0] >= 2 && counts.every((count) => count === counts[0])) {
        const type = delimiter === "\t" ? "tsv" : "csv";
        return result(
          type,
          `${lines.length}行で${counts[0]}列の区切り構造が揃っています。`,
        );
      }
    }
  }

  const compact = input.replace(/\s/g, "");
  if (
    compact.length >= 12 &&
    compact.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(compact)
  ) {
    try {
      const decoded = atob(compact);
      if (decoded.length) {
        return result("base64", "Base64として復号できる文字列パターンです。");
      }
    } catch {
      // Fall through to plain text.
    }
  }

  return result("text", "構造化データのパターンには一致しませんでした。");
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function HomeMock() {
  const router = useRouter();
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");
  const [pasteValue, setPasteValue] = useState("");
  const pasteDetection = useMemo(() => detectPaste(pasteValue), [pasteValue]);

  const filteredTools = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return tools.filter((tool) => {
      const categoryMatches =
        category === "すべて" || tool.category === category;
      const queryMatches =
        !normalized ||
        `${tool.name} ${tool.description} ${tool.category}`
          .toLowerCase()
          .includes(normalized);
      return categoryMatches && queryMatches;
    });
  }, [category, query]);

  const openDetectedTool = () => {
    if (!pasteDetection) return;
    storePasteAnythingHandoff(pasteValue, pasteDetection.type);
    router.push(pasteDetection.href);
  };

  useEffect(() => {
    resetPasteAnythingHandoff();
    pasteRef.current?.focus();
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const text = event.clipboardData?.getData("text");
      if (!text) return;
      event.preventDefault();
      setPasteValue(text);
      pasteRef.current?.focus();
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
      if (!pasteDetection) return;
      event.preventDefault();
      storePasteAnythingHandoff(pasteValue, pasteDetection.type);
      router.push(pasteDetection.href);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pasteDetection, pasteValue, router]);

  return (
    <main>
      <section className="paste-hero" aria-labelledby="paste-anything-title">
        <header className="paste-hero-heading">
          <div>
            <div className="eyebrow">
              <Asterisk size={15} />
              LOCAL AUTO DETECTION / PRIVATE
            </div>
            <h1 id="paste-anything-title">
              PASTE
              <br />
              <span>ANYTHING</span>
            </h1>
          </div>
          <p className="paste-hero-note">
            <LockKeyhole size={13} />
            入力内容は外部へ送信されません
          </p>
        </header>
        <p className="paste-hero-lead">
          貼るだけで、この端末内ですぐに判定します。
        </p>

        <div className="paste-stage">
          <textarea
            ref={pasteRef}
            value={pasteValue}
            onChange={(event) => setPasteValue(event.target.value)}
            placeholder="JSON、CSV / TSV、Mermaid、JWT、URL、Unix timestamp、Base64、テキストを貼り付け"
            aria-label="判定するデータを貼り付け"
            spellCheck={false}
          />
          <div className="paste-anything-result" aria-live="polite">
            {pasteDetection ? (
              <>
                <div>
                  <span>DETECTED</span>
                  <strong>{pasteDetection.label}</strong>
                </div>
                <p><span>根拠</span>{pasteDetection.reason}</p>
                <p><span>推奨ツール</span><strong>{pasteDetection.tool}</strong></p>
                <button type="button" onClick={openDetectedTool} title="⌘ Enter">
                  このツールで開く <ArrowRight size={15} />
                </button>
              </>
            ) : (
              <p className="paste-anything-empty">
                どこでも貼り付けできます。判定できたら ⌘ Enter で開きます。
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="サービスの特徴">
        <div><LockKeyhole size={17} /><span><strong>ブラウザ内で処理</strong>データを外部送信しません</span></div>
        <div><Command size={17} /><span><strong>すぐに使える</strong>登録もインストールも不要</span></div>
        <div><Sparkles size={17} /><span><strong>広告なし</strong>作業を邪魔するものは置きません</span></div>
      </section>

      <section className="tools-section" id="tools">
        <div className="section-heading">
          <div>
            <span className="section-number">01</span>
            <h2>道具箱</h2>
            <p>{toolCount}ワークスペース・{functionCount}機能。すべて無料です。</p>
          </div>
          <div className="function-count"><strong>{functionCount}</strong><span>FUNCTIONS<br />AVAILABLE</span></div>
        </div>

        <div className="tool-browser">
          <aside className="category-nav" aria-label="カテゴリ">
            <span className="category-label">CATEGORY</span>
            {categories.map((item) => (
              <button
                key={item.name}
                className={category === item.name ? "active" : ""}
                onClick={() => setCategory(item.name)}
                type="button"
              >
                <span>{item.name}</span>
                <small>{String(item.count).padStart(2, "0")}</small>
              </button>
            ))}
            <div className="roadmap-note">
              <span>NEXT</span>
              <strong>100機能まで拡張予定</strong>
              <p>必要な道具を、丁寧に追加していきます。</p>
            </div>
          </aside>

          <div className="tool-list">
            <div className="list-search">
              <Search size={16} />
              <input
                id="tool-list-search"
                name="tool-list-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="一覧を絞り込む"
                aria-label="一覧を絞り込む"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="検索をクリア">
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="list-labels">
              <span>TOOL · {filteredTools.length} / {toolCount} DISPLAYED</span><span>CATEGORY</span><span>FUNCTIONS</span>
            </div>
            {filteredTools.length ? (
              filteredTools.map((tool) => (
                <Link className="tool-row" href={tool.href} key={tool.index}>
                  <span className={`tool-index accent-${tool.accent}`}>{tool.index}</span>
                  <span className="tool-main">
                    <strong>{tool.name}</strong>
                    <small>{tool.description}</small>
                  </span>
                  <span className="tool-category">{tool.category}</span>
                  <span className="tool-functions">{tool.functions}</span>
                  <ChevronRight className="tool-arrow" size={18} />
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <Braces size={26} />
                <strong>該当する道具がありません</strong>
                <button onClick={() => { setQuery(""); setCategory("すべて"); }}>
                  条件をクリア
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="section-heading">
          <div>
            <span className="section-number">02</span>
            <h2>静かな作業台であること。</h2>
          </div>
        </div>
        <div className="principles">
          <article><span>01</span><h3>速い</h3><p>ページを開いたらすぐに入力。余計な手順を挟みません。</p></article>
          <article><span>02</span><h3>安全</h3><p>処理は原則ローカルで完結。入力内容を保存しません。</p></article>
          <article><span>03</span><h3>正直</h3><p>できることと、データの扱いを明確に伝えます。</p></article>
        </div>
        <Link className="text-link" href="/tools/json">
          JSON Toolsを試す <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
