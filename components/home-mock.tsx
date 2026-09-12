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
import { useMemo, useState } from "react";
import { categories, tools } from "@/lib/tools";

export function HomeMock() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");

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
            <small>04 / MOST USED</small>
          </div>
          <div className="quick-start-list">
            {tools.filter((tool) => tool.featured).slice(0, 4).map((tool) => (
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
            <strong>28 FUNCTIONS</strong>
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
            <p>14ワークスペース・28機能。すべて無料です。</p>
          </div>
          <div className="function-count"><strong>24</strong><span>FUNCTIONS<br />AVAILABLE</span></div>
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
              <span>TOOL</span><span>CATEGORY</span><span>FUNCTIONS</span>
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
