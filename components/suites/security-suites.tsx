"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BoundedNumberInput } from "@/components/bounded-number-input";
import { CopyButton } from "@/components/copy-button";
import {
  ToolShell,
  ToolStatus,
  TextWorkspace,
} from "@/components/tool-shell";
import {
  bytesToHex,
  decodeBase64,
  decodeHtml,
  decodeJwtPart,
  encodeBase64,
  encodeHtml,
  generateUlid,
} from "@/lib/tool-utils";

type EncoderMode = "base64" | "url" | "html";

export function EncoderSuite() {
  const [mode, setMode] = useState<EncoderMode>("base64");
  const [decode, setDecode] = useState(false);
  const [input, setInput] = useState("DevSmithで文字列を変換");

  const result = useMemo(() => {
    try {
      const output =
        mode === "base64"
          ? decode
            ? decodeBase64(input)
            : encodeBase64(input)
          : mode === "url"
            ? decode
              ? decodeURIComponent(input)
              : encodeURIComponent(input)
            : decode
              ? decodeHtml(input)
              : encodeHtml(input);
      return { output, error: "" };
    } catch (error) {
      return {
        output: "",
        error:
          error instanceof Error
            ? error.message
            : "入力形式を確認してください。",
      };
    }
  }, [decode, input, mode]);

  const switchMode = (value: string) => {
    setMode(value as EncoderMode);
    setDecode(false);
    setInput(
      value === "html"
        ? `<button type="button">保存 & 終了</button>`
        : value === "url"
          ? "https://devsmith.io/tools?name=JSON Formatter"
          : "DevSmithで文字列を変換",
    );
  };

  return (
    <ToolShell
      slug="encoder"
      category="エンコード"
      title="Encoder / Decoder"
      description="Base64、URL、HTML Entityを安全にエンコード・デコードします。"
      functionCount={3}
      tabs={[
        { id: "base64", label: "Base64" },
        { id: "url", label: "URL" },
        { id: "html", label: "HTML Entity" },
      ]}
      activeTab={mode}
      onTabChange={switchMode}
    >
      <TextWorkspace
        input={input}
        output={result.output}
        onInput={setInput}
        error={result.error}
        toolbar={
          <div className="segmented-control">
            <button
              type="button"
              className={!decode ? "active" : ""}
              onClick={() => setDecode(false)}
            >
              Encode
            </button>
            <button
              type="button"
              className={decode ? "active" : ""}
              onClick={() => setDecode(true)}
            >
              Decode
            </button>
          </div>
        }
      />
    </ToolShell>
  );
}

const jwtSample =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXZzbWl0aC11c2VyIiwibmFtZSI6IkRldiBTbWl0aCIsImlhdCI6MTc4OTEwMDAwMCwiZXhwIjoxODIwNjM2MDAwfQ.signature";

export function JwtSuite() {
  const [input, setInput] = useState(jwtSample);
  const decoded = useMemo(() => {
    try {
      const [header, payload] = input.trim().split(".");
      if (!header || !payload) throw new Error("JWTは3つのセグメントで入力してください。");
      const headerValue = decodeJwtPart(header);
      const payloadValue = decodeJwtPart(payload);
      const expires =
        typeof payloadValue.exp === "number"
          ? new Date(payloadValue.exp * 1000)
          : null;
      return {
        output: JSON.stringify(
          { header: headerValue, payload: payloadValue },
          null,
          2,
        ),
        error: "",
        expires,
      };
    } catch (error) {
      return {
        output: "",
        error:
          error instanceof Error ? error.message : "JWTを解析できませんでした。",
        expires: null,
      };
    }
  }, [input]);

  return (
    <ToolShell
      slug="jwt"
      category="エンコード"
      title="JWT Decoder"
      description="JWTのHeader、Payload、有効期限をローカルで確認します。"
      functionCount={1}
    >
      <TextWorkspace
        input={input}
        output={decoded.output}
        onInput={setInput}
        inputLabel="JWT"
        outputLabel="DECODED PAYLOAD"
        error={decoded.error}
        toolbar={
          <div className="inline-metric">
            <span>SIGNATURE</span>
            <strong>未検証</strong>
            <span>EXPIRES</span>
            <strong>
              {decoded.expires
                ? decoded.expires.toLocaleString("ja-JP")
                : "expなし"}
            </strong>
          </div>
        }
      />
    </ToolShell>
  );
}

