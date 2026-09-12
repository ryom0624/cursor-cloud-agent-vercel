"use client";

import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BoundedNumberInput } from "@/components/bounded-number-input";
import { CopyButton } from "@/components/copy-button";
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
const readableLower = "abcdefghijkmnpqrstuvwxyz";
const readableUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const urlSafeSymbols = "-._~";
const passwordStorageKey = "devsmith-password-settings";
const legacyPasswordStorageKey = "devsmith-password-history";
const passwordStorageEvent = "devsmith-password-settings-change";
const defaultPasswordSettings = { length: 24, count: 5 };

type PasswordOptions = {
  lower: boolean;
  upper: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  avoidRepeats: boolean;
  startsWithLetter: boolean;
};

type PasswordPreset =
  | "alphanumeric"
  | "readable"
  | "pin"
  | "hex"
  | "url-safe"
  | "custom";

type PasswordSettings = {
  length: number;
  count: number;
};

const passwordPresets: Array<{
  id: PasswordPreset;
  label: string;
  detail: string;
}> = [
  { id: "custom", label: "カスタム", detail: "文字種・条件を選択" },
  { id: "alphanumeric", label: "英数字", detail: "記号なし" },
  { id: "readable", label: "読み間違い防止", detail: "Il1O0oを除外" },
  { id: "pin", label: "PIN", detail: "数字のみ" },
  { id: "hex", label: "Hex", detail: "0–9 / a–f" },
  { id: "url-safe", label: "URL-safe", detail: "英数字・-._~" },
];

function passwordGroups(preset: PasswordPreset, options: PasswordOptions) {
  if (preset === "pin") return [numbers];
  if (preset === "hex") return ["abcdef", numbers];
  if (preset === "readable") return [readableLower, readableUpper, "23456789"];
  if (preset === "alphanumeric") return [lower, upper, numbers];
  if (preset === "url-safe") return [lower, upper, numbers, urlSafeSymbols];
  const removeAmbiguous = (characters: string) =>
    options.excludeAmbiguous ? characters.replace(/[Il1O0o]/g, "") : characters;
  return [
    options.lower ? removeAmbiguous(lower) : "",
    options.upper ? removeAmbiguous(upper) : "",
    options.numbers ? removeAmbiguous(numbers) : "",
    options.symbols ? symbols : "",
  ].filter(Boolean);
}

function securePassword(
  length: number,
  preset: PasswordPreset,
  options: PasswordOptions,
): string {
  const groups = passwordGroups(preset, options);
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
  if (preset === "custom" && options.avoidRepeats && charset.length > 1) {
    for (let index = 1; index < output.length; index += 1) {
      if (output[index] === output[index - 1]) {
        const replacementIndex = (random[index] + 1) % charset.length;
        output[index] = charset[replacementIndex] === output[index - 1]
          ? charset[(replacementIndex + 1) % charset.length]
          : charset[replacementIndex];
      }
    }
  }
  if (
    preset === "custom"
    && options.startsWithLetter
    && output.length
    && !/[A-Za-z]/.test(output[0])
  ) {
    const letterIndex = output.findIndex((character) => /[A-Za-z]/.test(character));
    if (letterIndex >= 0) [output[0], output[letterIndex]] = [output[letterIndex], output[0]];
  }
  return output.join("");
}

function subscribePasswordSettings(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === passwordStorageKey) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(passwordStorageEvent, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(passwordStorageEvent, callback);
  };
}

function passwordSettingsSnapshot() {
  return window.localStorage.getItem(passwordStorageKey) ?? "";
}

function savePasswordSettings(settings: PasswordSettings) {
  window.localStorage.setItem(passwordStorageKey, JSON.stringify(settings));
  window.dispatchEvent(new Event(passwordStorageEvent));
}

