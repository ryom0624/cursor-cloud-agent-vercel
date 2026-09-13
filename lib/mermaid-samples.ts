export type MermaidSample = {
  id: string;
  name: string;
  description: string;
  type: string;
  source: string;
};

export const mermaidViewerSamples: MermaidSample[] = [
  {
    id: "flowchart",
    name: "フローチャート",
    description: "DevSmithの道具箱をカテゴリ別に辿る",
    type: "flowchart",
    source: `flowchart TB
  start(["ブラウザで開く"]) --> paste["Paste Anything"]
  paste --> detect{"入力を判定"}
  detect -->|"JSON"| json["JSON Tools"]
  detect -->|"CSV / TSV"| csv["CSV Viewer"]
  detect -->|"Mermaid"| mermaid["Mermaid Viewer"]
  detect -->|"その他"| catalog["道具箱"]

  subgraph dataGroup["データ"]
    json --> format["整形 / 検証 / Grid"]
    converter["Data Converter"] --> yaml["YAML / CSV / JSONL"]
    csv --> grid["安全な表表示"]
    mermaid --> preview["プレビューと拡大縮小"]
  end

  subgraph encodeGroup["エンコード"]
    encoder["Encoder / Decoder"]
    jwt["JWT Decoder"]
    hash["Hash Tools"]
  end

  subgraph generateGroup["生成"]
    idgen["ID Generator"]
    password["Password Generator"]
  end

  subgraph textGroup["テキスト"]
    regex["Regex Tester"]
    diff["Text Diff"]
    text["Text Tools"]
    lorem["Lorem Ipsum"]
  end

  subgraph timeGroup["日時 / 数値"]
    datetime["Date & Time"]
    cron["Cron Tools"]
    number["Number Tools"]
  end

  catalog --> json
  catalog --> converter
  catalog --> csv
  catalog --> mermaid
  catalog --> encoder
  catalog --> jwt
  catalog --> hash
  catalog --> idgen
  catalog --> password
  catalog --> regex
  catalog --> diff
  catalog --> text
  catalog --> lorem
  catalog --> datetime
  catalog --> cron
  catalog --> number

  format --> local["LOCAL ONLY"]
  yaml --> local
  grid --> local
  preview --> local
  encoder --> local
  jwt --> local
  hash --> local
  idgen --> local
  password --> local
  regex --> local
  diff --> local
  text --> local
  lorem --> local
  datetime --> local
  cron --> local
  number --> local`,
  },
  {
    id: "sequence",
    name: "シーケンス",
    description: "Paste Anythingからツールを開く流れ",
    type: "sequence",
    source: `sequenceDiagram
  actor User as 利用者
  participant Home as Home
  participant Detect as 判定
  participant Store as SessionStorage
  participant Tool as 推奨ツール

  User->>Home: JSON / CSV / Mermaid を貼る
  Home->>Detect: detectPaste
  alt JWTの3セグメント
    Detect-->>Home: JWT Decoder
  else 有効なJSON
    Detect-->>Home: JSON Tools
  else Mermaid記法
    Detect-->>Home: Mermaid Viewer
  else 列が揃ったCSV
    Detect-->>Home: CSV Viewer
  else それ以外
    Detect-->>Home: Text Tools
  end
  User->>Home: このツールで開く
  Home->>Store: 入力と種別を保存
  Home->>Tool: 遷移
  Tool->>Store: 値を取り出して消去
  Tool-->>User: ブラウザ内だけで処理`,
  },
  {
    id: "class",
    name: "クラス",
    description: "ワークスペースとツール構成",
    type: "class",
    source: `classDiagram
  class Tool {
    +String name
    +String description
    +String category
    +Number functions
    +String href
    +String accent
    +String index
  }
  class ToolShell {
    +String slug
    +renderSidebar()
    +renderHeading()
  }
  class JsonWorkbench {
    +Mode mode
    +format()
    +validate()
    +minify()
    +tree()
    +grid()
  }
  class CsvViewerWorkspace {
    +openFile()
    +diagnose()
    +editGrid()
    +download()
  }
  class MermaidViewer {
    +source: String
    +zoom: Number
    +pan: Point
    +renderDiagram()
    +fitToView()
  }
  class TextWorkspace {
    +input: String
    +output: String
    +fullscreen: Boolean
  }
  ToolShell --> Tool : lists
  ToolShell <|-- JsonWorkbench
  ToolShell <|-- CsvViewerWorkspace
  ToolShell <|-- MermaidViewer
  ToolShell <|-- TextWorkspace
  MermaidViewer --> Point : pan
  class Point {
    +Number x
    +Number y
  }`,
  },
  {
    id: "state",
    name: "状態遷移",
    description: "CSV Viewerの作業状態",
    type: "state",
    source: `stateDiagram-v2
  [*] --> Empty: ツールを開く
  Empty --> Loading: ファイル / 貼り付け / サンプル
  Loading --> Viewer: 解析成功
  Loading --> Alert: 文字コードや破損
  Alert --> Loading: 再解釈
  Viewer --> Raw: RAWタブ
  Raw --> Viewer: VIEWERタブ
  Viewer --> Split: 左右分割
  Split --> Viewer: 分割解除
  Viewer --> Editing: セルを編集
  Editing --> Viewer: 確定
  Viewer --> Output: ダウンロード
  Output --> Viewer: 完了
  Viewer --> Empty: すべて消去
  Viewer --> [*]: ページを離れる`,
  },
  {
    id: "er",
    name: "ER図",
    description: "JSONサンプルと同じプロジェクトデータ",
    type: "er",
    source: `erDiagram
  PROJECT ||--|{ METRIC : records
  PROJECT ||--|{ TAG : tagged
  PROJECT }|--|| OWNER : owned-by
  OWNER }|--|| TEAM : belongs-to
  PROJECT {
    string id PK
    string name
    string status
    int priority
    datetime updatedAt
  }
  OWNER {
    string name
    string team FK
  }
  TEAM {
    string name PK
    string focus
  }
  TAG {
    string label PK
  }
  METRIC {
    int users
    float uptime
  }`,
  },
  {
    id: "gantt",
    name: "ガント",
    description: "2026年の道具追加スケジュール",
    type: "gantt",
    source: `gantt
  title DevSmith 2026 Roadmap
  dateFormat YYYY-MM-DD
  axisFormat %m/%d
  section データ
  JSON Tools Grid           :done, json, 2026-01-06, 2026-03-20
  CSV Viewer 正式版         :done, csv, 2026-03-02, 2026-06-30
  Mermaid Viewer            :active, mermaid, 2026-09-01, 2026-09-30
  section 変換
  Data Converter            :done, conv, 2026-02-10, 2026-04-18
  Number Tools              :done, num, 2026-07-01, 2026-08-22
  section 基盤
  Paste Anything            :done, paste, 2026-04-01, 2026-05-15
  100機能までの拡張         :crit, expand, 2026-10-01, 2026-12-20`,
  },
  {
    id: "pie",
    name: "円グラフ",
    description: "カテゴリ別の機能数",
    type: "pie",
    source: `pie showData
  title DevSmith 機能の内訳
  "データ": 11
  "エンコード": 6
  "生成": 3
  "テキスト": 5
  "日時": 4
  "数値": 5`,
  },
  {
    id: "mindmap",
    name: "マインドマップ",
    description: "ホームのカテゴリと同じ道具箱",
    type: "mindmap",
    source: `mindmap
  root((DevSmith))
    データ
      JSON Tools
      Data Converter
      CSV Viewer
      Mermaid Viewer
    エンコード
      Encoder Decoder
      JWT Decoder
      Hash Tools
    生成
      UUID ULID
      Password
    テキスト
      Regex Tester
      Text Diff
      Case変換
      Lorem Ipsum
    日時
      Unix時間
      Cron
    数値
      基数
      単位
      式`,
  },
  {
    id: "git",
    name: "Gitグラフ",
    description: "リリースブランチの流れ",
    type: "git",
    source: `gitGraph
  commit id: "json-tools"
  commit id: "data-converter"
  branch csv-viewer
  checkout csv-viewer
  commit id: "csv-beta"
  commit id: "csv-grid"
  checkout main
  merge csv-viewer id: "csv-ga"
  commit id: "number-tools"
  branch mermaid-viewer
  checkout mermaid-viewer
  commit id: "split-panes"
  commit id: "pinch-zoom"
  checkout main
  merge mermaid-viewer id: "mermaid-ga"`,
  },
  {
    id: "journey",
    name: "ジャーニー",
    description: "初めてDevSmithを使う人の動き",
    type: "journey",
    source: `journey
  title 初回の作業
  section 到着
    ホームを開く: 5: 利用者
    道具を検索: 4: 利用者
  section 判定
    データをを貼る: 5: 利用者
    推奨ツールへ進む: 5: 利用者, DevSmith
  section 作業
    サンプルを試す: 4: 利用者
    図を拡大して確認: 5: 利用者
    結果をコピー: 5: 利用者
  section 安心
    外部送信がないことを確認: 5: 利用者`,
  },
];

export const mermaidViewerDefaultSample = mermaidViewerSamples[0];

export const mermaidViewerSampleSource = mermaidViewerDefaultSample.source;
