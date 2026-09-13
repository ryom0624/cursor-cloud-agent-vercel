"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GeneratedRequestPanel } from "@/components/generated-request";
import { ToolShell, ToolStatus, TextWorkspace } from "@/components/tool-shell";
import { parseCacheControl } from "@/lib/http/cache-control";
import { parseCurl } from "@/lib/http/curl";
import { inspectAuthorization, parseRawHeaders } from "@/lib/http/headers";
import { verifyHmac, type HmacAlgorithm } from "@/lib/http/hmac";
import {
  emptyHttpRequest,
  type HttpBodyType,
  type HttpPair,
  type HttpRequestModel,
} from "@/lib/http/request-model";
import { setTextHandoff, takeHandoff } from "@/lib/workspace-handoff";

type HttpTab = "curl" | "builder" | "headers" | "cache" | "auth" | "signature";

const curlSample = `curl 'https://example.com:8443/api/users?page=2' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token' \\
  --data-raw '{"name":"DevSmith"}'`;

const headerSample = `Content-Type: application/json; charset=utf-8
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXZzbWl0aC11c2VyIiwibmFtZSI6IkRldiBTbWl0aCIsImlhdCI6MTc4OTEwMDAwMCwiZXhwIjoxODIwNjM2MDAwfQ.signature
Cache-Control: public, max-age=3600, stale-while-revalidate=60
Cookie: session=abc; theme=paper`;

function PairFields({
  pairs,
  onChange,
  keyLabel = "Key",
}: {
  pairs: HttpPair[];
  onChange: (pairs: HttpPair[]) => void;
  keyLabel?: string;
}) {
  return (
    <div className="pair-editor">
      {pairs.map((pair, index) => (
        <div key={index}>
          <input
            value={pair.key}
            placeholder={keyLabel}
            onChange={(event) => onChange(pairs.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))}
          />
          <input
            value={pair.value}
            placeholder="Value"
            onChange={(event) => onChange(pairs.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}
          />
          <button type="button" onClick={() => onChange(pairs.filter((_, itemIndex) => itemIndex !== index))}>削除</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...pairs, { key: "", value: "" }])}>行を追加</button>
    </div>
  );
}

