"use client";

import { ArrowLeftRight, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import YAML from "yaml";
import { ToolShell, TextWorkspace } from "@/components/tool-shell";
import { csvToJson, jsonToCsv } from "@/lib/tool-utils";

type Mode = "json-yaml" | "json-csv" | "json-jsonl" | "json-query";

const jsonSample = `[
  {
    "id": "tool-001",
    "name": "DevSmith",
    "type": "toolbox",
    "private": true,
    "tags": ["json", "developer-tools"],
    "owner": { "team": "Platform", "active": true },
    "metrics": { "users": 18420, "rating": 4.8 }
  },
  {
    "id": "tool-002",
    "name": "Workbench",
    "type": "utility",
    "private": false,
    "tags": ["converter", "browser"],
    "owner": { "team": "Product", "active": true },
    "metrics": { "users": 7320, "rating": 4.6 }
  }
]`;

const yamlSample = `project:
  name: DevSmith
  version: 1.2.0
  private: true
  maintainers:
    - name: Aki Tanaka
      role: Lead
    - name: Mina Sato
      role: Reviewer
  environments:
    production:
      region: hnd1
      replicas: 3
    preview:
      region: sin1
      replicas: 1
  features:
    - format
    - validate
    - grid`;

const csvSample = `id,name,type,private,tags,owner,metrics
tool-001,DevSmith,toolbox,true,"[""json"",""developer-tools""]","{""team"":""Platform"",""active"":true}","{""users"":18420,""rating"":4.8}"
tool-002,Workbench,utility,false,"[""converter"",""browser""]","{""team"":""Product"",""active"":true}","{""users"":7320,""rating"":4.6}"`;

const jsonlSample = `{"id":"evt-101","level":"info","service":"api","durationMs":42}
{"id":"evt-102","level":"warn","service":"worker","durationMs":318}
{"id":"evt-103","level":"info","service":"web","durationMs":87}`;

const queryJsonSample = `{
  "query": "json tools",
  "page": 2,
  "limit": 25,
  "includeArchived": false,
  "tags": ["developer", "browser"]
}`;

const querySample = `query=json+tools&page=2&limit=25&includeArchived=false&tags=%5B%22developer%22%2C%22browser%22%5D`;

const samples: Record<Mode, { forward: string; reverse: string }> = {
  "json-yaml": { forward: jsonSample, reverse: yamlSample },
  "json-csv": { forward: jsonSample, reverse: csvSample },
  "json-jsonl": { forward: jsonSample, reverse: jsonlSample },
  "json-query": { forward: queryJsonSample, reverse: querySample },
};

const modeLabels: Record<Mode, [string, string]> = {
  "json-yaml": ["JSON", "YAML"],
  "json-csv": ["JSON", "CSV"],
  "json-jsonl": ["JSON", "JSON Lines"],
  "json-query": ["JSON", "Query String"],
};

function jsonToJsonLines(input: string) {
  const parsed: unknown = JSON.parse(input);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map((item) => JSON.stringify(item)).join("\n");
}

function jsonLinesToJson(input: string) {
  const items = input
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as unknown);
  return JSON.stringify(items, null, 2);
}

function jsonToQuery(input: string) {
  const parsed = JSON.parse(input) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Query Stringへ変換するJSONはオブジェクトにしてください。");
  }
  const params = new URLSearchParams();
  Object.entries(parsed).forEach(([key, value]) => {
    params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  });
  return params.toString();
}

function queryToJson(input: string) {
  const parseValue = (value: string) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  };
  const result: Record<string, unknown> = {};
  new URLSearchParams(input).forEach((value, key) => {
    result[key] = parseValue(value);
  });
  return JSON.stringify(result, null, 2);
}

export function DataConverterSuite() {
  const [mode, setMode] = useState<Mode>("json-yaml");
  const [reverse, setReverse] = useState(false);
  const [input, setInput] = useState(jsonSample);

  const baseLabels = modeLabels[mode];
  const labels = reverse ? [baseLabels[1], baseLabels[0]] : baseLabels;

  const conversion = useMemo(() => {
    try {
      if (mode === "json-yaml") {
        return {
          output: reverse
            ? JSON.stringify(YAML.parse(input), null, 2)
            : YAML.stringify(JSON.parse(input)),
          error: "",
        };
      }
      if (mode === "json-csv") {
        return {
          output: reverse ? csvToJson(input) : jsonToCsv(input),
          error: "",
        };
      }
      if (mode === "json-jsonl") {
        return {
          output: reverse ? jsonLinesToJson(input) : jsonToJsonLines(input),
          error: "",
        };
      }
      return {
        output: reverse ? queryToJson(input) : jsonToQuery(input),
        error: "",
      };
    } catch (error) {
      return {
        output: "",
        error: error instanceof Error ? error.message : "変換できませんでした。",
      };
    }
  }, [input, mode, reverse]);

  const changeMode = (next: string) => {
    const nextMode = next as Mode;
    setMode(nextMode);
    setReverse(false);
    setInput(samples[nextMode].forward);
  };

  const toggleDirection = () => {
    const nextReverse = !reverse;
    setReverse(nextReverse);
    setInput(nextReverse ? samples[mode].reverse : samples[mode].forward);
  };

  return (
    <ToolShell
      slug="data-converter"
      category="データ"
      title="Data Converter"
      description="JSON、YAML、CSV、JSON Lines、Query Stringを同じ作業台で相互変換します。"
      functionCount={4}
      tabs={[
        { id: "json-yaml", label: "JSON ↔ YAML" },
        { id: "json-csv", label: "JSON ↔ CSV" },
        { id: "json-jsonl", label: "JSON ↔ JSONL" },
        { id: "json-query", label: "JSON ↔ Query" },
      ]}
      activeTab={mode}
      onTabChange={changeMode}
    >
      <TextWorkspace
        input={input}
        output={conversion.output}
        onInput={setInput}
        inputLabel={labels[0]}
        outputLabel={labels[1]}
        error={conversion.error}
        toolbar={
          <>
            <button type="button" className="primary-button" onClick={toggleDirection}>
              <ArrowLeftRight size={14} aria-hidden="true" />
              {labels[0]} → {labels[1]}　入れ替える
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setInput(reverse ? samples[mode].reverse : samples[mode].forward)
              }
            >
              <RotateCcw size={14} aria-hidden="true" />
              サンプルを読み込む
            </button>
          </>
        }
      />
    </ToolShell>
  );
}
