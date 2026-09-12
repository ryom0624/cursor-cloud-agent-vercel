# JTC Hell CSV Test Suite

日本企業のレガシーCSVで起きやすい事故を、synthetic dataだけで再現する回帰試験です。

実在する個人情報・顧客情報・口座番号・マイナンバーは使いません。

## ディレクトリ

| Path | 役割 |
| --- | --- |
| `build-fixtures.ts` | UTF-8 / Shift_JIS / UTF-16 / EUC-JP などのbyte生成 |
| `fixture-manifest.ts` | 各fixtureの期待値（行数、encoding、保持すべき値、警告） |
| `generated/` | 小さいbyte-level fixture。巨大ファイルは置かない |

## 実行

```bash
npm test                          # fast（通常PR）
npm run test:extended             # 100,000行・1000列など
```

fastに入るもの: encoding、header、quote、Excel risk、round-trip、SJIS安全停止、UTF-16、preview全件保持。

extended: 100,000行、1,000列、100,000文字セル。100MBファイルはリポジトリに置きません。

## 命名

`test1.csv` は使いません。用途が見える名前にします。

例: `jtc-accounting-utf8.csv`, `legacy-utf16le-tab-bom.csv`, `broken-duplicate-header.csv`

## 原則

1. データを壊さない
2. 黙って変換しない
3. 判定不能なら Unknown
4. Excelリスクは警告のみ
5. header異常でも中身を確認できる

## 代表fixture

詳細は `fixture-manifest.ts` を正とします。

- UTF-8 BOMなし / BOMあり
- UTF-16LE/BE BOMあり。BOMなしASCIIはheuristic、BOMなし日本語はUnknown
- Shift_JIS（encoding-japanese SJIS。CP932完全互換ではない）
- EUC-JP / ISO-2022-JP → Unknown
- 重複・空header、quoted multiline、本当の改行混在
- 先頭ゼロ、16桁以上整数、CSV Injection
- 会計・人事・JANのsynthetic CSV
