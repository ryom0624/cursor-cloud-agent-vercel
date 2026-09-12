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

export const categories = [
  { name: "すべて", count: 14 },
  { name: "データ", count: 3 },
  { name: "エンコード", count: 3 },
  { name: "テキスト", count: 4 },
  { name: "日時", count: 2 },
  { name: "生成", count: 2 },
];

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
    description: "CSVの閲覧、絞り込み、編集、ダウンロード",
    category: "データ",
    functions: 1,
    href: "/tools/csv-viewer",
    accent: "苔",
    index: "03",
  },
  {
    name: "Encoder / Decoder",
    description: "Base64、URL、HTML Entity",
    category: "エンコード",
    functions: 3,
    href: "/tools/encoder",
    accent: "苔",
    index: "04",
    featured: true,
  },
  {
    name: "JWT Decoder",
    description: "トークンの構造と有効期限を確認",
    category: "エンコード",
    functions: 1,
    href: "/tools/jwt",
    accent: "藤",
    index: "05",
  },
  {
    name: "Hash Tools",
    description: "SHAハッシュとHMACを生成",
    category: "エンコード",
    functions: 2,
    href: "/tools/hash",
    accent: "墨",
    index: "06",
  },
  {
    name: "ID Generator",
    description: "UUIDとULIDをまとめて生成",
    category: "生成",
    functions: 2,
    href: "/tools/id-generator",
    accent: "藍",
    index: "07",
    featured: true,
  },
  {
    name: "Password Generator",
    description: "安全なランダムパスワード",
    category: "生成",
    functions: 1,
    href: "/tools/password",
    accent: "朱",
    index: "08",
  },
  {
    name: "Regex Tester",
    description: "一致箇所とキャプチャを即時確認",
    category: "テキスト",
    functions: 1,
    href: "/tools/regex",
    accent: "苔",
    index: "09",
    featured: true,
  },
  {
    name: "Text Diff",
    description: "2つのテキストを行単位で比較",
    category: "テキスト",
    functions: 1,
    href: "/tools/diff",
    accent: "藤",
    index: "10",
  },
  {
    name: "Text Tools",
    description: "文字数カウントとCase変換",
    category: "テキスト",
    functions: 2,
    href: "/tools/text",
    accent: "墨",
    index: "11",
  },
  {
    name: "Lorem Ipsum",
    description: "用途に合わせたダミー文章",
    category: "テキスト",
    functions: 1,
    href: "/tools/lorem",
    accent: "藍",
    index: "12",
  },
  {
    name: "Date & Time",
    description: "Unix時間とタイムゾーンを変換",
    category: "日時",
    functions: 2,
    href: "/tools/date-time",
    accent: "朱",
    index: "13",
    featured: true,
  },
  {
    name: "Cron Tools",
    description: "Cron式の作成と実行日時を確認",
    category: "日時",
    functions: 2,
    href: "/tools/cron",
    accent: "苔",
    index: "14",
  },
];
