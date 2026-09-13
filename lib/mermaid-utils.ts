export const MIN_MERMAID_ZOOM = 0.15;
export const MAX_MERMAID_ZOOM = 8;

export type Point = { x: number; y: number };

const DIAGRAM_TYPES = [
  ["flowchart", "flowchart"],
  ["graph", "flowchart"],
  ["sequenceDiagram", "sequence"],
  ["classDiagram", "class"],
  ["stateDiagram-v2", "state"],
  ["stateDiagram", "state"],
  ["erDiagram", "er"],
  ["gantt", "gantt"],
  ["pie", "pie"],
  ["mindmap", "mindmap"],
  ["gitGraph", "git"],
  ["journey", "journey"],
  ["timeline", "timeline"],
  ["quadrantChart", "quadrant"],
  ["requirementDiagram", "requirement"],
  ["C4Context", "c4"],
  ["C4Container", "c4"],
  ["C4Component", "c4"],
  ["sankey-beta", "sankey"],
  ["xychart-beta", "xy"],
  ["block-beta", "block"],
  ["packet-beta", "packet"],
  ["architecture-beta", "architecture"],
  ["kanban", "kanban"],
  ["radar-beta", "radar"],
] as const;

export const diagramTypeLabels: Record<string, string> = {
  flowchart: "フローチャート",
  sequence: "シーケンス",
  class: "クラス",
  state: "状態遷移",
  er: "ER",
  gantt: "ガント",
  pie: "円グラフ",
  mindmap: "マインドマップ",
  git: "Gitグラフ",
  journey: "ジャーニー",
  timeline: "タイムライン",
  quadrant: "象限",
  requirement: "要求",
  c4: "C4",
  sankey: "サンキー",
  xy: "XYチャート",
  block: "ブロック",
  packet: "パケット",
  architecture: "アーキテクチャ",
  kanban: "カンバン",
  radar: "レーダー",
};

function unwrapFence(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:mermaid)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  return match ? match[1].trim() : null;
}

export function extractMermaidSource(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const whole = unwrapFence(trimmed);
  if (whole !== null) return whole;

  const fenced = trimmed.match(/```mermaid\s*\r?\n([\s\S]*?)\r?\n```/i);
  if (fenced) return fenced[1].trim();

  return trimmed;
}

function stripFrontmatter(source: string): string {
  if (!source.startsWith("---")) return source;
  const end = source.indexOf("\n---", 3);
  if (end < 0) return source;
  return source.slice(end + 4).trim();
}

export function firstDirectiveLine(source: string): string {
  const body = stripFrontmatter(source.trim());
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("%%") && !trimmed.startsWith("%%{")) continue;
    return trimmed;
  }
  return "";
}

export function detectDiagramType(source: string): string | null {
  const line = firstDirectiveLine(source);
  if (!line) return null;
  for (const [prefix, type] of DIAGRAM_TYPES) {
    if (line === prefix || line.startsWith(`${prefix} `) || line.startsWith(`${prefix}\t`)) {
      return type;
    }
  }
  return null;
}

export function looksLikeMermaid(input: string): boolean {
  return detectDiagramType(extractMermaidSource(input)) !== null;
}

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_MERMAID_ZOOM, Math.max(MIN_MERMAID_ZOOM, value));
}

export function zoomAroundPoint(
  zoom: number,
  nextZoom: number,
  point: Point,
  pan: Point,
): { zoom: number; pan: Point } {
  const current = clampZoom(zoom);
  const next = clampZoom(nextZoom);
  const scale = next / current;
  return {
    zoom: next,
    pan: {
      x: point.x - (point.x - pan.x) * scale,
      y: point.y - (point.y - pan.y) * scale,
    },
  };
}

export function fitTransform(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = 28,
): { zoom: number; pan: Point } {
  if (contentWidth <= 0 || contentHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { zoom: 1, pan: { x: 0, y: 0 } };
  }
  const availableWidth = Math.max(40, viewportWidth - padding * 2);
  const availableHeight = Math.max(40, viewportHeight - padding * 2);
  const zoom = clampZoom(Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1.6));
  return {
    zoom,
    pan: {
      x: (viewportWidth - contentWidth * zoom) / 2,
      y: (viewportHeight - contentHeight * zoom) / 2,
    },
  };
}

export function formatZoomPercent(zoom: number): string {
  return `${Math.round(clampZoom(zoom) * 100)}%`;
}

export function mermaidErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    const line = error.message.split("\n").find((value) => value.trim());
    return line?.trim() || error.message;
  }
  return "Mermaid記法を解析できません。";
}

export function diagramTypeLabel(type: string | null | undefined): string {
  if (!type) return "未判定";
  return diagramTypeLabels[type] ?? type;
}
