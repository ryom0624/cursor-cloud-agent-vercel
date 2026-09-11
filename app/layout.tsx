import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { SiteHeader } from "@/components/site-header";
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
    <html lang="ja" data-scroll-behavior="smooth">
      <body>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <div>
            <span className="footer-brand">DevSmith</span>
            <span>入力データは、あなたのブラウザから出ません。</span>
          </div>
          <div className="footer-links">
            <Link href="/privacy">プライバシー</Link>
            <Link href="/#tools">ツール一覧</Link>
            <span>© 2026</span>
          </div>
        </footer>
        <AnalyticsConsent />
      </body>
    </html>
  );
}