export function PasswordSuite() {
  const [preset, setPreset] = useState<PasswordPreset>("custom");
  const [options, setOptions] = useState<PasswordOptions>({
    lower: true,
    upper: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
    avoidRepeats: false,
    startsWithLetter: false,
  });
  const [passwords, setPasswords] = useState<string[]>([]);
  const storedSettings = useSyncExternalStore(
    subscribePasswordSettings,
    passwordSettingsSnapshot,
    () => "",
  );
  const settings = useMemo<PasswordSettings>(() => {
    if (!storedSettings) return defaultPasswordSettings;
    try {
      const parsed = JSON.parse(storedSettings) as Partial<PasswordSettings>;
      return {
        length: Math.max(8, Math.min(4096, Number(parsed.length) || 24)),
        count: Math.max(1, Math.min(100, Number(parsed.count) || 5)),
      };
    } catch {
      return defaultPasswordSettings;
    }
  }, [storedSettings]);
  const { length, count } = settings;

  useEffect(() => {
    const legacy = window.localStorage.getItem(legacyPasswordStorageKey);
    if (!legacy) return;
    if (!window.localStorage.getItem(passwordStorageKey)) {
      try {
        const parsed = JSON.parse(legacy) as Partial<PasswordSettings>;
        savePasswordSettings({
          length: Math.max(8, Math.min(4096, Number(parsed.length) || 24)),
          count: Math.max(1, Math.min(100, Number(parsed.count) || 5)),
        });
      } catch {
        savePasswordSettings(defaultPasswordSettings);
      }
    }
    window.localStorage.removeItem(legacyPasswordStorageKey);
  }, []);

  const hasCharset = preset !== "custom"
    || options.lower
    || options.upper
    || options.numbers
    || options.symbols;

  const generate = () => {
    setPasswords(Array.from(
      { length: count },
      () => securePassword(length, preset, options),
    ));
  };

  return (
    <ToolShell
      slug="password"
      category="生成"
      title="Password Generator"
      description="Web Crypto APIを使って、推測されにくいパスワードを生成します。"
      functionCount={1}
    >
      <div className="password-presets" aria-label="生成パターン">
        {passwordPresets.map((item) => (
          <button
            type="button"
            key={item.id}
            className={preset === item.id ? "active" : ""}
            onClick={() => setPreset(item.id)}
          >
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>
      <div className="settings-grid">
        <div className="password-basic-settings">
          <label className="password-number-control">
            <span>生成文字列の長さ</span>
            <BoundedNumberInput
              key={`password-length-${length}`}
              id="password-length"
              min={8}
              max={4096}
              value={length}
              onCommit={(nextLength) =>
                savePasswordSettings({
                  ...settings,
                  length: nextLength,
                })
              }
            />
            <small>8〜4,096文字。長さを優先すると強度を高めやすくなります。</small>
          </label>
          <label className="password-number-control">
            <span>生成する個数</span>
            <BoundedNumberInput
              key={`password-count-${count}`}
              id="password-count"
              min={1}
              max={100}
              value={count}
              onCommit={(nextCount) =>
                savePasswordSettings({
                  ...settings,
                  count: nextCount,
                })
              }
            />
            <small>一度に最大100個</small>
          </label>
        </div>
        <div className={`check-controls ${preset !== "custom" ? "preset-locked" : ""}`}>
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
                disabled={preset !== "custom"}
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
          {[
            ["avoidRepeats", "連続重複を避ける", "aa等を抑制"],
            ["excludeAmbiguous", "読み間違い文字を除外", "Il1O0oを除外"],
            ["startsWithLetter", "先頭を英字にする", "対応サービス向け"],
          ].map(([key, label, detail]) => (
            <label key={key}>
              <input
                id={`password-option-${key}`}
                name={`password-option-${key}`}
                type="checkbox"
                checked={options[key as keyof PasswordOptions]}
                disabled={preset !== "custom"}
                onChange={(event) =>
                  setOptions((current) => ({ ...current, [key]: event.target.checked }))
                }
              />
              <span>{label}</span>
              <small>{detail}</small>
            </label>
          ))}
        </div>
      </div>
      <button type="button" className="primary-button large-action" onClick={generate} disabled={!hasCharset}>
        <RefreshCw size={15} aria-hidden="true" />
        {count}個のパスワードを生成
      </button>
      <div className="password-list">
        <header>
          <span>GENERATED PASSWORDS</span>
          <div>
            <CopyButton value={passwords.join(", ")} label="すべてコピー" />
          </div>
        </header>
        {passwords.length ? (
          <div className="password-grid">
            {passwords.map((password, index) => (
              <div className="password-cell" key={`${password}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <CopyButton
                  value={password}
                  iconOnly
                  label={`${index + 1}件目のパスワードをコピー`}
                />
                <code>{password}</code>
              </div>
            ))}
          </div>
        ) : (
          <p>条件を選び、「生成」ボタンを押してください。</p>
        )}
      </div>
      <ToolStatus error={hasCharset ? "" : "少なくとも1種類の文字を選択してください"}>
        {passwords.length
          ? `${passwords.length}個・各${length}文字。生成結果は保存されません`
          : "長さと個数だけをこの端末に保存します"}
      </ToolStatus>
    </ToolShell>
  );
}

type LoremLanguage = "ja" | "en";
type LoremStyle = "technical" | "novel" | "business" | "casual";

type LoremPattern = {
  subjects: string[];
  actions: string[];
  endings: string[];
  details: string[];
};

const loremPatterns: Record<LoremLanguage, Record<LoremStyle, LoremPattern>> = {
  ja: {
    technical: {
      subjects: ["小さな開発チームは", "新しい解析基盤は", "堅牢なAPIは", "静かな自動化処理は", "改善された作業環境は"],
      actions: ["複雑な入力を段階的に整理し", "失敗の原因を記録しながら検証を続け", "必要なデータだけを安全に変換し", "利用者の操作を妨げずに結果を返し", "日々の反復作業を正確に処理し"],
      endings: ["次の判断に必要な情報を明確に示します", "保守しやすい仕組みを少しずつ育てます", "予測可能な動作を長く維持します", "開発者が本来の仕事へ集中できる状態を作ります"],
      details: ["境界値も丁寧に確認します", "処理の過程は追跡可能です", "不要な通信は発生しません", "結果は再利用しやすい形式です", "変更範囲を小さく保ちます", "読み手に伝わる名前を選びます"],
    },
    novel: {
      subjects: ["夜明け前の旅人は", "古い駅舎で待つ少女は", "雨上がりの猫は", "海辺に暮らす時計職人は", "森を抜けた手紙は"],
      actions: ["遠い街の灯りを静かに見つめ", "忘れていた約束の続きを思い出し", "濡れた石畳に残る足音を追い", "誰にも届かなかった声へ耳を澄まし", "季節の境目に隠れた道を選び"],
      endings: ["まだ名前のない朝へ歩き始めました", "小さな秘密を胸にしまいました", "風が変わる瞬間を待つことにしました", "昨日とは違う景色を見つけました"],
      details: ["窓の外では雲がゆっくり流れていました", "遠くで一度だけ鐘が鳴りました", "掌には淡い温度が残っていました", "言葉にしない答えがそこにありました", "影は静かに長く伸びていました", "物語は誰にも気づかれず続いていました"],
    },
    business: {
      subjects: ["プロジェクト担当者は", "運用チームは", "企画部門は", "顧客支援チームは", "品質管理グループは"],
      actions: ["主要な指標を関係者と共有し", "優先順位と期限をあらためて整理し", "利用状況から改善機会を抽出し", "リスクと対応方針を簡潔にまとめ", "次回リリースの判断材料を確認し"],
      endings: ["合意した次のアクションへ進みます", "継続的な成果につながる運用を整えます", "意思決定の速度と透明性を高めます", "顧客に届く価値を着実に増やします"],
      details: ["担当者と期限は明確にします", "判断の根拠を文書に残します", "重要な変更は事前に共有します", "成果は定量と定性の両面で確認します", "未解決事項は次回まで追跡します", "関係者の認識差を早めに解消します"],
    },
    casual: {
      subjects: ["休日の朝は", "近所の小さな店では", "いつもの帰り道で", "友人との短い会話は", "机の上のメモは"],
      actions: ["温かい飲み物をゆっくり味わい", "気になっていた音楽を流しながら過ごし", "少し遠回りして季節の変化を探し", "思いついたことを気軽に書き留め", "予定を詰め込まず気分に任せ"],
      endings: ["ささやかな発見を楽しませてくれます", "忙しい一日に余白を作ってくれます", "次に試したいことを自然に思いつかせます", "何でもない時間を心地よく変えます"],
      details: ["窓から柔らかな光が差し込みます", "香ばしい匂いが通りに広がります", "急がなくても一日はきちんと進みます", "小さな選択が気分を変えてくれます", "新しい習慣はそこから始まります", "今日の出来事を誰かに話したくなります"],
    },
  },
  en: {
    technical: {
      subjects: ["The compact engineering team", "A resilient API", "The new analytics pipeline", "A quiet automation worker", "The improved developer workspace"],
      actions: ["organizes complex input in deliberate stages", "validates each boundary while recording failures", "transforms only the data required by the task", "returns predictable results without interrupting the user", "handles repetitive work with consistent precision"],
      endings: ["and makes the next decision easier to explain", "while keeping the system straightforward to maintain", "so developers can focus on the work that matters", "and preserves behavior that teams can rely on"],
      details: ["Boundary cases remain visible", "Every change is easy to trace", "No unnecessary request leaves the browser", "The result uses a reusable format", "Names stay clear for future readers", "The implementation keeps a narrow scope"],
    },
    novel: {
      subjects: ["The traveler before dawn", "A girl waiting in the old station", "The cat after the rain", "A clockmaker beside the sea", "The letter that crossed the forest"],
      actions: ["watched the distant city lights in silence", "remembered the unfinished part of an old promise", "followed the footsteps left on the wet stones", "listened for a voice that had never arrived", "chose the hidden path between two seasons"],
      endings: ["and began walking toward an unnamed morning", "before placing the small secret close to heart", "while waiting for the wind to change", "and discovered a view unlike yesterday"],
      details: ["Clouds moved slowly beyond the window", "A bell sounded once in the distance", "A faint warmth remained in an open hand", "The answer needed no spoken words", "Shadows stretched quietly across the road", "The story continued without asking permission"],
    },
    business: {
      subjects: ["The project owner", "The operations team", "The planning group", "The customer success team", "The quality review board"],
      actions: ["shared the primary metrics with every stakeholder", "reordered priorities and confirmed each deadline", "identified improvement opportunities from recent usage", "summarized the risks and proposed responses", "reviewed the evidence for the next release"],
      endings: ["and moved forward with an agreed action plan", "while building a process that supports steady outcomes", "to improve the speed and clarity of decisions", "and increased the value delivered to customers"],
      details: ["Each task has an owner and deadline", "The rationale remains in the written record", "Important changes are announced in advance", "Results include quantitative and qualitative evidence", "Open questions stay visible until resolved", "Early alignment prevents expensive rework"],
    },
    casual: {
      subjects: ["A quiet weekend morning", "The little shop around the corner", "The familiar walk home", "A short conversation with a friend", "The note left on the desk"],
      actions: ["made room for a warm drink and an unhurried thought", "played a song that had been waiting all week", "took a longer route to notice the changing season", "captured a new idea before it disappeared", "left the schedule open for a welcome surprise"],
      endings: ["and turned a small discovery into the best part of the day", "while giving a busy afternoon some breathing room", "and suggested something new to try tomorrow", "so an ordinary moment became unexpectedly pleasant"],
      details: ["Soft light crossed the window", "A warm scent drifted into the street", "The day moved forward without being rushed", "One small choice changed the entire mood", "A new habit started without ceremony", "The moment felt worth sharing with someone"],
    },
  },
};

function createLoremSentence(
  language: LoremLanguage,
  style: LoremStyle,
  index: number,
  targetLength: number,
) {
  const pattern = loremPatterns[language][style];
  const subject = pattern.subjects[index % pattern.subjects.length];
  const action = pattern.actions[Math.floor(index / 5) % pattern.actions.length];
  const ending = pattern.endings[Math.floor(index / 25) % pattern.endings.length];
  const punctuation = language === "ja" ? "。" : ".";
  const separator = language === "ja" ? "、" : ", ";
  let sentence = `${subject}${language === "ja" ? "" : " "}${action}${separator}${ending}`;
  let detailIndex = index;
  while (sentence.length < targetLength - 1) {
    const detail = pattern.details[detailIndex % pattern.details.length];
    sentence += `${punctuation}${language === "ja" ? "" : " "}${detail}`;
    detailIndex += 1;
  }
  return `${sentence}${punctuation}`;
}

export function LoremSuite() {
  const [count, setCount] = useState(3);
  const [unit, setUnit] = useState<"paragraph" | "sentence" | "line">("paragraph");
  const [language, setLanguage] = useState<LoremLanguage>("ja");
  const [style, setStyle] = useState<LoremStyle>("technical");
  const [targetLength, setTargetLength] = useState(80);
  const output = useMemo(() => {
    const sentences = Array.from(
      { length: count },
      (_, index) => createLoremSentence(language, style, index, targetLength),
    );
    return sentences.join(unit === "paragraph" ? "\n\n" : unit === "line" ? "\n" : language === "ja" ? "" : " ");
  }, [count, language, style, targetLength, unit]);

  return (
    <ToolShell
      slug="lorem"
      category="テキスト"
      title="Lorem Ipsum"
      description="重複しない日本語・英語のダミーテキストを、最大100件まで生成します。"
      functionCount={1}
    >
      <div className="generator-controls lorem-controls">
        <label className="control-label">
          言語
          <select value={language} onChange={(event) => setLanguage(event.target.value as LoremLanguage)}>
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="control-label">
          文体
          <select value={style} onChange={(event) => setStyle(event.target.value as LoremStyle)}>
            <option value="technical">技術・プロダクト</option>
            <option value="novel">小説・情景</option>
            <option value="business">ビジネス</option>
            <option value="casual">日常・カジュアル</option>
          </select>
        </label>
        <label className="control-label">
          単位
          <select value={unit} onChange={(event) => setUnit(event.target.value as typeof unit)}>
            <option value="paragraph">段落</option>
            <option value="sentence">文</option>
            <option value="line">行</option>
          </select>
        </label>
        <label className="control-label">
          生成数（最大100）
          <BoundedNumberInput
            key={`lorem-count-${count}`}
            min={1}
            max={100}
            value={count}
            onCommit={setCount}
            ariaLabel="生成数"
          />
        </label>
        <label className="control-label">
          1文の目安
          <BoundedNumberInput
            key={`lorem-length-${targetLength}`}
            min={20}
            max={240}
            value={targetLength}
            onCommit={setTargetLength}
            ariaLabel="1文の目安文字数"
          />
        </label>
        <CopyButton value={output} label="結果をコピー" className="text-button" />
      </div>
      <textarea className="large-text-input" name="lorem-output" value={output} readOnly />
      <ToolStatus>
        {language === "ja" ? "日本語" : "英語"}・{count}{unit === "paragraph" ? "段落" : unit === "sentence" ? "文" : "行"}・各文約{targetLength}文字（最大100件、重複なし）
      </ToolStatus>
    </ToolShell>
  );
}

export function RegexSuite() {
  const [pattern, setPattern] = useState("[A-Z][a-z]+");
  const [flags, setFlags] = useState("g");
  const [input, setInput] = useState("DevSmith helps Alice and Bob inspect text.");
  const regexSamples = [
    { name: "数字", pattern: String.raw`\d+`, flags: "g", input: "注文番号: 2048 / 数量: 12" },
    { name: "日本の電話番号", pattern: String.raw`^(0([1-9]{1}-?[1-9]\d{3}|[1-9]{2}-?\d{3}|[1-9]{2}\d{1}-?\d{2}|[1-9]{2}\d{2}-?\d{1})-?\d{4}|0[789]0-?\d{4}-?\d{4}|050-?\d{4}-?\d{4})$`, flags: "gm", input: "090-1234-5678\n03-1234-5678\n123-456" },
    { name: "メール", pattern: String.raw`[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}`, flags: "g", input: "連絡先: dev@example.com / support@devsmith.io" },
    { name: "URL", pattern: String.raw`https?:\/\/[^\s]+`, flags: "g", input: "Docs: https://devsmith.io/docs?q=json" },
    { name: "IPv4", pattern: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b`, flags: "g", input: "valid 192.168.1.1 / invalid 999.1.1.1" },
    { name: "日付", pattern: String.raw`\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b`, flags: "g", input: "公開日 2026-09-11、更新日 2026-12-01" },
    { name: "UUID", pattern: String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b`, flags: "gi", input: "550e8400-e29b-41d4-a716-446655440000" },
    { name: "HEXカラー", pattern: String.raw`#(?:[0-9a-fA-F]{3}){1,2}\b`, flags: "g", input: "color: #1c211e; accent: #d76a3b;" },
  ];

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
      <div className="regex-samples">
        <div>
          <strong>よく使うサンプル</strong>
          <span>選ぶとパターンとテスト文字列へ反映します</span>
        </div>
        <div>
          {regexSamples.map((sample) => (
            <button
              type="button"
              key={sample.name}
              onClick={() => {
                setPattern(sample.pattern);
                setFlags(sample.flags);
                setInput(sample.input);
              }}
            >
              {sample.name}
            </button>
          ))}
        </div>
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
  const [fullscreen, setFullscreen] = useState(false);
  const differences = useMemo(() => diffLines(before, after), [after, before]);
  const changes = differences.filter((line) => line.type !== "same").length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fullscreen) {
        event.preventDefault();
        setFullscreen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFullscreen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  return (
    <ToolShell
      slug="diff"
      category="テキスト"
      title="Text Diff"
      description="2つのテキストを行単位で比較し、追加・削除を表示します。"
      functionCount={1}
    >
      <div className={`diff-workspace ${fullscreen ? "fullscreen" : ""}`}>
        <div className="diff-fullscreen-bar">
          <span>BEFORE / AFTER</span>
          <button type="button" onClick={() => setFullscreen((current) => !current)}>
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {fullscreen ? "縮小（Esc）" : "全画面（Ctrl/⌘+Shift+F）"}
          </button>
        </div>
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
      </div>
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
