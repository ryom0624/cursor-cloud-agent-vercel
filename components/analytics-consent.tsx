"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

type Consent = "accepted" | "declined" | null;

const storageKey = "devsmith-analytics-consent";

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    setConsent(
      stored === "accepted" || stored === "declined" ? stored : null,
    );
    setReady(true);
  }, []);

  const choose = (value: Exclude<Consent, null>) => {
    localStorage.setItem(storageKey, value);
    setConsent(value);
  };

  return (
    <>
      {measurementId && consent === "accepted" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="afterInteractive"
          />
          <Script id="devsmith-google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('consent', 'default', {
                analytics_storage: 'granted',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
              });
              gtag('config', '${measurementId}', {
                anonymize_ip: true,
                allow_google_signals: false
              });
            `}
          </Script>
        </>
      )}
      {ready && consent === null && (
        <aside className="consent-banner" aria-label="アクセス解析の設定">
          <div>
            <strong>アクセス解析について</strong>
            <p>
              改善のため匿名の利用状況を計測します。ツールへの入力内容は送信しません。
            </p>
          </div>
          <div>
            <button type="button" onClick={() => choose("declined")}>
              使用しない
            </button>
            <button type="button" className="accept" onClick={() => choose("accepted")}>
              同意する
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
