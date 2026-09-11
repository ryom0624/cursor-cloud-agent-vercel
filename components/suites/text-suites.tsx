"use client";

import { useMemo, useState } from "react";
import {
  ToolShell,
  ToolStatus,
  TextWorkspace,
} from "@/components/tool-shell";
import { convertCase, diffLines, type TextCase } from "@/lib/tool-utils";

const lower = "abcdefghijklmnopqrstuvwxyz";
const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const numbers = "0123456789";
const symbols = "!@#$%^&*()-_=+[]{}";

function securePassword(
  length: number,
  enabled: { lower: boolean; upper: boolean; numbers: boolean; symbols: boolean },
): string {
  const groups = [
    enabled.lower ? lower : "",
    enabled.upper ? upper : "",
    enabled.numbers ? numbers : "",
    enabled.symbols ? symbols : "",
  ].filter(Boolean);
  if (!groups.length) return "";
  const charset = groups.join("");
  const random = new Uint32Array(length);
  crypto.getRandomValues(random);
  const output = Array.from(random, (value) => charset[value % charset.length]);
  groups.forEach((group, index) => {
    if (index < output.length) output[index] = group[random[index] % group.length];
  });
  const shuffle = new Uint32Array(length);
  crypto.getRandomValues(shuffle);
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = shuffle[index] % (index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output.join("");
}

export function PasswordSuite() {
  const [length, setLength] = useState(24);
  const [options, setOptions] = useState({
    lower: true,
    upper: true,
    numbers: true,
    symbols: true,
  });
  const [count, setCount] = useState(5);
  const [passwords, setPasswords] = useState<string[]>([]);
  const hasCharset = Object.values(options).some(Boolean);

  const generate = () =>
    setPasswords(
      Array.from({ length: count }, () => securePassword(length, options)),
    );

  return (
    <ToolShell
      slug="password"
      category="生成"
      title="Password Generator"
      description="Web Crypto APIを使って、推測されにくいパスワードを生成します。"
      functionCount={1}
    >
      <div className="settings-grid">
        <div className="password-basic-settings">
          <label className="range-control">
            <span>長さ <strong>{length}</strong></span>
            <input
              id="password-length"
              name="password-length"
              type="range"
              min={8}
              max={128}
              value={length}
              onChange={(event) => setLength(Number(event.target.value))}
            />
          </label>
          <label className="control-label password-count">
            生成する個数
            <input
              id="password-count"
              name="password-count"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(event) =>
                setCount(Math.max(1, Math.min(100, Number(event.target.value))))
              }
            />
          </label>
        </div>
        <div className="check-controls">
          {[
            ["lower", "小文字", "a–z"],
            ["upper", "大文字", "A–Z"],
            ["numbers", "数字", "0–9"],
            ["symbols", "記号", "!@#"],
          ].map(([key, label, detail]) => (
            <label key={key}>
              <input
                id={`password-option-${key}`}
                name={`password-option-${key}`}
                type="checkbox"
                checked={options[key as keyof typeof options]}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              <span>{label}</span>
              <small>{detail}</small>
            </label>
          ))}
        </div>
      </div>
      <button type="button" className="primary-button large-action" onClick={generate} disabled={!hasCharset}>
        {count}個のパスワードを生成
      </button>
      <div className="password-list">
        <header>
          <span>GENERATED PASSWORDS</span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(passwords.join("\n"))}
            disabled={!passwords.length}
          >
            すべてコピー
          </button>
        </header>
        {passwords.length ? (
          passwords.map((password, index) => (
            <div key={`${password}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <code>{password}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(password)}
              >
                コピー
              </button>
            </div>
          ))
        ) : (
          <p>条件を選び、「生成」ボタンを押してください。</p>
        )}
      </div>
      <ToolStatus error={hasCharset ? "" : "少なくとも1種類の文字を選択してください"}>
        {passwords.length
          ? `${passwords.length}個・各${length}文字をブラウザ内で生成済み`
          : "生成結果は保存されません"}
      </ToolStatus>
    </ToolShell>
  );
}

const loremParagraphs = [
  "技術は、複雑な作業を静かに支えるためにあります。良い道具は使う人の手を止めず、必要な結果だけを正確に返します。",
  "DevSmithは、開発の途中で何度も発生する小さな変換や確認を、ひとつの場所で片づけるための作業台です。",
  "入力したデータはブラウザの外へ送られません。登録や設定を済ませる前に、すぐ作業を始められます。",
  "読みやすい表示、予測できる操作、明確なエラー。毎日使うものだからこそ、余計な装飾を加えず丁寧に設計します。",
  "必要な機能を選び、値を入力し、結果をコピーする。それだけで次の仕事へ進めることを大切にしています。",
];

export function LoremSuite() {
  const [count, setCount] = useState(3);
  const [unit, setUnit] = useState<"paragraph" | "sentence">("paragraph");
  const output = useMemo(() => {
    if (unit === "paragraph") {
      return Array.from(
        { length: count },
        (_, index) => loremParagraphs[index % loremParagraphs.length],
      ).join("\n\n");
    }
    return Array.from(
      { length: count },
      (_, index) => loremParagraphs[index % loremParagraphs.length].split("。")[0] + "。",
    ).join("");
  }, [count, unit]);

  return (
    <ToolShell
      slug="lorem"
      category="テキスト"
      title="Lorem Ipsum"
      description="日本語UIに馴染むダミーテキストを必要な量だけ生成します。"
      functionCount={1}
    >
      <div className="generator-controls">
        <label className="control-label">
          単位
          <select value={unit} onChange={(event) => setUnit(event.target.value as typeof unit)}>
            <option value="paragraph">段落</option>
            <option value="sentence">文</option>
          </select>
        </label>
        <label className="control-label">
          生成数
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(event) => setCount(Math.max(1, Math.min(20, Number(event.target.value))))}
          />
        </label>
        <button type="button" className="text-button" onClick={() => navigator.clipboard.writeText(output)}>
          結果をコピー
        </button>
      </div>
      <textarea className="large-text-input" name="lorem-output" value={output} readOnly />
      <ToolStatus>{count}{unit === "paragraph" ? "段落" : "文"}を生成しました</ToolStatus>
    </ToolShell>
  );
}

export function RegexSuite() {
  const [pattern, setPattern] = useState("[A-Z][a-z]+");
  const [flags, setFlags] = useState("g");
  const [input, setInput] = useState("DevSmith helps Alice and Bob inspect text.");

  const result = useMemo(() => {
    try {
      const regex = new RegExp(pattern, flags);
      const matches = Array.from(input.matchAll(regex));
      return {
        matches,
        error: "",
        output: matches.length
          ? matches
              .map(
                (match, index) =>
                  `${String(index + 1).padStart(2, "0")}  "${match[0]}"  index: ${match.index ?? 0}${
                    match.length > 1 ? `  groups: ${match.slice(1).join(", ")}` : ""
                  }`,
              )
              .join("\n")
          : "一致する箇所はありません",
      };
    } catch (error) {
      return {
        matches: [],
        output: "",
        error: error instanceof Error ? error.message : "正規表現が不正です。",
      };
    }
  }, [flags, input, pattern]);

  return (
    <ToolShell
      slug="regex"
      category="テキスト"
      title="Regex Tester"
      description="正規表現の一致箇所、位置、キャプチャグループを即時確認します。"
      functionCount={1}
    >
      <div className="regex-bar">
        <label className="sr-only" htmlFor="regex-pattern">正規表現パターン</label>
        <span>/</span>
        <input id="regex-pattern" value={pattern} onChange={(event) => setPattern(event.target.value)} name="regex-pattern" />
        <span>/</span>
        <label className="sr-only" htmlFor="regex-flags">正規表現フラグ</label>
        <input id="regex-flags" value={flags} onChange={(event) => setFlags(event.target.value)} name="regex-flags" aria-label="正規表現フラグ" />
      </div>
      <TextWorkspace
        input={input}
        output={result.output}
        onInput={setInput}
        inputLabel="TEST STRING"
        outputLabel={`${result.matches.length} MATCHES`}
        error={result.error}
      />
    </ToolShell>
  );
}

export function DiffSuite() {
  const [before, setBefore] = useState("name: DevSmith\nversion: 0.1.0\nstatus: draft");
  const [after, setAfter] = useState("name: DevSmith\nversion: 1.0.0\nstatus: ready");
  const differences = useMemo(() => diffLines(before, after), [after, before]);
  const changes = differences.filter((line) => line.type !== "same").length;

  return (
    <ToolShell
      slug="diff"
      category="テキスト"
      title="Text Diff"
      description="2つのテキストを行単位で比較し、追加・削除を表示します。"
      functionCount={1}
    >
      <div className="diff-inputs">
        <label>
          <span>BEFORE</span>
          <textarea name="diff-before" value={before} onChange={(event) => setBefore(event.target.value)} />
        </label>
        <label>
          <span>AFTER</span>
          <textarea name="diff-after" value={after} onChange={(event) => setAfter(event.target.value)} />
        </label>
      </div>
      <div className="diff-result">
        <header><span>DIFF RESULT</span><small>{changes} CHANGES</small></header>
        <pre>
          {differences.map((line, index) => (
            <span className={line.type} key={`${line.type}-${index}`}>
              <b>{line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}</b>
              {line.value || " "}
            </span>
          ))}
        </pre>
      </div>
      <ToolStatus>{changes}行の変更を検出しました</ToolStatus>
    </ToolShell>
  );
}

type TextMode = "count" | "case";

export function TextSuite() {
  const [mode, setMode] = useState<TextMode>("count");
  const [input, setInput] = useState("DevSmithは、開発者の小さな作業を素早く片づけます。");
  const [targetCase, setTargetCase] = useState<TextCase>("camel");
  const metrics = useMemo(
    () => ({
      characters: input.length,
      noSpaces: input.replace(/\s/g, "").length,
      words: input.trim() ? input.trim().split(/\s+/).length : 0,
      lines: input ? input.split(/\r?\n/).length : 0,
      bytes: new TextEncoder().encode(input).length,
    }),
    [input],
  );

  return (
    <ToolShell
      slug="text"
      category="テキスト"
      title="Text Tools"
      description="文字数の計測と、開発で使うCase形式への変換を行います。"
      functionCount={2}
      tabs={[
        { id: "count", label: "文字数カウント" },
        { id: "case", label: "Case変換" },
      ]}
      activeTab={mode}
      onTabChange={(tab) => setMode(tab as TextMode)}
    >
      {mode === "count" ? (
        <>
          <textarea
            className="large-text-input"
            name="count-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <div className="metric-grid">
            <div><strong>{metrics.characters}</strong><span>文字</span></div>
            <div><strong>{metrics.noSpaces}</strong><span>空白なし</span></div>
            <div><strong>{metrics.words}</strong><span>単語</span></div>
            <div><strong>{metrics.lines}</strong><span>行</span></div>
            <div><strong>{metrics.bytes}</strong><span>Bytes</span></div>
          </div>
          <ToolStatus>入力と同時に再計算されます</ToolStatus>
        </>
      ) : (
        <TextWorkspace
          input={input}
          output={convertCase(input, targetCase)}
          onInput={setInput}
          toolbar={
            <div className="segmented-control wrap">
              {(["camel", "pascal", "snake", "kebab", "upper", "lower"] as TextCase[]).map((item) => (
                <button
                  type="button"
                  className={targetCase === item ? "active" : ""}
                  onClick={() => setTargetCase(item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
          }
        />
      )}
    </ToolShell>
  );
}
