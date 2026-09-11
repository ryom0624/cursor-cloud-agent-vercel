"use client";

import {
  ArrowRight,
  Brackets,
  Code2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { tools } from "@/lib/tools";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = normalized
      ? tools.filter((tool) =>
          `${tool.name} ${tool.description} ${tool.category}`
            .toLowerCase()
            .includes(normalized),
        )
      : tools.filter((tool) => tool.featured);
    return matches.slice(0, 7);
  }, [query]);

  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="DevSmith ホーム">
          <span className="brand-mark">
            <Brackets size={18} strokeWidth={2} />
          </span>
          <span>DevSmith</span>
        </Link>
        <nav className="global-nav" aria-label="グローバルナビゲーション">
          <Link href="/#tools">ツール</Link>
          <Link href="/#about">このサイトについて</Link>
        </nav>
        <div className="header-actions">
          <button
            className="header-search"
            type="button"
            onClick={() => setOpen(true)}
          >
            <Search size={15} />
            <span>ツールを探す</span>
            <kbd>⌘ K</kbd>
          </button>
          <a
            className="icon-link"
            href="https://github.com/ryom0624/cursor-cloud-agent-vercel"
            aria-label="GitHubリポジトリ"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={18} />
          </a>
        </div>
      </header>

      {open && (
        <div
          className="command-overlay"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="command-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="ツール検索"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="command-input">
              <Search size={19} />
              <input
                ref={inputRef}
                id="global-tool-search"
                name="global-tool-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ツール名や、やりたいことを入力"
              />
              <kbd>ESC</kbd>
            </div>
            <div className="command-results">
              <span className="command-label">
                {query ? "検索結果" : "よく使う道具"}
              </span>
              {results.length ? (
                results.map((tool) => (
                  <Link
                    href={tool.href}
                    key={tool.index}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className={`command-icon accent-${tool.accent}`}>
                      {tool.index}
                    </span>
                    <span>
                      <strong>{tool.name}</strong>
                      <small>{tool.description}</small>
                    </span>
                    <ArrowRight size={15} />
                  </Link>
                ))
              ) : (
                <div className="command-empty">一致するツールがありません</div>
              )}
            </div>
            <div className="command-help">
              <span>クリックで開く</span>
              <span>esc 閉じる</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
