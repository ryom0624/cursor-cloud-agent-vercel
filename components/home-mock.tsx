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
import { useMemo, useState } from "react";
import {
  categories,
  functionCount,
  pasteAnythingStorageKeys,
  searchTools,
  toolCount,
  tools,
} from "@/lib/tools";
import { useRecentlyUsedTools } from "@/lib/recently-used";

type PasteType = "json" | "csv" | "tsv" | "jwt" | "url" | "timestamp" | "base64" | "text" | "curl" | "openapi" | "har";

type PasteDetection = {
  type: PasteType;
  label: string;
  reason: string;
  tool: string;
  href: string;
};

const detections: Record<PasteType, Omit<PasteDetection, "type" | "reason">> = {
  json: { label: "JSON", tool: "JSON Tools", href: "/tools/json" },
  csv: { label: "CSV", tool: "CSV Viewer", href: "/tools/csv-viewer" },
  tsv: { label: "TSV", tool: "CSV Viewer", href: "/tools/csv-viewer" },
  jwt: { label: "JWT", tool: "JWT Decoder", href: "/tools/jwt" },
  url: { label: "URL", tool: "URL Tools", href: "/tools/url" },
  timestamp: { label: "UNIX TIMESTAMP", tool: "Date & Time", href: "/tools/date-time" },
  base64: { label: "BASE64", tool: "Encoder / Decoder", href: "/tools/encoder" },
  text: { label: "TEXT", tool: "Text Tools", href: "/tools/text" },
  curl: { label: "cURL", tool: "HTTP Tools", href: "/tools/http" },
  openapi: { label: "OPENAPI", tool: "OpenAPI Tools", href: "/tools/openapi" },
  har: { label: "HAR", tool: "HAR Analyzer", href: "/tools/har" },
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

  if (/^\s*curl[\s\n]/i.test(input)) {
    return result("curl", "curlコマンドとして解析できます。");
  }

  if (/^openapi:\s*['"]?3/m.test(input)) {
    return result("openapi", "OpenAPI 3.x のYAMLを検出しました。");
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
    const parsed: unknown = JSON.parse(input);
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (typeof record.openapi === "string" && record.openapi.startsWith("3.")) {
        return result("openapi", "OpenAPI 3.x のJSONを検出しました。");
      }
      const log = record.log && typeof record.log === "object" ? (record.log as Record<string, unknown>) : record;
      if (Array.isArray(log.entries)) {
        return result("har", "HARのentries配列を検出しました。");
      }
    }
    return result("json", "JSON.parseで構文を正しく解析できました。");
  } catch {
    // Continue with the remaining local checks.
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

export function HomeMock() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");
  const [pasteValue, setPasteValue] = useState("");
  const recent = useRecentlyUsedTools();

  const pasteDetection = useMemo(() => detectPaste(pasteValue), [pasteValue]);
  const quickStartTools = useMemo(
    () => tools.filter((tool) => tool.featured).slice(0, 4),
    [],
  );

  const filteredTools = useMemo(() => {
    return searchTools(query).filter(
      (tool) => category === "すべて" || tool.category === category,
    );
  }, [category, query]);

  const openDetectedTool = () => {
    if (!pasteDetection) return;
    sessionStorage.setItem(pasteAnythingStorageKeys.value, pasteValue);
    sessionStorage.setItem(pasteAnythingStorageKeys.type, pasteDetection.type);
    router.push(pasteDetection.href);
  };

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Asterisk size={15} />
            PRIVATE BROWSER UTILITIES / DEFINED BY USE
          </div>
          <h1>
            小さな作業を、
            <br />
            <span>素早く片づける。</span>
          </h1>
          <p>
            JSONを整える。文字列を変換する。IDを生成する。
            <br className="desktop-only" />
            エンジニアが毎日使う道具だけを、ひとつの場所に。
          </p>
          <div className="hero-search-wrap">
            <Search size={19} />
            <input
              id="hero-tool-search"
              name="hero-tool-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="何をしたいですか？  例：JSONを整形"
              aria-label="ツールを検索"
            />
            <kbd>/</kbd>
          </div>
          <div className="quick-links">
            <span>QUICK COMMAND</span>
            <Link href="/tools/json">JSON整形</Link>
            <Link href="/tools/encoder">Base64</Link>
            <Link href="/tools/id-generator">UUID生成</Link>
          </div>
        </div>

        <div className="quick-start" aria-label="よく使う道具">
          <div className="quick-start-head">
            <span>QUICK START</span>
            <small>{String(quickStartTools.length).padStart(2, "0")} / MOST USED</small>
          </div>
          <div className="quick-start-list">
            {quickStartTools.map((tool) => (
              <Link href={tool.href} key={tool.index}>
                <span>{tool.index}</span>
                <strong>{tool.name}</strong>
                <small>{tool.description}</small>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
          <div className="quick-start-foot">
            <span><LockKeyhole size={13} /> 処理はこのブラウザ内だけで完結</span>
            <strong>{functionCount} FUNCTIONS</strong>
          </div>
        </div>
      </section>

      <section className="paste-anything" aria-labelledby="paste-anything-title">
        <div className="paste-anything-heading">
          <div>
            <span>LOCAL AUTO DETECTION</span>
            <h2 id="paste-anything-title">PASTE ANYTHING</h2>
          </div>
          <small>入力内容は外部へ送信されません</small>
        </div>
        <textarea
          value={pasteValue}
          onChange={(event) => setPasteValue(event.target.value)}
          placeholder="JSON、CSV / TSV、JWT、URL、Unix timestamp、Base64、テキストを貼り付け"
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
              <button type="button" onClick={openDetectedTool}>
                このツールで開く <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <p className="paste-anything-empty">貼り付けると、この端末内ですぐに判定します。</p>
          )}
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
        {recent.length > 0 && (
          <div className="recent-tools" aria-label="最近使った道具">
            <span>RECENTLY USED</span>
            {recent.slice(0, 6).map((tool) => (
              <Link href={tool.href} key={`recent-${tool.slug}`}>{tool.name}</Link>
            ))}
          </div>
        )}

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