export function HttpSuite() {
  const router = useRouter();
  const [tab, setTab] = useState<HttpTab>("curl");
  const [curl, setCurl] = useState(curlSample);
  const [model, setModel] = useState<HttpRequestModel>(emptyHttpRequest());
  const [headersInput, setHeadersInput] = useState(headerSample);
  const [cacheInput, setCacheInput] = useState("public, max-age=3600, stale-while-revalidate=60");
  const [authInput, setAuthInput] = useState("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXZzbWl0aC11c2VyIiwibmFtZSI6IkRldiBTbWl0aCIsImlhdCI6MTc4OTEwMDAwMCwiZXhwIjoxODIwNjM2MDAwfQ.signature");
  const [hmacAlgo, setHmacAlgo] = useState<HmacAlgorithm>("SHA-256");
  const [hmacSecret, setHmacSecret] = useState("");
  const [hmacPayload, setHmacPayload] = useState('{"event":"ping"}');
  const [hmacExpected, setHmacExpected] = useState("");
  const [hmacResult, setHmacResult] = useState<{ valid?: boolean; hex?: string; error?: string }>({});

  useEffect(() => {
    const handed = takeHandoff<HttpRequestModel>("devsmith:handoff:http-request");
    const handedTab = takeHandoff<HttpTab>("devsmith:handoff:http-tab");
    if (!handed && !handedTab) return;
    const timer = window.setTimeout(() => {
      if (handed) {
        setModel(handed);
        setTab(handedTab === "builder" || !handedTab ? "builder" : handedTab);
      } else if (handedTab) {
        setTab(handedTab);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const parsedCurl = useMemo(() => parseCurl(curl), [curl]);
  const parsedHeaders = useMemo(() => parseRawHeaders(headersInput), [headersInput]);
  const parsedCache = useMemo(() => parseCacheControl(cacheInput), [cacheInput]);
  const parsedAuth = useMemo(() => {
    try {
      return { ok: true as const, value: inspectAuthorization(authInput) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Authorizationを解析できません。" };
    }
  }, [authInput]);

  const sendJwt = (token: string) => {
    setTextHandoff("devsmith:handoff:jwt", token);
    router.push("/tools/jwt");
  };

  const runHmac = async () => {
    const result = await verifyHmac({
      algorithm: hmacAlgo,
      secret: hmacSecret,
      payload: hmacPayload,
      expected: hmacExpected,
    });
    setHmacResult(result);
  };

  return (
    <ToolShell
      slug="http"
      category="ネットワーク"
      title="HTTP Tools"
      description="cURLの変換、Request生成、Header解析、Webhook署名をブラウザ内で行います。実リクエストは送りません。"
      functionCount={6}
      tabs={[
        { id: "curl", label: "cURL" },
        { id: "builder", label: "Builder" },
        { id: "headers", label: "Headers" },
        { id: "cache", label: "Cache-Control" },
        { id: "auth", label: "Auth" },
        { id: "signature", label: "Signature" },
      ]}
      activeTab={tab}
      onTabChange={(value) => setTab(value as HttpTab)}
    >
      {tab === "curl" && (
        <div className="split-workspace">
          <TextWorkspace
            input={curl}
            output={parsedCurl.ok ? JSON.stringify(parsedCurl.request, null, 2) : ""}
            onInput={setCurl}
            error={parsedCurl.ok ? undefined : parsedCurl.error}
            inputLabel="cURL"
            outputLabel="REQUEST MODEL"
          />
          {parsedCurl.ok && (
            <>
              <button type="button" className="primary-button" onClick={() => { setModel(parsedCurl.request); setTab("builder"); }}>
                Open in Request Builder
              </button>
              <GeneratedRequestPanel model={parsedCurl.request} />
            </>
          )}
        </div>
      )}

      {tab === "builder" && (
        <div className="split-workspace">
          <div className="http-builder">
            <div className="number-controls">
              <label className="control-label">
                Method
                <select value={model.method} onChange={(event) => setModel({ ...model, method: event.target.value })}>
                  {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
              </label>
              <label className="control-label grow">
                URL
                <input value={model.url} onChange={(event) => setModel({ ...model, url: event.target.value })} />
              </label>
            </div>
            <h3>Query Parameters</h3>
            <PairFields pairs={model.query} onChange={(query) => setModel({ ...model, query })} />
            <h3>Headers</h3>
            <PairFields pairs={model.headers} onChange={(headers) => setModel({ ...model, headers })} />
            <h3>Body</h3>
            <div className="segmented-control">
              {(["json", "form", "raw", "none"] as HttpBodyType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={model.bodyType === type ? "active" : ""}
                  onClick={() => setModel({ ...model, bodyType: type })}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
            {model.bodyType !== "none" && (
              <textarea value={model.body} onChange={(event) => setModel({ ...model, body: event.target.value })} spellCheck={false} />
            )}
          </div>
          <GeneratedRequestPanel model={model} />
        </div>
      )}

      {tab === "headers" && (
        <>
          <textarea className="raw-input" value={headersInput} onChange={(event) => setHeadersInput(event.target.value)} spellCheck={false} />
          {parsedHeaders.ok ? (
            <>
              <div className="pair-table">
                {parsedHeaders.headers.map((header, index) => (
                  <div key={`${header.key}-${index}`}>
                    <strong>{header.key}</strong>
                    <span>{header.value}</span>
                  </div>
                ))}
              </div>
              {parsedHeaders.contentType && (
                <p>Content-Type: {parsedHeaders.contentType.mediaType} {parsedHeaders.contentType.charset ? `charset=${parsedHeaders.contentType.charset}` : ""}</p>
              )}
              {parsedHeaders.cookies.length > 0 && (
                <p>Cookie: {parsedHeaders.cookies.map((item) => `${item.name}=${item.value}`).join(" · ")}</p>
              )}
              {parsedHeaders.authorization?.isJwt && parsedHeaders.authorization.token && (
                <button type="button" className="primary-button" onClick={() => sendJwt(parsedHeaders.authorization!.token)}>
                  JWT Decoderで開く
                </button>
              )}
            </>
          ) : null}
          <ToolStatus error={parsedHeaders.ok ? undefined : parsedHeaders.error}>Headerはブラウザ内で分解します</ToolStatus>
        </>
      )}

      {tab === "cache" && (
        <>
          <label className="control-label grow">
            Cache-Control
            <input value={cacheInput} onChange={(event) => setCacheInput(event.target.value)} />
          </label>
          {parsedCache.ok ? (
            <div className="kv-grid">
              {parsedCache.directives.map((item) => (
                <div key={item.name}>
                  <span>{item.name}{item.value ? ` = ${item.value}` : ""}</span>
                  <strong>{item.human || item.description}</strong>
                  {item.human && <small>{item.description}</small>}
                </div>
              ))}
            </div>
          ) : null}
          <ToolStatus error={parsedCache.ok ? undefined : parsedCache.error}>人間が読める Cache-Control に分解します</ToolStatus>
        </>
      )}

      {tab === "auth" && (
        <>
          <label className="control-label grow">
            Authorization
            <input value={authInput} onChange={(event) => setAuthInput(event.target.value)} />
          </label>
          {parsedAuth.ok && (
            <div className="kv-grid">
              <div><span>Scheme</span><strong>{parsedAuth.value.scheme}</strong></div>
              <div><span>JWT</span><strong>{parsedAuth.value.isJwt ? "Yes" : "No"}</strong></div>
              {parsedAuth.value.basicUser !== undefined && (
                <div><span>User</span><strong>{parsedAuth.value.basicUser}</strong></div>
              )}
            </div>
          )}
          {parsedAuth.ok && parsedAuth.value.jwtPayload && (
            <pre className="code-block">{JSON.stringify({ header: parsedAuth.value.jwtHeader, payload: parsedAuth.value.jwtPayload }, null, 2)}</pre>
          )}
          {parsedAuth.ok && parsedAuth.value.isJwt && (
            <button type="button" className="primary-button" onClick={() => sendJwt(parsedAuth.value.token)}>
              JWT Decoderで開く
            </button>
          )}
          <ToolStatus>Authorization の中身は保存しません</ToolStatus>
        </>
      )}

      {tab === "signature" && (
        <>
          <div className="number-controls">
            <label className="control-label">
              Algorithm
              <select value={hmacAlgo} onChange={(event) => setHmacAlgo(event.target.value as HmacAlgorithm)}>
                <option>SHA-256</option>
                <option>SHA-1</option>
                <option>SHA-512</option>
              </select>
            </label>
            <label className="control-label grow">
              Secret
              <input
                type="password"
                autoComplete="off"
                value={hmacSecret}
                onChange={(event) => setHmacSecret(event.target.value)}
                placeholder="保存しません"
              />
            </label>
          </div>
          <label className="control-label grow">Expected Signature<input value={hmacExpected} onChange={(event) => setHmacExpected(event.target.value)} /></label>
          <textarea className="raw-input" value={hmacPayload} onChange={(event) => setHmacPayload(event.target.value)} spellCheck={false} />
          <button type="button" className="primary-button" onClick={() => void runHmac()}>Verify</button>
          {hmacResult.valid !== undefined && (
            <div className={`sql-verdict ${hmacResult.valid ? "ok" : "ng"}`}>
              {hmacResult.valid ? "VALID" : hmacResult.error || "INVALID"}
            </div>
          )}
          {hmacResult.hex && <p>Computed HMAC: {hmacResult.hex}</p>}
          <ToolStatus>Webhook Secret と Payload は保存しません。Web Crypto API で計算します。</ToolStatus>
        </>
      )}
    </ToolShell>
  );
}
