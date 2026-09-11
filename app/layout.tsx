import type { Metadata } from "next";
import Link from "next/link";
import { Brackets, Github, Search } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevSmith — 開発に必要な道具を、ひとつの場所に。",
  description:
    "JSON整形、Base64変換、UUID生成など、エンジニアの日常作業を軽くするブラウザツール集。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
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
            <button className="header-search" type="button">
              <Search size={15} />
              <span>ツールを探す</span>
              <kbd>⌘ K</kbd>
            </button>
            <a
              className="icon-link"
              href="https://github.com"
              aria-label="GitHub"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={18} />
            </a>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div>
            <span className="footer-brand">DevSmith</span>
            <span>入力データは、あなたのブラウザから出ません。</span>
          </div>
          <div className="footer-links">
            <a href="#">プライバシー</a>
            <a href="#">更新履歴</a>
            <span>© 2026</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
