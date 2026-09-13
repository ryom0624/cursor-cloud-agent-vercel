"use client";

import { Clock3, PanelLeftClose, PanelRightOpen } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { recordRecentlyUsed, useRecentlyUsedTools } from "@/lib/recently-used";
import { listedTools } from "@/lib/tools";

export function useRecordToolUse(slug: string) {
  useEffect(() => {
    const timer = window.setTimeout(() => recordRecentlyUsed(slug), 0);
    return () => window.clearTimeout(timer);
  }, [slug]);
}

export function WorkspaceSidebar({
  currentSlug,
  collapsed,
  onToggle,
}: {
  currentSlug: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const recent = useRecentlyUsedTools();

  return (
    <aside className="workbench-sidebar">
      <div className="sidebar-title">
        <span>WORKSPACES</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
          title={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
        >
          {collapsed ? <PanelRightOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
      {recent.length > 0 && (
        <div className="sidebar-recent" aria-label="最近使った道具">
          <span>RECENT</span>
          {recent.slice(0, 4).map((tool) => (
            <Link
              href={tool.href}
              key={`recent-${tool.slug}`}
              className={tool.slug === currentSlug ? "current" : ""}
            >
              {tool.name}
            </Link>
          ))}
        </div>
      )}
      {listedTools.map((tool) => (
        <Link
          href={tool.href}
          key={tool.slug}
          className={tool.slug === currentSlug ? "current" : ""}
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
  );
}
