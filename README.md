# DevSmith

エンジニアが日常的に使う変換・検証・生成ツールを、ひとつの場所にまとめたブラウザツール集です。

## ローカル起動

```bash
npm install
npm run dev
```

`http://localhost:3000`を開いてください。

## 検証

```bash
npm test
npm run lint
npm run build
```

## Vercelへデプロイ

このリポジトリをVercelへImportするだけでデプロイできます。Build CommandやOutput Directoryの上書きは不要です。

Google Analytics 4を有効にする場合は、VercelのProduction環境変数へ以下を設定します。

```text
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

GA4はユーザーがアクセス解析へ同意した場合にだけ読み込まれます。ツールへの入力内容は送信しません。
