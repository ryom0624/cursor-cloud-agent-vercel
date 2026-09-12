# CSV Viewer rollback

正式版で障害が出たとき、旧安定版へ戻す手順です。本番でこの手順を実行する必要はありません。切り戻し先があることを確認するための文書です。

## 現行の役割

| Route | 実装 | 用途 |
| --- | --- | --- |
| `/tools/csv-viewer` | `CsvViewerBetaSuite` `mode="official"` | 正式版 |
| `/tools/csv-viewer-legacy` | `CsvViewerLegacySuite` | 旧安定版（一覧非表示） |
| `/tools/csv-viewer-beta` | `/tools/csv-viewer` へ redirect | 旧Beta URL |

コード:

- 正式版ロジック: `lib/csv-utils-beta.ts` + `components/suites/csv-viewer-beta.tsx`
- 旧安定版ロジック: `lib/csv-utils.ts` + `components/suites/csv-viewer-legacy.tsx`
- 切替: `components/tool-suite.tsx`

`lib/csv-utils.ts` は旧安定版parserです。破壊的変更を入れないでください。

## 即時rollback

1. `components/tool-suite.tsx` の `case "csv-viewer"` を `<CsvViewerLegacySuite />` に戻す
2. 必要なら `app/tools/[slug]/page.tsx` の beta redirect をやめ、legacy を正式URLにする
3. デプロイする

確認URL: `/tools/csv-viewer-legacy` で旧UI（`標準CSV` ラベル、重複headerはエラー、SJIS不能はhtml-entity置換）になること。

## 戻さないもの

- JTC Hell テストと fixture は残してよい
- Grid の optional props（`columnLabels`, `exportSplit`, `allExportCount`）は未指定時に旧動作のまま
