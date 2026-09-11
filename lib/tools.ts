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
  { name: "すべて", count: 13 },
  { name: "データ", count: 2 },
  { name: "エンコード", count: 3 },
  { name: "テキスト", count: 4 },
  { name: "日時", count: 2 },
  { name: "生成", count: 2 },
];

export const tools: Tool[] = [
  {
    name: "JSON Tools",
    description: "整形、検証、圧縮、ツリー表示",
    category: "データ",
    functions: 4,
    href: "/tools/json",
    accent: "朱",
    index: "01",
    featured: true,
  },
  {
    name: "Data Converter",
    description: "JSON、YAML、CSVを相互変換",
    category: "データ",
    functions: 2,
    href: "/tools/json?tab=convert",
    accent: "藍",
    index: "02",
  },
  {
    name: "Encoder / Decoder",
    description: "Base64、URL、HTML Entity",
    category: "エンコード",
    functions: 3,
    href: "/tools/json?tab=encode",
    accent: "苔",
    index: "03",
    featured: true,
  },
  {
    name: "JWT Decoder",
    description: "トークンの構造と有効期限を確認",
    category: "エンコード",
    functions: 1,
    href: "/tools/json?tab=jwt",
    accent: "藤",
    index: "04",
  },
  {
    name: "Hash Tools",
    description: "SHAハッシュとHMACを生成",
    category: "エンコード",
    functions: 2,
    href: "/tools/json?tab=hash",
    accent: "墨",
    index: "05",
  },
  {
    name: "ID Generator",
    description: "UUIDとULIDをまとめて生成",
    category: "生成",
    functions: 2,
    href: "/tools/json?tab=id",
    accent: "藍",
    index: "06",
    featured: true,
  },
  {
    name: "Password Generator",
    description: "安全なランダムパスワード",
    category: "生成",
    functions: 1,
    href: "/tools/json?tab=password",
    accent: "朱",
    index: "07",
  },
  {
    name: "Regex Tester",
    description: "一致箇所とキャプチャを即時確認",
    category: "テキスト",
    functions: 1,
    href: "/tools/json?tab=regex",
    accent: "苔",
    index: "08",
    featured: true,
  },
  {
    name: "Text Diff",
    description: "2つのテキストを行単位で比較",
    category: "テキスト",
    functions: 1,
    href: "/tools/json?tab=diff",
    accent: "藤",
    index: "09",
  },
  {
    name: "Text Tools",
    description: "文字数カウントとCase変換",
    category: "テキスト",
    functions: 2,
    href: "/tools/json?tab=text",
    accent: "墨",
    index: "10",
  },
  {
    name: "Lorem Ipsum",
    description: "用途に合わせたダミー文章",
    category: "テキスト",
    functions: 1,
    href: "/tools/json?tab=lorem",
    accent: "藍",
    index: "11",
  },
  {
    name: "Date & Time",
    description: "Unix時間とタイムゾーンを変換",
    category: "日時",
    functions: 2,
    href: "/tools/json?tab=time",
    accent: "朱",
    index: "12",
    featured: true,
  },
  {
    name: "Cron Tools",
    description: "Cron式の作成と実行日時を確認",
    category: "日時",
    functions: 2,
    href: "/tools/json?tab=cron",
    accent: "苔",
    index: "13",
  },
];
