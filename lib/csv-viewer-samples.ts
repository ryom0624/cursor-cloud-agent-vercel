const SAMPLE_ROWS = 100;

function csvField(value: string, mode: "auto" | "quote" | "raw" = "auto") {
  if (mode === "raw") return value;
  if (mode === "quote" || /[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function toCsv(header: string[], rows: string[][], fieldMode?: Array<"auto" | "quote" | "raw">) {
  const lines = [
    header.map((value) => csvField(value)).join(","),
    ...rows.map((row) => row.map((value, index) => csvField(value, fieldMode?.[index] ?? "auto")).join(",")),
  ];
  return lines.join("\n");
}

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

function uniquePair<T, U>(left: T[], right: U[], index: number) {
  return [left[index % left.length], right[Math.floor(index / left.length) % right.length]] as const;
}

const adjectives = [
  "Aurora", "Cedar", "Cobalt", "Ember", "Falcon", "Glacier", "Harbor", "Ion", "Juniper", "Kepler",
  "Lunar", "Maple", "Nebula", "Orbit", "Pine", "Quartz", "Ridge", "Solstice", "Timber", "Velvet",
];
const nouns = [
  "Gateway", "Pipeline", "Console", "Ledger", "Atlas", "Beacon", "Circuit", "Depot", "Engine", "Forge",
  "Router", "Index", "Vault", "Relay", "Studio", "Nexus", "Canvas", "Mesh", "Broker", "Archive",
];
const teams = [
  "Platform", "Backend", "Design System", "SRE", "Product", "QA", "Data", "Security", "Growth", "Infra",
];
const statuses = ["active", "review", "paused", "archived"];

export function buildCsvViewerSample(rowCount = SAMPLE_ROWS) {
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const [adjective, noun] = uniquePair(adjectives, nouns, index);
    const date = new Date(Date.UTC(2026, 0, 1 + index));
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return [
      String(101 + index),
      `${adjective} ${noun}`,
      `${pick(teams, index)}-${String(index + 1).padStart(2, "0")}`,
      statuses[index % statuses.length],
      String(41 + index),
      `2026-${month}-${day}`,
    ];
  });
  return toCsv(["id", "name", "team", "status", "score", "updated_at"], rows);
}

const familyNames = ["山田", "佐藤", "鈴木", "高橋", "伊藤", "渡辺", "中村", "小林", "加藤", "吉田"];
const givenNames = ["太郎", "花子", "一郎", "美咲", "健", "葵", "翔", "結衣", "蓮", "陽菜"];
const departments = ["開発部", "デザイン部", "営業部", "品質保証部", "人事部", "総務部", "経理部", "広報部", "情報システム部", "カスタマー部"];
const titles = ["エンジニア", "デザイナー", "マネージャー", "QAエンジニア", "担当", "主任", "係長", "リーダー", "スペシャリスト", "アシスタント"];
const noteFocus = [
  "API基盤", "UIトークン", "国内営業", "自動テスト", "中途採用", "社内制度", "月次決算", "プレスリリース",
  "権限管理", "問い合わせ対応", "検索改善", "障害訓練", "オンボーディング", "在庫連携", "請求書", "イベント運営",
  "ログ監査", "アクセシビリティ", "パートナー契約", "サポート品質",
];

export function buildCsvViewerJapaneseSample(rowCount = SAMPLE_ROWS) {
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const [familyName, givenName] = uniquePair(familyNames, givenNames, index);
    const date = new Date(Date.UTC(2018, 0, 4 + index * 11));
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const department = pick(departments, index);
    const title = pick(titles, index + 3);
    const focus = pick(noteFocus, index);
    return [
      String(1001 + index),
      `${familyName} ${givenName}`,
      `${department} ${String((index % 4) + 1)}課`,
      title,
      `${year}-${month}-${day}`,
      `${department}で${focus}を担当。社員番号${1001 + index}の引き継ぎメモ。`,
    ];
  });
  return toCsv(["社員ID", "氏名", "部署", "役職", "入社日", "備考"], rows);
}

const prefectures = [
  "東京都千代田区", "大阪府大阪市", "福岡県福岡市", "北海道札幌市", "愛知県名古屋市",
  "京都府京都市", "神奈川県横浜市", "兵庫県神戸市", "宮城県仙台市", "広島県広島市",
  "新潟県新潟市", "静岡県静岡市", "岡山県岡山市", "熊本県熊本市", "沖縄県那覇市",
  "長野県長野市", "栃木県宇都宮市", "石川県金沢市", "香川県高松市", "鹿児島県鹿児島市",
];

