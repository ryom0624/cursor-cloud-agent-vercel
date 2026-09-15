import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { CopyToast } from "@/components/copy-button";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevSmith — Paste Anything",
  description:
    "JSON、CSV、Mermaid、JWTなどを貼るだけで、適切なブラウザツールを開きます。処理はこの端末内だけで完結します。",
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
        <CopyToast />
      </body>
    </html>
  );
}
