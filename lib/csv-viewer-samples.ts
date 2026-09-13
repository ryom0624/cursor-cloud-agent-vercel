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

const teams = ["Platform", "Backend", "Design System", "SRE", "Product", "QA", "Data", "Security"];
const names = [
  "DevSmith", "API Gateway", "Design Tokens", "Log Pipeline", "Release Notes",
  "Auth Service", "Billing Hub", "Search Index", "Alert Router", "Feature Flags",
];
const statuses = ["active", "review", "paused", "archived"];

export function buildCsvViewerSample(rowCount = SAMPLE_ROWS) {
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const id = String(101 + index);
    const day = String(11 - (index % 28)).padStart(2, "0");
    const month = String(((index % 12) + 1)).padStart(2, "0");
    return [
      id,
      names[index % names.length],
      teams[index % teams.length],
      statuses[index % statuses.length],
      String(60 + ((index * 7) % 40)),
      `2026-${month}-${day}`,
    ];
  });
  return toCsv(["id", "name", "team", "status", "score", "updated_at"], rows);
}

const familyNames = ["山田", "佐藤", "鈴木", "高橋", "伊藤", "渡辺", "中村", "小林", "加藤", "吉田"];
const givenNames = ["太郎", "花子", "一郎", "美咲", "健", "葵", "翔", "結衣", "蓮", "陽菜"];
const departments = ["開発部", "デザイン部", "営業部", "品質保証部", "人事部", "総務部", "経理部", "広報部"];
const titles = ["エンジニア", "デザイナー", "マネージャー", "QAエンジニア", "担当", "主任", "係長"];
const notes = ["API基盤を担当", "UI・UXを担当", "国内営業を担当", "自動テストを担当", "採用を担当", "社内制度を担当"];

export function buildCsvViewerJapaneseSample(rowCount = SAMPLE_ROWS) {
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const year = 2018 + (index % 8);
    const month = String((index % 12) + 1).padStart(2, "0");
    const day = String((index % 28) + 1).padStart(2, "0");
    return [
      String(1001 + index),
      `${familyNames[index % familyNames.length]} ${givenNames[index % givenNames.length]}`,
      departments[index % departments.length],
      titles[index % titles.length],
      `${year}-${month}-${day}`,
      notes[index % notes.length],
    ];
  });
  return toCsv(["社員ID", "氏名", "部署", "役職", "入社日", "備考"], rows);
}

const prefectures = [
  "東京都千代田区", "大阪府大阪市", "福岡県福岡市", "北海道札幌市", "愛知県名古屋市",
  "京都府京都市", "神奈川県横浜市", "兵庫県神戸市", "宮城県仙台市", "広島県広島市",
];

export function buildCsvViewerComplexSample(rowCount = SAMPLE_ROWS) {
  const lines = ["id,name,note,address,amount,formula"];
  for (let index = 0; index < rowCount; index += 1) {
    const n = String(index + 1);
    const address = prefectures[index % prefectures.length];
    switch (index % 16) {
      case 0:
        lines.push([n, csvField(`カンマ,を含む名前${n}`), csvField("通常の1行メモ"), csvField(address), "1200", csvField("=SUM(1,2)")].join(","));
        break;
      case 1:
        lines.push([n, "改行データ", csvField("1行目\n2行目"), csvField(address), "0", csvField("+cmd")].join(","));
        break;
      case 2:
        lines.push([n, "引用符", csvField(`彼は"確認済み"と回答 ${n}`), csvField(address), `00${125 + (index % 70)}`, '""'].join(","));
        break;
      case 3:
        lines.push([n, "空データ", "", csvField("  前後に空白  ", "quote"), "-450", csvField("@external")].join(","));
        break;
      case 4:
        lines.push([n, "  前後空白あり  ", "未引用の空白も保持", `  ${address}  `, `00${300 + (index % 50)}`, "plain"].join(","));
        break;
      case 5:
        lines.push([n, csvField(`セミコロン;縦棒|混在${n}`), csvField("区切り文字を値に含む"), csvField(address), "123456789012345678", csvField("-abc")].join(","));
        break;
      case 6:
        lines.push([n, "指数データ", csvField("表計算で数値が展開される"), csvField(address), index % 2 ? "1.2e-3" : "1E10", "plain"].join(","));
        break;
      case 7:
        lines.push([n, "日付混入", csvField(`更新日は2026-${String((index % 12) + 1).padStart(2, "0")}-11`), csvField(address), `2026-0${(index % 9) + 1}-1${index % 10}`, csvField("＝SUM(1,2)")].join(","));
        break;
      case 8:
        lines.push([n, csvField("タブ\t含む"), csvField("メモの中に\tタブと\"引用\"がある"), csvField(address), "", csvField("*cmd")].join(","));
        break;
      case 9:
        lines.push([n, "長文メモ", csvField(`長い説明を1セルに入れた例です。行番号${n}。${"詳細,".repeat(12)}終わり`), csvField(address), "00100", csvField("+1+1")].join(","));
        break;
      case 10:
        lines.push([n, "", csvField(""), csvField(""), "", ""].join(","));
        break;
      case 11:
        lines.push([n, csvField(`日本語,English mix ${n}`), csvField("改行とカンマ\n次行,続き"), csvField(`〒150-000${index % 10} ${address}`), "0000000001", csvField("@IMPORT")].join(","));
        break;
      case 12:
        lines.push([n, "郵便番号風", csvField("先頭ゼロのID"), csvField(address), `0${1500000 + index}`, "plain"].join(","));
        break;
      case 13:
        lines.push([n, csvField(`"既に引用符付き"名前`), csvField("彼は\"未確認\"のまま"), csvField(address), "98", csvField("\t=1+1")].join(","));
        break;
      case 14:
        lines.push([n, "空白のみ", csvField("   "), csvField(" "), "-12", csvField("＋cmd")].join(","));
        break;
      default:
        lines.push([n, csvField(`複合,パターン${n}`), csvField(`1行目のメモ\n2行目に"引用"\n3行目`), csvField(`  ${address},別館  `), "00321", csvField("=CMD|'/c calc'")].join(","));
        break;
    }
  }
  return lines.join("\n");
}

export const csvViewerSample = buildCsvViewerSample();
export const csvViewerJapaneseSample = buildCsvViewerJapaneseSample();
export const csvViewerComplexSample = buildCsvViewerComplexSample();
