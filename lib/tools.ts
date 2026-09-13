export type ToolAccent = "朱" | "藍" | "苔" | "藤" | "墨";

export type ToolDefinition = {
  slug: string;
  name: string;
  description: string;
  category: string;
  accent: ToolAccent;
  capabilities: readonly string[];
  keywords?: readonly string[];
  featured?: boolean;
  layout?: "wide" | "form";
  listed?: boolean;
};

export type Tool = {
  slug: string;
  name: string;
  description: string;
  category: string;
  functions: number;
  href: string;
  accent: ToolAccent;
  index: string;
  featured?: boolean;
  layout: "wide" | "form";
  listed: boolean;
  capabilities: readonly string[];
  keywords: readonly string[];
  searchText: string;
};

export const hiddenSuiteSlugs = [
  "csv-viewer-beta",
  "csv-viewer-legacy",
  "csv-viewer-legacy2",
] as const;

export type HiddenSuiteSlug = (typeof hiddenSuiteSlugs)[number];

const toolDefinitions = [
  {
    slug: "json",
    name: "JSON Tools",
    description: "整形、検証、圧縮、ツリー、Grid表示",
    category: "データ",
    accent: "朱",
    capabilities: ["整形", "検証", "圧縮", "ツリー", "Grid"],
    keywords: ["json", "formatter", "validate", "minify"],
    featured: true,
    layout: "wide",
  },
  {
    slug: "data-converter",
    name: "Data Converter",
    description: "JSON、YAML、CSV、JSONL、Queryを変換",
    category: "データ",
    accent: "藍",
    capabilities: ["JSON ↔ YAML", "JSON ↔ CSV", "JSON ↔ JSONL", "JSON ↔ Query"],
    keywords: ["yaml", "csv", "jsonl", "query"],
    layout: "wide",
  },
  {
    slug: "csv-viewer",
    name: "CSV Viewer",
    description: "CSVの安全な閲覧、診断、編集、ダウンロード",
    category: "データ",
    accent: "苔",
    capabilities: ["CSV Viewer"],
    keywords: ["csv", "tsv", "xlsx", "spreadsheet"],
    layout: "wide",
  },
  {
    slug: "sql",
    name: "SQL Tools",
    description: "CSVを仮想テーブルにして、ブラウザ内でSQLを実行",
    category: "データ",
    accent: "藍",
    capabilities: ["SQL Playground", "Schema Explorer", "Sample Dataset", "Exercise Mode", "Formatter"],
    keywords: ["sql", "duckdb", "query", "join", "csv sql", "playground"],
    featured: true,
    layout: "wide",
  },
  {
    slug: "encoder",
    name: "Encoder / Decoder",
    description: "Base64、URL、HTML Entity",
    category: "エンコード",
    accent: "苔",
    capabilities: ["Base64", "URL", "HTML Entity"],
    keywords: ["base64", "urlencode", "html entity"],
    featured: true,
    layout: "wide",
  },
  {
    slug: "jwt",
    name: "JWT Decoder",
    description: "トークンの構造と有効期限を確認",
    category: "エンコード",
    accent: "藤",
    capabilities: ["JWT Decoder"],
    keywords: ["jwt", "bearer", "token"],
    layout: "wide",
  },
  {
    slug: "hash",
    name: "Hash Tools",
    description: "SHAハッシュとHMACを生成",
    category: "エンコード",
    accent: "墨",
    capabilities: ["Hash", "HMAC"],
    keywords: ["sha", "hmac", "checksum"],
    layout: "wide",
  },
  {
    slug: "id-generator",
    name: "ID Generator",
    description: "UUIDとULIDをまとめて生成",
    category: "生成",
    accent: "藍",
    capabilities: ["UUID", "ULID"],
    keywords: ["uuid", "ulid", "guid"],
    featured: true,
  },
  {
    slug: "password",
    name: "Password Generator",
    description: "安全なランダムパスワード",
    category: "生成",
    accent: "朱",
    capabilities: ["Password Generator"],
    keywords: ["password", "random"],
  },
  {
    slug: "regex",
    name: "Regex Tester",
    description: "一致箇所とキャプチャを即時確認",
    category: "テキスト",
    accent: "苔",
    capabilities: ["Regex Tester"],
    keywords: ["regex", "regexp", "match"],
    featured: true,
    layout: "wide",
  },
  {
    slug: "diff",
    name: "Text Diff",
    description: "2つのテキストを行単位で比較",
    category: "テキスト",
    accent: "藤",
    capabilities: ["Text Diff"],
    keywords: ["diff", "compare"],
    layout: "wide",
  },
  {
    slug: "text",
    name: "Text Tools",
    description: "文字数カウントとCase変換",
    category: "テキスト",
    accent: "墨",
    capabilities: ["文字数カウント", "Case変換"],
    keywords: ["count", "case", "camel", "snake"],
    layout: "wide",
  },
  {
    slug: "lorem",
    name: "Lorem Ipsum",
    description: "用途に合わせたダミー文章",
    category: "テキスト",
    accent: "藍",
    capabilities: ["Lorem Ipsum"],
    keywords: ["dummy", "placeholder"],
  },
  {
    slug: "date-time",
    name: "Date & Time",
    description: "Unix時間とタイムゾーンを変換",
    category: "日時",
    accent: "朱",
    capabilities: ["Unix時間", "タイムゾーン"],
    keywords: ["unix", "epoch", "timezone", "timestamp"],
    featured: true,
  },
  {
    slug: "cron",
    name: "Cron Tools",
    description: "Cron式の作成と実行日時を確認",
    category: "日時",
    accent: "苔",
    capabilities: ["Cron作成", "実行日時"],
    keywords: ["cron", "schedule"],
  },
  {
    slug: "number",
    name: "Number Tools",
    description: "基数・単位・式・浮動小数点・割合を計算",
    category: "数値",
    accent: "藤",
    capabilities: ["基数変換", "単位・スケール", "式・計算", "浮動小数点", "パーセント"],
    keywords: ["radix", "hex", "ieee", "percent"],
    featured: true,
  },
  {
    slug: "url",
    name: "URL Tools",
    description: "Parse、Query、Build、Encode / Decode",
    category: "ネットワーク",
    accent: "苔",
    capabilities: ["Parse", "Query", "Build", "Encode", "Decode"],
    keywords: ["url", "querystring", "searchparams", "encode"],
    layout: "wide",
  },
  {
    slug: "http",
    name: "HTTP Tools",
    description: "cURL変換、Request生成、Header解析、Webhook署名",
    category: "ネットワーク",
    accent: "朱",
    capabilities: [
      "cURL Parser",
      "Request Builder",
      "Header Parser",
      "Cache-Control Inspector",
      "Auth Inspector",
      "Webhook HMAC",
    ],
    keywords: ["curl", "fetch", "axios", "headers", "hmac", "webhook", "cache-control"],
    featured: true,
    layout: "wide",
  },
  {
    slug: "openapi",
    name: "OpenAPI Tools",
    description: "OpenAPI 3.xの検証、Endpoint探索、差分比較",
    category: "ネットワーク",
    accent: "藤",
    capabilities: ["Validate", "Viewer", "Endpoint Explorer", "Schema Explorer", "Diff"],
    keywords: ["openapi", "swagger", "yaml", "rest", "endpoint"],
    layout: "wide",
  },
  {
    slug: "network",
    name: "Network Tools",
    description: "IPv4のSubnet、CIDR、Range、Splitterを計算",
    category: "ネットワーク",
    accent: "墨",
    capabilities: [
      "Subnet Calculator",
      "CIDR Calculator",
      "IP Range",
      "Subnet Splitter",
      "CIDR ↔ Subnet Mask",
      "IPv4 → Binary",
    ],
    keywords: ["cidr", "subnet", "ipv4", "mask", "broadcast"],
  },
  {
    slug: "har",
    name: "HAR Analyzer",
    description: "HARをブラウザ内で解析し、遅い・大きい・エラーを確認",
    category: "ネットワーク",
    accent: "藍",
    capabilities: ["Request List", "Timing", "Filters"],
    keywords: ["har", "devtools", "waterfall", "slow request"],
    layout: "wide",
  },
] as const satisfies readonly ToolDefinition[];

