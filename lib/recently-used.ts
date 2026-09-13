import { useSyncExternalStore } from "react";
import { listedTools, toolBySlug, type Tool } from "./tools";

export const recentlyUsedStorageKey = "devsmith:recently-used";
export const recentlyUsedEvent = "devsmith-recent-change";
const LIMIT = 8;

export function readRecentlyUsedSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentlyUsedStorageKey) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (slug): slug is string =>
        typeof slug === "string" && Boolean(toolBySlug[slug]),
    );
  } catch {
    return [];
  }
}

export function readRecentlyUsedTools(): Tool[] {
  return readRecentlyUsedSlugs()
    .map((slug) => toolBySlug[slug])
    .filter((tool): tool is Tool => Boolean(tool));
}

export function recordRecentlyUsed(slug: string) {
  if (typeof window === "undefined") return;
  if (!toolBySlug[slug]) return;
  const next = [slug, ...readRecentlyUsedSlugs().filter((item) => item !== slug)].slice(0, LIMIT);
  window.localStorage.setItem(recentlyUsedStorageKey, JSON.stringify(next));
  window.dispatchEvent(new Event(recentlyUsedEvent));
}

export function featuredTools(limit = 7) {
  return listedTools.filter((tool) => tool.featured).slice(0, limit);
}

function subscribeRecentlyUsed(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(recentlyUsedEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(recentlyUsedEvent, callback);
  };
}

export function useRecentlyUsedTools() {
  return useSyncExternalStore(subscribeRecentlyUsed, readRecentlyUsedTools, () => []);
}
