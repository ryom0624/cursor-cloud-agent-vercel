"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GeneratedRequestPanel } from "@/components/generated-request";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  diffOpenApi,
  operationToHttpRequest,
  parseOpenApi,
  sampleOpenApi,
  type OpenApiDocument,
  type OpenApiOperation,
} from "@/lib/openapi/openapi";
import { setHandoff } from "@/lib/workspace-handoff";

type OpenApiTab = "explorer" | "schema" | "diff";

export function OpenApiSuite() {
  const router = useRouter();
  const [tab, setTab] = useState<OpenApiTab>("explorer");
  const [input, setInput] = useState(sampleOpenApi);
  const [selectedKey, setSelectedKey] = useState("GET /users");
  const [beforeInput, setBeforeInput] = useState(sampleOpenApi);
  const [afterInput, setAfterInput] = useState(sampleOpenApi.replace("version: 1.0.0", "version: 1.1.0"));

  const parsed = useMemo(() => parseOpenApi(input), [input]);
  const document = parsed.ok ? parsed.document : null;
  const selected = document?.operations.find((item) => `${item.method} ${item.path}` === selectedKey) ?? document?.operations[0];
  const before = useMemo(() => parseOpenApi(beforeInput), [beforeInput]);
  const after = useMemo(() => parseOpenApi(afterInput), [afterInput]);
  const diff = before.ok && after.ok ? diffOpenApi(before.document, after.document) : null;

  const openInHttp = (current: OpenApiDocument, operation: OpenApiOperation) => {
    setHandoff("devsmith:handoff:http-request", operationToHttpRequest(current, operation));
    setHandoff("devsmith:handoff:http-tab", "builder");
    router.push("/tools/http");
  };

  return (
    <ToolShell
      slug="openapi"
      category="ネットワーク"
      title="OpenAPI Tools"
      description="OpenAPI 3.x をブラウザ内で検証し、Endpoint と Schema を確認します。"
      functionCount={5}
      tabs={[
        { id: "explorer", label: "Explorer" },
        { id: "schema", label: "Schemas" },
        { id: "diff", label: "Diff" },
      ]}
      activeTab={tab}
      onTabChange={(value) => setTab(value as OpenApiTab)}
    >
      {tab === "explorer" && (
        <div className="sql-layout">
          <aside className="sql-schema openapi-endpoints">
            <header>ENDPOINTS</header>
            {document?.operations.map((operation) => {
              const key = `${operation.method} ${operation.path}`;
              return (
                <button
                  key={key}
                  type="button"
                  className={`${operation.method.toLowerCase()} ${key === selectedKey ? "active" : ""}`}
                  onClick={() => setSelectedKey(key)}
                >
                  <em>{operation.method}</em>
                  {operation.path}
                </button>
              );
            })}
          </aside>
          <div className="sql-main">
            <textarea className="raw-input" value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} aria-label="OpenAPI YAML / JSON" />
            {document && selected && (
              <>
                <div className="kv-grid">
                  <div><span>Title</span><strong>{document.title} {document.version}</strong></div>
                  <div><span>OpenAPI</span><strong>{document.openapi}</strong></div>
                  <div><span>Endpoint</span><strong>{selected.method} {selected.path}</strong></div>
                </div>
                <section className="openapi-section">
                  <h3>Parameters</h3>
                  {selected.parameters.length ? selected.parameters.map((parameter) => (
                    <p key={`${parameter.in}-${parameter.name}`}>
                      <strong>{parameter.in}</strong> {parameter.name} {parameter.required ? "(required)" : ""}
                    </p>
                  )) : <p>なし</p>}
                </section>
                <section className="openapi-section">
                  <h3>Request Body</h3>
                  <pre className="code-block">{JSON.stringify(selected.requestBody ?? "なし", null, 2)}</pre>
                </section>
                <section className="openapi-section">
                  <h3>Responses</h3>
                  <pre className="code-block">{JSON.stringify(selected.responses, null, 2)}</pre>
                </section>
                <button type="button" className="primary-button" onClick={() => openInHttp(document, selected)}>
                  Generate Request / Open in HTTP Tools
                </button>
                <GeneratedRequestPanel
                  model={operationToHttpRequest(document, selected)}
                  targets={["curl", "fetch", "axios", "python"]}
                />
              </>
            )}
            <ToolStatus error={parsed.ok ? undefined : parsed.error}>
              {document ? `${document.operations.length} endpoints · 検証OK` : "OpenAPI 3.x を貼り付けてください"}
            </ToolStatus>
          </div>
        </div>
      )}

      {tab === "schema" && (
        <>
          {document?.schemas.map((schema) => (
            <details key={schema.name} open className="schema-block">
              <summary>{schema.name}</summary>
              <pre className="code-block">{JSON.stringify(schema.schema, null, 2)}</pre>
            </details>
          ))}
          <ToolStatus error={parsed.ok ? undefined : parsed.error}>
            {document ? `${document.schemas.length} schemas` : "ドキュメントを解析できません"}
          </ToolStatus>
        </>
      )}

      {tab === "diff" && (
        <div className="split-workspace">
          <label className="suite-editor">
            <header>OPENAPI A</header>
            <textarea value={beforeInput} onChange={(event) => setBeforeInput(event.target.value)} spellCheck={false} />
          </label>
          <label className="suite-editor">
            <header>OPENAPI B</header>
            <textarea value={afterInput} onChange={(event) => setAfterInput(event.target.value)} spellCheck={false} />
          </label>
          {diff && (
            <div className="openapi-diff">
              <p>Added Endpoint: {diff.added.map((item) => `${item.method} ${item.path}`).join(", ") || "なし"}</p>
              <p>Removed Endpoint: {diff.removed.map((item) => `${item.method} ${item.path}`).join(", ") || "なし"}</p>
              <p>Changed Endpoint: {diff.changed.map((item) => `${item.after.method} ${item.after.path} (${item.reasons.join(", ")})`).join(", ") || "なし"}</p>
              <p>Schema added: {diff.addedSchemas.join(", ") || "なし"}</p>
              <p>Schema removed: {diff.removedSchemas.join(", ") || "なし"}</p>
              <p>Schema changed: {diff.changedSchemas.join(", ") || "なし"}</p>
            </div>
          )}
          <ToolStatus error={!before.ok ? before.error : !after.ok ? after.error : undefined}>
            2つの OpenAPI をブラウザ内で比較します
          </ToolStatus>
        </div>
      )}
    </ToolShell>
  );
}