type HashMode = "hash" | "hmac";

export function HashSuite() {
  const [mode, setMode] = useState<HashMode>("hash");
  const [algorithm, setAlgorithm] = useState("SHA-256");
  const [secret, setSecret] = useState("devsmith-secret");
  const [input, setInput] = useState("Hash this text with DevSmith");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    const calculate = async () => {
      try {
        const data = new TextEncoder().encode(input);
        let buffer: ArrayBuffer;
        if (mode === "hmac") {
          const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(secret),
            { name: "HMAC", hash: algorithm },
            false,
            ["sign"],
          );
          buffer = await crypto.subtle.sign("HMAC", key, data);
        } else {
          buffer = await crypto.subtle.digest(algorithm, data);
        }
        if (current) {
          setOutput(bytesToHex(buffer));
          setError("");
        }
      } catch (caught) {
        if (current) {
          setError(caught instanceof Error ? caught.message : "生成に失敗しました。");
          setOutput("");
        }
      }
    };
    void calculate();
    return () => {
      current = false;
    };
  }, [algorithm, input, mode, secret]);

  return (
    <ToolShell
      slug="hash"
      category="エンコード"
      title="Hash Tools"
      description="SHAハッシュとHMAC署名をWeb Crypto APIで生成します。"
      functionCount={2}
      tabs={[
        { id: "hash", label: "Hash" },
        { id: "hmac", label: "HMAC" },
      ]}
      activeTab={mode}
      onTabChange={(tab) => setMode(tab as HashMode)}
    >
      <TextWorkspace
        input={input}
        output={output}
        onInput={setInput}
        error={error}
        toolbar={
          <>
            <label className="control-label">
              アルゴリズム
              <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>
                <option>SHA-256</option>
                <option>SHA-384</option>
                <option>SHA-512</option>
                <option>SHA-1</option>
              </select>
            </label>
            {mode === "hmac" && (
              <label className="control-label grow">
                秘密鍵
                <input value={secret} onChange={(event) => setSecret(event.target.value)} />
              </label>
            )}
          </>
        }
      />
    </ToolShell>
  );
}

type IdMode = "uuid" | "ulid";

export function IdGeneratorSuite() {
  const [mode, setMode] = useState<IdMode>("uuid");
  const [count, setCount] = useState(5);
  const [values, setValues] = useState<string[]>([]);

  const generate = (nextMode = mode, nextCount = count) => {
    setValues(
      Array.from({ length: nextCount }, () =>
        nextMode === "uuid" ? crypto.randomUUID() : generateUlid(),
      ),
    );
  };

  const changeMode = (tab: string) => {
    const nextMode = tab as IdMode;
    setMode(nextMode);
    generate(nextMode);
  };

  return (
    <ToolShell
      slug="id-generator"
      category="生成"
      title="ID Generator"
      description="暗号学的に安全なUUID v4と、時系列ソート可能なULIDを生成します。"
      functionCount={2}
      tabs={[
        { id: "uuid", label: "UUID v4" },
        { id: "ulid", label: "ULID" },
      ]}
      activeTab={mode}
      onTabChange={changeMode}
    >
      <div className="generator-controls">
        <label className="control-label">
          生成数
          <BoundedNumberInput
            key={`id-count-${count}`}
            ariaLabel="生成数"
            min={1}
            max={100}
            value={count}
            onCommit={setCount}
          />
        </label>
        <button type="button" className="primary-button" onClick={() => generate()}>
          <RefreshCw size={14} aria-hidden="true" />
          {mode === "uuid" ? "UUID" : "ULID"}を生成
        </button>
        <CopyButton
          value={values.join(", ")}
          label="すべてコピー"
          className="text-button"
        />
      </div>
      <div className="generated-list">
        {values.map((value, index) => (
          <div key={`${value}-${index}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <code>{value}</code>
            <CopyButton value={value} />
          </div>
        ))}
      </div>
      <ToolStatus>
        {values.length ? `${values.length}件を生成しました` : "生成結果は保存されません"}
      </ToolStatus>
    </ToolShell>
  );
}