function buildSearchText(definition: ToolDefinition) {
  return [
    definition.name,
    definition.description,
    definition.category,
    definition.slug,
    ...definition.capabilities,
    ...(definition.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function toTool(definition: ToolDefinition, listedIndex: number): Tool {
  return {
    slug: definition.slug,
    name: definition.name,
    description: definition.description,
    category: definition.category,
    functions: definition.capabilities.length,
    href: `/tools/${definition.slug}`,
    accent: definition.accent,
    index: String(listedIndex).padStart(2, "0"),
    featured: definition.featured,
    layout: definition.layout ?? "form",
    listed: definition.listed !== false,
    capabilities: definition.capabilities,
    keywords: definition.keywords ?? [],
    searchText: buildSearchText(definition),
  };
}

export const tools: Tool[] = toolDefinitions.map((definition, index) =>
  toTool(definition, index + 1),
);

export const listedTools = tools.filter((tool) => tool.listed);

export const toolBySlug = Object.fromEntries(
  listedTools.map((tool) => [tool.slug, tool]),
) as Record<string, Tool>;

export const toolCount = listedTools.length;

export const functionCount = listedTools.reduce(
  (total, tool) => total + tool.functions,
  0,
);

export const categoryCount = new Set(listedTools.map((tool) => tool.category)).size;

export const categories = [
  { name: "すべて", count: toolCount },
  ...Array.from(new Set(listedTools.map((tool) => tool.category))).map((name) => ({
    name,
    count: listedTools.filter((tool) => tool.category === name).length,
  })),
];

export type ToolSlug = (typeof toolDefinitions)[number]["slug"];
export type ListedSuiteSlug = Exclude<ToolSlug, "json">;
export type SuiteSlug = ListedSuiteSlug | HiddenSuiteSlug;

export const suiteSlugs: SuiteSlug[] = [
  ...toolDefinitions
    .filter((tool) => tool.slug !== "json")
    .map((tool) => tool.slug as ListedSuiteSlug),
  ...hiddenSuiteSlugs,
];

export const wideWorkspaceSlugs = new Set(
  listedTools.filter((tool) => tool.layout === "wide").map((tool) => tool.slug),
);

export function isSuiteSlug(value: string): value is SuiteSlug {
  return suiteSlugs.includes(value as SuiteSlug);
}

export function searchTools(query: string, source: Tool[] = listedTools) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return source;
  return source.filter((tool) => tool.searchText.includes(normalized));
}

export const pasteAnythingStorageKeys = {
  value: "devsmith:paste-anything:value",
  type: "devsmith:paste-anything:type",
} as const;
