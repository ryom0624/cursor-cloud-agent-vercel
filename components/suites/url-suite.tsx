"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ToolShell, ToolStatus, TextWorkspace } from "@/components/tool-shell";
import {
  buildQueryString,
  buildUrl,
  decodeUrlComponent,
  encodeUrlComponent,
  parseUrl,
} from "@/lib/url/url-tools";
import { emptyHttpRequest } from "@/lib/http/request-model";
import { setHandoff, takeTextHandoff } from "@/lib/workspace-handoff";

type UrlTab = "parse" | "query" | "build" | "encode" | "decode";

const sample = "https://example.com:8443/api/users?page=2&sort=name#detail";

export function UrlSuite() {
  const router = useRouter();
  const [tab, setTab] = useState<UrlTab>("parse");
  const [input, setInput] = useState(sample);
  const [pairs, setPairs] = useState([
    { key: "q", value: "hello world" },
    { key: "page", value: "2" },
  ]);
  const [protocol, setProtocol] = useState("https");
  const [hostname, setHostname] = useState("example.com");
  const [port, setPort] = useState("8443");
  const [pathname, setPathname] = useState("/api/users");
  const [fragment, setFragment] = useState("detail");
  const [codecInput, setCodecInput] = useState("hello world");

  useEffect(() => {
    const handed = takeTextHandoff("devsmith:handoff:url");
    if (!handed) return;
    const timer = window.setTimeout(() => setInput(handed), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const parsed = useMemo(() => parseUrl(input), [input]);
  const queryOutput = buildQueryString(pairs);
  const built = useMemo(() => {
    try {
      return { url: buildUrl({ protocol, hostname, port, pathname, query: pairs, fragment }), error: "" };
    } catch (error) {
      return { url: "", error: error instanceof Error ? error.message : "URLを組み立てできません。" };
    }
  }, [fragment, hostname, pairs, pathname, port, protocol]);
  const codec = useMemo(() => {
    try {
      return {
        output: tab === "decode" ? decodeUrlComponent(codecInput) : encodeUrlComponent(codecInput),
        error: "",
      };
    } catch (error) {
      return { output: "", error: error instanceof Error ? error.message : "変換できません。" };
    }
  }, [codecInput, tab]);

  const sendToHttp = () => {
    if (!parsed.ok) return;
    setHandoff("devsmith:handoff:http-request", {
      ...emptyHttpRequest(),
      method: "GET",
      url: parsed.value.href,
      query: parsed.value.query.map((item) => ({ key: item.key, value: item.value })),
    });
    setHandoff("devsmith:handoff:http-tab", "builder");
    router.push("/tools/http");
  };

  return (
    <ToolShell
      slug="url"
      category="ネットワーク"
      title="URL Tools"
      description="URLの分解、Query生成、Encode / Decodeをブラウザ内で行います。"
      functionCount={5}
      tabs={[
        { id: "parse", label: "Parse" },
        { id: "query", label: "Query" },
        { id: "build", label: "Build" },
        { id: "encode", label: "Encode" },
        { id: "decode", label: "Decode" },
      ]}
      activeTab={tab}
      onTabChange={(value) => setTab(value as UrlTab)}
    >
      {tab === "parse" && (
        <>
          <label className="control-label grow">
            URL
            <input value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} name="url-input" />
          </label>
          {parsed.ok ? (
            <>
              <div className="kv-grid">
                {[
                  ["Protocol", parsed.value.protocol],
                  ["Host", parsed.value.hostname],
                  ["Port", parsed.value.port || "(default)"],
                  ["Path", parsed.value.path],
                  ["Fragment", parsed.value.fragment || "(none)"],
                ].map(([label, value]) => (
                  <div key={label}><span>{label}</span><strong>{value}</strong></div>
                ))}
              </div>
              <div className="pair-table">
                <header>QUERY PARAMETERS</header>
                {parsed.value.query.length ? parsed.value.query.map((item, index) => (
                  <div key={`${item.key}-${index}`}>
                    <strong>{item.key}</strong>
                    <span>Raw Value {item.raw}</span>
                    <span>Decoded Value {item.decoded}</span>
                  </div>
                )) : <p>Queryはありません</p>}
              </div>
              <div className="suite-toolbar">
                <button type="button" className="primary-button" onClick={sendToHttp}>Open in HTTP Tools</button>
                <CopyButton value={parsed.value.href} />
              </div>
            </>
          ) : null}
          <ToolStatus error={parsed.ok ? undefined : parsed.error}>URL解析は Web API の URL で実行しています</ToolStatus>
        </>
      )}
      {tab === "query" && (
        <>
          <PairEditor pairs={pairs} onChange={setPairs} />
          <div className="suite-editor output-editor">
            <header><span>QUERY STRING</span><CopyButton value={queryOutput} /></header>
            <textarea readOnly value={queryOutput} />
          </div>
          <ToolStatus>標準の URLSearchParams で生成しています</ToolStatus>
        </>
      )}
      {tab === "build" && (
        <>
          <div className="number-controls">
            <label className="control-label">Protocol<input value={protocol} onChange={(event) => setProtocol(event.target.value)} /></label>
            <label className="control-label grow">Host<input value={hostname} onChange={(event) => setHostname(event.target.value)} /></label>
            <label className="control-label">Port<input value={port} onChange={(event) => setPort(event.target.value)} /></label>
            <label className="control-label grow">Path<input value={pathname} onChange={(event) => setPathname(event.target.value)} /></label>
            <label className="control-label grow">Fragment<input value={fragment} onChange={(event) => setFragment(event.target.value)} /></label>
          </div>
          <PairEditor pairs={pairs} onChange={setPairs} />
          <div className="suite-editor output-editor">
            <header><span>URL</span><CopyButton value={built.url} /></header>
            <textarea readOnly value={built.url} />
          </div>
          <ToolStatus error={built.error}>部品から URL を組み立てます</ToolStatus>
        </>
      )}
      {(tab === "encode" || tab === "decode") && (
        <TextWorkspace
          input={codecInput}
          output={codec.output}
          onInput={setCodecInput}
          error={codec.error}
          inputLabel={tab === "encode" ? "RAW" : "ENCODED"}
          outputLabel={tab === "encode" ? "ENCODED" : "DECODED"}
        />
      )}
    </ToolShell>
  );
}

function PairEditor({
  pairs,
  onChange,
}: {
  pairs: Array<{ key: string; value: string }>;
  onChange: (pairs: Array<{ key: string; value: string }>) => void;
}) {
  return (
    <div className="pair-editor">
      {pairs.map((pair, index) => (
        <div key={index}>
          <input
            value={pair.key}
            placeholder="key"
            onChange={(event) => onChange(pairs.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))}
          />
          <input
            value={pair.value}
            placeholder="value"
            onChange={(event) => onChange(pairs.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}
          />
          <button type="button" onClick={() => onChange(pairs.filter((_, itemIndex) => itemIndex !== index))}>削除</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...pairs, { key: "", value: "" }])}>行を追加</button>
    </div>
  );
}
