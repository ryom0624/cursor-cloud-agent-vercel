import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

export function ToolBreadcrumb({ title }: { title: string }) {
  return (
    <nav className="breadcrumb" aria-label="パンくず">
      <Link href="/">
        <Home size={13} aria-hidden="true" />
        ホーム
      </Link>
      <ChevronRight size={13} aria-hidden="true" />
      <Link href="/#tools">ツール一覧</Link>
      <ChevronRight size={13} aria-hidden="true" />
      <span aria-current="page">{title}</span>
    </nav>
  );
}
