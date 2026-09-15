export type Tool = {
  name: string;
  description: string;
  category: string;
  functions: number;
  href: string;
  accent: string;
  index: string;
  featured?: boolean;
};

export const tools: Tool[] = [
  {
    name: "JSON Tools",
    description: "整形、検証、圧縮、ツリー、Grid表示",
    category: "データ",
    functions: 5,
    href: "/tools/json",
    accent: "朱",
    index: "01",
    featured: true,
  },
  {
    name: "Data Converter",
    description: "JSON、YAML、CSV、JSONL、Queryを変換",
    category: "データ",
    functions: 4,
    href: "/tools/data-converter",
    accent: "藍",
    index: "02",
  },
  {
    name: "CSV Viewer",
    description: "CSVの安全な閲覧、診断、編集、ダウンロード",
    category: "データ",
    functions: 1,
    href: "/tools/csv-viewer",
    accent: "苔",
    index: "03",
  },
  {
    name: "Mermaid Viewer",
    description: "Mermaid記法のプレビュー、拡大縮小、全画面確認",
    category: "データ",
    functions: 1,
    href: "/tools/mermaid",
    accent: "藍",
    index: "04",
  },
  {
    name: "Encoder / Decoder",
    description: "Base64、URL、HTML Entity",
    category: "エンコード",
    functions: 3,
    href: "/tools/encoder",
    accent: "苔",
    index: "05",
    featured: true,
  },
  {
    name: "JWT Decoder",
    description: "トークンの構造と有効期限を確認",
    category: "エンコード",
    functions: 1,
    href: "/tools/jwt",
    accent: "藤",
    index: "06",
  },
  {
    name: "Hash Tools",
    description: "SHAハッシュとHMACを生成",
    category: "エンコード",
    functions: 2,
    href: "/tools/hash",
    accent: "墨",
    index: "07",
  },
  {
    name: "ID Generator",
    description: "UUIDとULIDをまとめて生成",
    category: "生成",
    functions: 2,
    href: "/tools/id-generator",
    accent: "藍",
    index: "08",
    featured: true,
  },
  {
    name: "Password Generator",
    description: "安全なランダムパスワード",
    category: "生成",
    functions: 1,
    href: "/tools/password",
    accent: "朱",
    index: "09",
  },
  {
    name: "Regex Tester",
    description: "一致箇所とキャプチャを即時確認",
    category: "テキスト",
    functions: 1,
    href: "/tools/regex",
    accent: "苔",
    index: "10",
    featured: true,
  },
  {
    name: "Text Diff",
    description: "2つのテキストを行単位で比較",
    category: "テキスト",
    functions: 1,
    href: "/tools/diff",
    accent: "藤",
    index: "11",
  },
  {
    name: "Text Tools",
    description: "文字数カウントとCase変換",
    category: "テキスト",
    functions: 2,
    href: "/tools/text",
    accent: "墨",
    index: "12",
  },
  {
    name: "Lorem Ipsum",
    description: "用途に合わせたダミー文章",
    category: "テキスト",
    functions: 1,
    href: "/tools/lorem",
    accent: "藍",
    index: "13",
  },
  {
    name: "Date & Time",
    description: "Unix時間とタイムゾーンを変換",
    category: "日時",
    functions: 2,
    href: "/tools/date-time",
    accent: "朱",
    index: "14",
    featured: true,
  },
  {
    name: "Cron Tools",
    description: "Cron式の作成と実行日時を確認",
    category: "日時",
    functions: 2,
    href: "/tools/cron",
    accent: "苔",
    index: "15",
  },
  {
    name: "Number Tools",
    description: "基数・単位・式・浮動小数点・割合を計算",
    category: "数値",
    functions: 5,
    href: "/tools/number",
    accent: "藤",
    index: "16",
    featured: true,
  },
  {
    name: "QR Code",
    description: "テキスト、Wi-Fi、連絡先からQRコードを生成",
    category: "生成",
    functions: 3,
    href: "/tools/qr",
    accent: "墨",
    index: "17",
    featured: true,
  },
];

export const toolCount = tools.length;

export const functionCount = tools.reduce(
  (total, tool) => total + tool.functions,
  0,
);

export const categories = [
  { name: "すべて", count: toolCount },
  ...Array.from(new Set(tools.map((tool) => tool.category))).map((name) => ({
    name,
    count: tools.filter((tool) => tool.category === name).length,
  })),
];

export const pasteAnythingStorageKeys = {
  value: "devsmith:paste-anything:value",
  type: "devsmith:paste-anything:type",
} as const;

type PasteAnythingHandoff = {
  type: string;
  value: string;
};

let pasteAnythingHandoffMemory: PasteAnythingHandoff | null | undefined;

export function storePasteAnythingHandoff(value: string, type: string) {
  pasteAnythingHandoffMemory = undefined;
  sessionStorage.setItem(pasteAnythingStorageKeys.value, value);
  sessionStorage.setItem(pasteAnythingStorageKeys.type, type);
}

export function resetPasteAnythingHandoff() {
  pasteAnythingHandoffMemory = undefined;
}

export function readPasteAnythingHandoff(
  expectedTypes: string | readonly string[],
): PasteAnythingHandoff | null {
  if (typeof window === "undefined") return null;
  if (pasteAnythingHandoffMemory === undefined) {
    const type = sessionStorage.getItem(pasteAnythingStorageKeys.type);
    const value = sessionStorage.getItem(pasteAnythingStorageKeys.value);
    sessionStorage.removeItem(pasteAnythingStorageKeys.value);
    sessionStorage.removeItem(pasteAnythingStorageKeys.type);
    pasteAnythingHandoffMemory = type && value !== null ? { type, value } : null;
  }
  const expected = typeof expectedTypes === "string" ? [expectedTypes] : expectedTypes;
  if (!pasteAnythingHandoffMemory || !expected.includes(pasteAnythingHandoffMemory.type)) {
    return null;
  }
  return pasteAnythingHandoffMemory;
}
