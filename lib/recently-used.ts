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

const EMPTY_TOOLS: Tool[] = [];
let cachedKey = "";
let cachedTools: Tool[] = EMPTY_TOOLS;

export function readRecentlyUsedTools(): Tool[] {
  const slugs = readRecentlyUsedSlugs();
  const key = slugs.join(",");
  if (key === cachedKey) return cachedTools;
  cachedKey = key;
  cachedTools = slugs
    .map((slug) => toolBySlug[slug])
    .filter((tool): tool is Tool => Boolean(tool));
  return cachedTools;
}

export function recordRecentlyUsed(slug: string) {
  if (typeof window === "undefined") return;
  if (!toolBySlug[slug]) return;
  const next = [slug, ...readRecentlyUsedSlugs().filter((item) => item !== slug)].slice(0, LIMIT);
  cachedKey = "";
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
  return useSyncExternalStore(subscribeRecentlyUsed, readRecentlyUsedTools, () => EMPTY_TOOLS);
}
