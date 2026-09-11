"use client";

import { useMemo, useState } from "react";
import YAML from "yaml";
import { ToolShell, TextWorkspace } from "@/components/tool-shell";
import { csvToJson, jsonToCsv } from "@/lib/tool-utils";

type Mode = "json-yaml" | "json-csv";

const jsonSample = `[
  { "name": "DevSmith", "type": "toolbox", "private": true },
  { "name": "Workbench", "type": "utility", "private": true }
]`;

const yamlSample = `project: DevSmith
type: toolbox
functions:
  - format
  - validate
private: true`;

const csvSample = `name,type,private
DevSmith,toolbox,true
Workbench,utility,true`;

export function DataConverterSuite() {
  const [mode, setMode] = useState<Mode>("json-yaml");
  const [reverse, setReverse] = useState(false);
  const [input, setInput] = useState(jsonSample);

  const labels =
    mode === "json-yaml"
      ? reverse
        ? ["YAML", "JSON"]
        : ["JSON", "YAML"]
      : reverse
        ? ["CSV", "JSON"]
        : ["JSON", "CSV"];

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
      return {
        output: reverse ? csvToJson(input) : jsonToCsv(input),
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
    setInput(jsonSample);
  };

  const toggleDirection = () => {
    const nextReverse = !reverse;
    setReverse(nextReverse);
    setInput(
      nextReverse
        ? mode === "json-yaml"
          ? yamlSample
          : csvSample
        : jsonSample,
    );
  };

  return (
    <ToolShell
      slug="data-converter"
      category="データ"
      title="Data Converter"
      description="JSON、YAML、CSVを同じ作業台で相互変換します。"
      functionCount={2}
      tabs={[
        { id: "json-yaml", label: "JSON ↔ YAML" },
        { id: "json-csv", label: "JSON ↔ CSV" },
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
              {labels[0]} → {labels[1]}　入れ替える
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setInput(
                  reverse
                    ? mode === "json-yaml"
                      ? yamlSample
                      : csvSample
                    : jsonSample,
                )
              }
            >
              サンプルを読み込む
            </button>
          </>
        }
      />
    </ToolShell>
  );
}
