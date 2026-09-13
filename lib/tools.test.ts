import { describe, expect, it } from "vitest";
import { categories, functionCount, listedTools, searchTools, toolCount } from "./tools";

describe("tool registry", () => {
  it("keeps home counts in sync with the registry", () => {
    expect(toolCount).toBe(listedTools.length);
    expect(functionCount).toBe(listedTools.reduce((total, tool) => total + tool.functions, 0));
    expect(functionCount).toBeGreaterThan(40);
    expect(categories.find((item) => item.name === "すべて")?.count).toBe(toolCount);
    expect(listedTools.map((tool) => tool.slug)).toEqual([
      "json",
      "data-converter",
      "csv-viewer",
      "sql",
      "encoder",
      "jwt",
      "hash",
      "id-generator",
      "password",
      "regex",
      "diff",
      "text",
      "lorem",
      "date-time",
      "cron",
      "number",
      "url",
      "http",
      "openapi",
      "network",
      "har",
    ]);
  });

  it("searches capabilities and keywords", () => {
    expect(searchTools("duckdb").map((tool) => tool.slug)).toEqual(["sql"]);
    expect(searchTools("curl")[0]?.slug).toBe("http");
    expect(searchTools("cidr")[0]?.slug).toBe("network");
  });
});
