# CSV Viewer rollback

正式版で障害が出たとき、前世代へ戻す手順です。本番でこの手順を実行する必要はありません。切り戻し先があることを確認するための文書です。

## 現行の役割

| Route | 実装 | 用途 |
| --- | --- | --- |
| `/tools/csv-viewer` | `CsvViewerWorkspaceBeta` `variant="official"` | 正式版（Grid中心） |
| `/tools/csv-viewer-legacy2` | `CsvViewerBetaSuite` `mode="legacy2"` | 直前の正式版（一覧非表示） |
| `/tools/csv-viewer-legacy` | `CsvViewerLegacySuite` | さらに前の安定版（一覧非表示） |
| `/tools/csv-viewer-beta` | `/tools/csv-viewer` へ redirect | 旧Beta URL |

コード:

- 正式版: `lib/csv-utils-beta.ts` + `components/suites/csv-viewer-workspace-beta.tsx`
- Legacy 2: `lib/csv-utils-beta.ts` + `components/suites/csv-viewer-beta.tsx`
- Legacy: `lib/csv-utils.ts` + `components/suites/csv-viewer-legacy.tsx`
- 切替: `components/tool-suite.tsx`

`lib/csv-utils.ts` は最古の安定版parserです。破壊的変更を入れないでください。

## 即時rollback

1. `components/tool-suite.tsx` の `case "csv-viewer"` を `<CsvViewerLegacy2Suite />` に戻す
2. さらに古いUIが必要なら `<CsvViewerLegacySuite />` にする
3. デプロイする

確認URL:

- `/tools/csv-viewer-legacy2` で Grid中心化前の Simple/Pro Viewer になること
- `/tools/csv-viewer-legacy` で旧UI（`標準CSV` ラベル、重複headerはエラー、SJIS不能はhtml-entity置換）になること

## 戻さないもの

- JTC Hell テストと fixture は残してよい
- Grid の optional props（`columnLabels`, `exportSplit`, `allExportCount`）は未指定時に旧動作のまま