const complexPatterns = [
  "comma",
  "newline",
  "quotes",
  "empty",
  "padded",
  "separators",
  "exponent",
  "date",
  "tab",
  "long",
  "blank-row",
  "mixed",
  "zip",
  "quoted-name",
  "spaces",
  "compound",
] as const;

export function buildCsvViewerComplexSample(rowCount = SAMPLE_ROWS) {
  const lines = ["id,name,note,address,amount,formula"];
  for (let index = 0; index < rowCount; index += 1) {
    const n = String(index + 1);
    const address = `${pick(prefectures, index)}${1 + (index % 20)}-${1 + (index % 9)}-${10 + index}`;
    const pattern = complexPatterns[index % complexPatterns.length];
    switch (pattern) {
      case "comma":
        lines.push([n, csvField(`カンマ,を含む名前${n}`), csvField(`通常の1行メモ ${n}`), csvField(address), String(1200 + index), csvField(`=SUM(${index},2)`)].join(","));
        break;
      case "newline":
        lines.push([n, `改行データ${n}`, csvField(`1行目 行${n}\n2行目 ${address}`), csvField(address), String(index), csvField(`+cmd${n}`)].join(","));
        break;
      case "quotes":
        lines.push([n, `引用符${n}`, csvField(`彼は"確認済み${n}"と回答`), csvField(address), `00${125 + index}`, '""'].join(","));
        break;
      case "empty":
        lines.push([n, `空データ${n}`, "", csvField(`  前後に空白 ${n}  `, "quote"), String(-450 - index), csvField(`@external-${n}`)].join(","));
        break;
      case "padded":
        lines.push([n, `  前後空白あり ${n}  `, `未引用の空白も保持 ${n}`, `  ${address}  `, `00${300 + index}`, `plain-${n}`].join(","));
        break;
      case "separators":
        lines.push([n, csvField(`セミコロン;縦棒|混在${n}`), csvField(`区切り文字を値に含む ${n}`), csvField(address), String(123456789012345678 + index), csvField(`-abc${n}`)].join(","));
        break;
      case "exponent":
        lines.push([n, `指数データ${n}`, csvField(`表計算で数値が展開される ${n}`), csvField(address), index % 2 ? `${(index + 1) / 1000}e-3` : `${index + 1}E10`, `plain-${n}`].join(","));
        break;
      case "date":
        lines.push([n, `日付混入${n}`, csvField(`更新日は2026-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`), csvField(address), `2026-0${(index % 9) + 1}-1${index % 10}`, csvField(`＝SUM(${n},2)`)].join(","));
        break;
      case "tab":
        lines.push([n, csvField(`タブ\t含む${n}`), csvField(`メモ${n}の中に\tタブと"引用"がある`), csvField(address), String(10 + index), csvField(`*cmd${n}`)].join(","));
        break;
      case "long":
        lines.push([n, `長文メモ${n}`, csvField(`長い説明を1セルに入れた例です。行番号${n}。対象は${address}で、${"詳細,".repeat(8)}終わり`), csvField(address), `00${100 + index}`, csvField(`+${n}+1`)].join(","));
        break;
      case "blank-row":
        lines.push([n, `空欄多め${n}`, csvField(""), csvField(`${address} 空欄確認`), String(index), ""].join(","));
        break;
      case "mixed":
        lines.push([n, csvField(`日本語,English mix ${n}`), csvField(`改行とカンマ ${n}\n次行,続き`), csvField(`〒${String(1500000 + index).padStart(7, "0")} ${address}`), "0000000001", csvField(`@IMPORT-${n}`)].join(","));
        break;
      case "zip":
        lines.push([n, `郵便番号風${n}`, csvField(`先頭ゼロのID ${n}`), csvField(address), `0${1500000 + index}`, `plain-${n}`].join(","));
        break;
      case "quoted-name":
        lines.push([n, csvField(`"既に引用符付き"名前${n}`), csvField(`彼は"未確認${n}"のまま`), csvField(address), String(98 + index), csvField(`\t=1+${n}`)].join(","));
        break;
      case "spaces":
        lines.push([n, `空白のみ${n}`, csvField(`   ${n}   `), csvField(` ${n} `), String(-12 - index), csvField(`＋cmd${n}`)].join(","));
        break;
      default:
        lines.push([n, csvField(`複合,パターン${n}`), csvField(`1行目のメモ ${n}\n2行目に"引用"\n3行目 ${address}`), csvField(`  ${address},別館${n}  `), `00${321 + index}`, csvField(`=CMD|'/c echo ${n}'`)].join(","));
        break;
    }
  }
  return lines.join("\n");
}

export const csvViewerSample = buildCsvViewerSample();
export const csvViewerJapaneseSample = buildCsvViewerJapaneseSample();
export const csvViewerComplexSample = buildCsvViewerComplexSample();
