import { describe, expect, it } from "vitest";
import {
  clampZoom,
  detectDiagramType,
  extractMermaidSource,
  fitTransform,
  firstDirectiveLine,
  formatZoomPercent,
  looksLikeMermaid,
  MAX_MERMAID_ZOOM,
  mermaidErrorMessage,
  MIN_MERMAID_ZOOM,
  parseSvgLength,
  diagramSizeFromSvgAttrs,
  zoomAroundPoint,
} from "./mermaid-utils";

const flowchart = `flowchart TD
  A[Start] --> B[End]`;

describe("mermaid source helpers", () => {
  it("unwraps a mermaid fence and ignores surrounding markdown", () => {
    expect(extractMermaidSource(`\`\`\`mermaid\n${flowchart}\n\`\`\``)).toBe(flowchart);
    expect(
      extractMermaidSource(`メモ\n\n\`\`\`mermaid\n${flowchart}\n\`\`\`\n\n以上`),
    ).toBe(flowchart);
    expect(extractMermaidSource(flowchart)).toBe(flowchart);
  });

  it("skips comments and frontmatter when reading the directive", () => {
    const source = `---
title: 図
---
%% コメント
flowchart LR
  A --> B`;
    expect(firstDirectiveLine(source)).toBe("flowchart LR");
    expect(detectDiagramType(source)).toBe("flowchart");
    expect(looksLikeMermaid(source)).toBe(true);
  });

  it("detects common diagram types and rejects unrelated text", () => {
    expect(detectDiagramType("sequenceDiagram\nA->>B: hi")).toBe("sequence");
    expect(detectDiagramType("classDiagram\nclass Tool")).toBe("class");
    expect(detectDiagramType("pie title Share\n\"A\": 1")).toBe("pie");
    expect(looksLikeMermaid('{"id":"PRJ-1042"}')).toBe(false);
    expect(looksLikeMermaid("id,name\n1,DevSmith")).toBe(false);
  });
});

describe("mermaid viewport math", () => {
  it("clamps zoom and keeps the cursor anchored while scaling", () => {
    expect(clampZoom(0)).toBe(MIN_MERMAID_ZOOM);
    expect(clampZoom(99)).toBe(MAX_MERMAID_ZOOM);
    expect(zoomAroundPoint(1, 2, { x: 100, y: 40 }, { x: 0, y: 0 })).toEqual({
      zoom: 2,
      pan: { x: -100, y: -40 },
    });
    expect(formatZoomPercent(1.42)).toBe("142%");
    expect(parseSvgLength("100%")).toBeNull();
    expect(parseSvgLength("1234.5px")).toBe(1234.5);
    expect(diagramSizeFromSvgAttrs({ width: "100%", height: "100%", viewBox: "0 0 800 420" })).toEqual({
      width: 800,
      height: 420,
    });
  });

  it("fits content inside the viewport with padding", () => {
    const fitted = fitTransform(400, 200, 400, 200, 0);
    expect(fitted.zoom).toBe(1);
    expect(fitted.pan).toEqual({ x: 0, y: 0 });
    const padded = fitTransform(400, 200, 400, 200, 50);
    expect(padded.zoom).toBeLessThan(1);
    expect(padded.pan.x).toBeGreaterThan(0);
    expect(padded.pan.y).toBeGreaterThan(0);
  });
});

describe("mermaid errors", () => {
  it("uses the first meaningful line of a parser error", () => {
    expect(mermaidErrorMessage(new Error("Parse error\n  at line 2"))).toBe("Parse error");
    expect(mermaidErrorMessage("nope")).toBe("Mermaid記法を解析できません。");
  });
});
