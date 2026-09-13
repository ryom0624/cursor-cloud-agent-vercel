import { describe, expect, it } from "vitest";
import {
  mermaidViewerDefaultSample,
  mermaidViewerSamples,
} from "./mermaid-samples";
import { detectDiagramType, extractMermaidSource } from "./mermaid-utils";

describe("mermaid viewer samples", () => {
  it("covers the main diagram types with unique DevSmith-themed sources", () => {
    expect(mermaidViewerSamples.length).toBeGreaterThanOrEqual(8);
    const ids = mermaidViewerSamples.map((sample) => sample.id);
    const names = mermaidViewerSamples.map((sample) => sample.name);
    const types = mermaidViewerSamples.map((sample) => sample.type);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(types).size).toBe(types.length);
    expect(mermaidViewerDefaultSample.id).toBe("flowchart");
  });

  it("keeps each sample aligned with its declared diagram type", () => {
    for (const sample of mermaidViewerSamples) {
      expect(detectDiagramType(extractMermaidSource(sample.source))).toBe(sample.type);
      expect(sample.source.length).toBeGreaterThan(80);
      expect(sample.description.length).toBeGreaterThan(8);
    }
  });

  it("uses the same product vocabulary as the rest of the toolbox", () => {
    const combined = mermaidViewerSamples.map((sample) => sample.source).join("\n");
    expect(combined).toContain("DevSmith");
    expect(combined).toContain("JSON Tools");
    expect(combined).toContain("CSV Viewer");
    expect(combined).toContain("Mermaid Viewer");
    expect(combined).toContain("Paste Anything");
    expect(combined).toContain("LOCAL ONLY");
    const flowchart = mermaidViewerSamples.find((sample) => sample.id === "flowchart");
    expect(flowchart?.source).toContain("Number Tools");
    expect(flowchart?.source).toContain("Data Converter");
    expect(flowchart?.source).toContain("Regex Tester");
  });
});
