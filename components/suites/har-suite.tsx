"use client";

import { useRouter } from "next/navigation";
import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import { GeneratedRequestPanel } from "@/components/generated-request";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  filterHarEntries,
  harEntryToHttpRequest,
  parseHar,
  sampleHar,
  type HarEntryView,
  type HarFilter,
} from "@/lib/har/har";
import { setHandoff } from "@/lib/workspace-handoff";

export function HarSuite() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<HarFilter>("all");
  const [selected, setSelected] = useState<number>(0);
  const [dragging, setDragging] = useState(false);

  const parsed = useMemo(() => (input.trim() ? parseHar(input) : null), [input]);
  const entries = parsed?.ok ? filterHarEntries(parsed.summary.entries, filter) : [];
  const current = entries.find((entry) => entry.index === selected) ?? entries[0];

  const onDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    setInput(await file.text());
  };

  const openInHttp = (entry: HarEntryView) => {
    setHandoff("devsmith:handoff:http-request", harEntryToHttpRequest(entry));
    setHandoff("devsmith:handoff:http-tab", "builder");
    router.push("/tools/http");
  };

  return (
    <ToolShell
      slug="har"
      category="ネットワーク"
      title="HAR Analyzer"
      description="HARファイルをブラウザ内で解析します。外部へアップロードしません。"
      functionCount={3}
      tabs={[{ id: "analyzer", label: "Analyzer" }]}
      activeTab="analyzer"
    >
      <div
        className={`har-drop ${dragging ? "is-dragging" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={(event) => void onDrop(event)}
      >
        HARをドロップ、または貼り付け
        <button type="button" onClick={() => setInput(sampleHar)}>サンプル</button>
      </div>
      <textarea className="raw-input" value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} aria-label="HAR JSON" />
      {parsed?.ok && (
        <>
          <div className="kv-grid">
            <div><span>Requests</span><strong>{parsed.summary.requestCount}</strong></div>
            <div><span>Total transferred</span><strong>{parsed.summary.totalTransferred.toLocaleString()} B</strong></div>
            <div><span>Total duration</span><strong>{Math.round(parsed.summary.totalDuration)} ms</strong></div>
            <div><span>Errors</span><strong>{parsed.summary.errorCount}</strong></div>
            <div><span>Slow Requests</span><strong>{parsed.summary.slowCount}</strong></div>
            <div><span>Largest</span><strong>{parsed.summary.largestSize.toLocaleString()} B</strong></div>
          </div>
          <div className="segmented-control wrap">
            {(["all", "slowest", "largest", "4xx", "5xx"] as HarFilter[]).map((item) => (
              <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="har-table-wrap">
            <table className="har-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Host</th>
                  <th>Path</th>
                  <th>Size</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.index}
                    className={current?.index === entry.index ? "active" : ""}
                    onClick={() => setSelected(entry.index)}
                  >
                    <td>{entry.method}</td>
                    <td>{entry.status}</td>
                    <td>{entry.host}</td>
                    <td>{entry.path}</td>
                    <td>{entry.size.toLocaleString()}</td>
                    <td>{Math.round(entry.duration)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {current && (
            <section className="har-detail">
              <h3>Request Detail</h3>
              <p>General: {current.method} {current.url} · {current.httpVersion || "HTTP"} · {current.status} {current.statusText}</p>
              <p>Request Headers: {current.requestHeaders.map((item) => `${item.name}: ${item.value}`).join(" · ") || "なし"}</p>
              <p>Response Headers: {current.responseHeaders.map((item) => `${item.name}: ${item.value}`).join(" · ") || "なし"}</p>
              <p>Query: {current.query.map((item) => `${item.name}=${item.value}`).join(" · ") || "なし"}</p>
              <p>Timing: {Object.entries(current.timings).map(([key, value]) => `${key}=${value}`).join(" · ") || `${current.duration} ms`}</p>
              <p>Response metadata: {current.mimeType || "unknown"} · {current.size.toLocaleString()} B</p>
              <button type="button" className="primary-button" onClick={() => openInHttp(current)}>
                Open in HTTP Tools
              </button>
              <GeneratedRequestPanel
                model={harEntryToHttpRequest(current)}
                targets={["curl", "fetch", "axios", "python"]}
              />
            </section>
          )}
        </>
      )}
      <ToolStatus error={parsed && !parsed.ok ? parsed.error : undefined}>
        HARはブラウザ内だけで解析します
      </ToolStatus>
    </ToolShell>
  );
}
