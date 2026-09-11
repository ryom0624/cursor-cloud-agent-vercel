import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシー | DevSmith",
  description: "DevSmithにおける入力データとアクセス解析の取り扱い。",
};

export default function PrivacyPage() {
  return (
    <main className="document-page">
      <div className="document-kicker">PRIVACY / DATA POLICY</div>
      <h1>プライバシー</h1>
      <p className="document-lead">
        DevSmithは、道具へ入力されたデータを原則としてブラウザ内だけで処理します。
      </p>

      <section>
        <span>01</span>
        <div>
          <h2>ツールへの入力</h2>
          <p>
            JSON、JWT、文字列、パスワードなどの入力内容は、DevSmithのサーバーへ送信・保存しません。変換や生成処理にはブラウザの標準APIを使用します。
          </p>
        </div>
      </section>
      <section>
        <span>02</span>
        <div>
          <h2>アクセス解析</h2>
          <p>
            同意いただいた場合のみGoogle Analytics 4を読み込み、ページの閲覧状況を匿名で計測します。ツールへの入力内容や生成結果は計測対象に含めません。
          </p>
        </div>
      </section>
      <section>
        <span>03</span>
        <div>
          <h2>端末内の保存</h2>
          <p>
            アクセス解析への同意状態など、表示に必要な設定をLocalStorageへ保存することがあります。Password Generatorは利便性のため、生成文字列の長さと生成個数だけをこの端末のLocalStorageへ保存します。生成されたパスワード自体は保存しません。その他のツール入力も保存しません。
          </p>
        </div>
      </section>
      <section>
        <span>04</span>
        <div>
          <h2>外部通信</h2>
          <p>
            現在公開しているツール機能は外部APIを利用しません。将来、DNS Lookupなど通信が必要な機能を追加する場合は、送信先と送信内容を操作前に明示します。
          </p>
        </div>
      </section>
    </main>
  );
}
