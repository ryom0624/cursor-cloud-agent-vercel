# JTC Hell CSV Test Report

Release candidate for CSV Viewer official promotion.

## Totals

| Suite | Tests | Result |
| --- | ---: | --- |
| `lib/csv-utils-beta.test.ts` + `lib/tool-utils.test.ts` + JTC fast | 89 | PASS |
| JTC extended (`JTC_EXTENDED=1`) | 3 | PASS |
| Fixture manifest entries | 31 | PASS |

FAIL: 0  
WARN (known limitations, not data loss): see below  
PASS: all automated fast + extended cases

## Encoding

| Encoding | Auto detect | Round-trip | Notes |
| --- | --- | --- | --- |
| UTF-8 | BOM or valid UTF-8 | PASS | ASCII-only is UTF-8互換（内部UTF-8、UIはASCII互換チップ） |
| Shift_JIS | UTF-8失敗後、SJIS妥当性あり | 表現可能文字はPASS | 不能文字は停止 |
| UTF-16LE | BOM `FF FE` 最優先。BOMなしはNUL heuristic | BOMありPASS | BOMなし日本語はUnknown |
| UTF-16BE | BOM `FE FF` 最優先。BOMなしはNUL heuristic | BOMありPASS | BOMなし日本語はUnknown |
| Unknown | EUC-JP / ISO-2022-JP / invalid / 曖昧UTF-16 | export停止 | SJISへ落とさない |

## Critical

| Area | Result |
| --- | --- |
| UTF-8 | PASS |
| Shift_JIS | PASS（不能文字STOP） |
| UTF-16LE | PASS |
| UTF-16BE | PASS |
| Excel risks | PASS（先頭ゼロ / 16桁以上 / 日付heuristic / scientific） |
| Duplicate headers | PASS |
| Multiline fields | PASS（quote内改行をmixedと誤検知しない） |
| Large files | PASS（10MB境界、10,001行parse、extended 100,000行） |
| Preview export | PASS（hidden rowsをmergeして全件保持） |
| Extra columns | PASS（切り捨てない） |

## Current vs New

意図した差分のみ:

- 重複headerでも開ける（旧はエラー）
- 空headerをcolumn_Nに書き換えない
- Simple自動区切りからspace除外
- SJIS不能は停止（旧はhtml-entity）
- quote-awareな改行判定
- Unknown encoding
- UTF-16入出力
- 列数超過を切り捨てない
- 貼り付けはencoding判定対象外

## Known limitations

- EUC-JP / ISO-2022-JP 非対応（Unknown）
- UTF-16 BOMなし日本語はendianを確信できないためUnknown
- encoding-japanese SJISはCP932完全互換ではない
- sep= はwarningのみ
- 日付リスクはheuristic（令和・9/12は検出しない）
- XLSX入力の数値化済み先頭ゼロは復元不能。数式は計算結果
- 再serializeのbyte完全一致は非保証
- Grid仮想化 / Workerなし。巨大CSVでブラウザが固まる可能性
- プレビュー中のfilter/sortは表示中10,000行のみ
- 100MB fixtureはリポジトリに置かない

## GO / NO-GO

自動化FAIL 0件。データ破壊系のblockerなし。

**GO** — 正式版へ昇格してよい。
