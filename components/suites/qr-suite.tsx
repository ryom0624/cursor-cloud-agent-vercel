"use client";

import { Download, FileCode2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  buildVCardPayload,
  buildWifiPayload,
  describeQrPayload,
  downloadBlob,
  downloadDataUrl,
  generateQrSvg,
  qrSvgDataUrl,
  svgToPngDataUrl,
  type QrErrorCorrection,
  type QrVCardFields,
  type QrWifiFields,
  type QrWifiSecurity,
} from "@/lib/qr-utils";

type QrMode = "text" | "wifi" | "vcard";

const tabs: { id: QrMode; label: string }[] = [
  { id: "text", label: "テキスト" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "vcard", label: "連絡先" },
];

const errorLevels: { id: QrErrorCorrection; label: string }[] = [
  { id: "L", label: "L · 低" },
  { id: "M", label: "M · 中" },
  { id: "Q", label: "Q · 高" },
  { id: "H", label: "H · 最高" },
];

const sizes = [256, 384, 512, 1024];
const margins = [1, 2, 4];

const sampleText = "https://devsmith.io";
const sampleWifi: QrWifiFields = {
  ssid: "DevSmith",
  password: "local-only",
  security: "WPA",
  hidden: false,
};
const sampleVCard: QrVCardFields = {
  name: "Dev Smith",
  org: "DevSmith",
  phone: "+81-90-0000-0000",
  email: "hello@devsmith.io",
  url: "https://devsmith.io",
};

export function QrSuite() {
  const [mode, setMode] = useState<QrMode>("text");
  const [text, setText] = useState(sampleText);
  const [wifi, setWifi] = useState<QrWifiFields>(sampleWifi);
  const [vcard, setVcard] = useState<QrVCardFields>(sampleVCard);
  const [errorCorrectionLevel, setErrorCorrectionLevel] =
    useState<QrErrorCorrection>("M");
  const [width, setWidth] = useState(384);
  const [margin, setMargin] = useState(2);
  const [downloadError, setDownloadError] = useState("");

  const payload = useMemo(() => {
    if (mode === "wifi") return buildWifiPayload(wifi);
    if (mode === "vcard") return buildVCardPayload(vcard);
    return text.trim();
  }, [mode, text, vcard, wifi]);

  const result = useMemo(() => {
    if (!payload) {
      return {
        svg: "",
        error:
          mode === "wifi"
            ? "SSIDを入力してください。"
            : mode === "vcard"
              ? "氏名を入力してください。"
              : "エンコードするテキストを入力してください。",
      };
    }
    try {
      return {
        svg: generateQrSvg(payload, {
          errorCorrectionLevel,
          width,
          margin,
        }),
        error: "",
      };
    } catch (caught) {
      return {
        svg: "",
        error:
          caught instanceof Error
            ? caught.message
            : "QRコードを生成できませんでした。入力を短くするか、誤り訂正レベルを下げてください。",
      };
    }
  }, [errorCorrectionLevel, margin, mode, payload, width]);

  const downloadPng = async () => {
    if (!result.svg) return;
    try {
      const dataUrl = await svgToPngDataUrl(result.svg, width);
      downloadDataUrl(dataUrl, "devsmith-qr.png");
      setDownloadError("");
    } catch (caught) {
      setDownloadError(
        caught instanceof Error
          ? caught.message
          : "PNGの書き出しに失敗しました。",
      );
    }
  };

  const downloadSvg = () => {
    if (!result.svg) return;
    downloadBlob(result.svg, "devsmith-qr.svg", "image/svg+xml;charset=utf-8");
    setDownloadError("");
  };

  return (
    <ToolShell
      slug="qr"
      category="生成"
      title="QR Code"
      description="テキスト、Wi-Fi設定、連絡先をQRコードに変換し、PNG / SVGで保存します。"
      functionCount={3}
      tabs={tabs}
      activeTab={mode}
      onTabChange={(tab) => {
        setMode(tab as QrMode);
        setDownloadError("");
      }}
    >
      <div className="generator-controls lorem-controls">
        <label className="control-label">
          誤り訂正
          <select
            value={errorCorrectionLevel}
            onChange={(event) =>
              setErrorCorrectionLevel(event.target.value as QrErrorCorrection)
            }
          >
            {errorLevels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
        <label className="control-label">
          サイズ
          <select
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </label>
        <label className="control-label">
          余白
          <select
            value={margin}
            onChange={(event) => setMargin(Number(event.target.value))}
          >
            {margins.map((value) => (
              <option key={value} value={value}>
                {value}モジュール
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="primary-button"
          onClick={() => void downloadPng()}
          disabled={!result.svg}
        >
          <Download size={14} aria-hidden="true" />
          PNG
        </button>
        <button
          type="button"
          onClick={downloadSvg}
          disabled={!result.svg}
        >
          <FileCode2 size={14} aria-hidden="true" />
          SVG
        </button>
        <CopyButton
          value={result.svg}
          label="SVGをコピー"
          className="text-button"
        />
      </div>

      <div className="suite-editors qr-workspace">
        <section className="suite-editor input-editor">
          <header>
            <span>{mode === "wifi" ? "WI-FI" : mode === "vcard" ? "CONTACT" : "INPUT"}</span>
            <small>{payload ? describeQrPayload(payload) : "0文字"}</small>
          </header>
          {mode === "text" ? (
            <textarea
              name="qr-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="URLや任意のテキストを入力"
              spellCheck={false}
            />
          ) : mode === "wifi" ? (
            <div className="qr-form">
              <label className="control-label">
                SSID
                <input
                  name="qr-wifi-ssid"
                  value={wifi.ssid}
                  onChange={(event) =>
                    setWifi((current) => ({ ...current, ssid: event.target.value }))
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label className="control-label">
                セキュリティ
                <select
                  value={wifi.security}
                  onChange={(event) =>
                    setWifi((current) => ({
                      ...current,
                      security: event.target.value as QrWifiSecurity,
                    }))
                  }
                >
                  <option value="WPA">WPA / WPA2 / WPA3</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">なし（オープン）</option>
                </select>
              </label>
              <label className="control-label">
                パスワード
                <input
                  name="qr-wifi-password"
                  value={wifi.password}
                  onChange={(event) =>
                    setWifi((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  disabled={wifi.security === "nopass"}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label className="control-label checkbox-inline">
                <input
                  type="checkbox"
                  checked={wifi.hidden}
                  onChange={(event) =>
                    setWifi((current) => ({
                      ...current,
                      hidden: event.target.checked,
                    }))
                  }
                />
                ステルスSSID（非公開）
              </label>
            </div>
          ) : (
            <div className="qr-form">
              <label className="control-label">
                氏名
                <input
                  name="qr-vcard-name"
                  value={vcard.name}
                  onChange={(event) =>
                    setVcard((current) => ({ ...current, name: event.target.value }))
                  }
                  autoComplete="off"
                />
              </label>
              <label className="control-label">
                組織
                <input
                  name="qr-vcard-org"
                  value={vcard.org}
                  onChange={(event) =>
                    setVcard((current) => ({ ...current, org: event.target.value }))
                  }
                  autoComplete="off"
                />
              </label>
              <label className="control-label">
                電話
                <input
                  name="qr-vcard-phone"
                  value={vcard.phone}
                  onChange={(event) =>
                    setVcard((current) => ({ ...current, phone: event.target.value }))
                  }
                  autoComplete="off"
                />
              </label>
              <label className="control-label">
                メール
                <input
                  name="qr-vcard-email"
                  value={vcard.email}
                  onChange={(event) =>
                    setVcard((current) => ({ ...current, email: event.target.value }))
                  }
                  autoComplete="off"
                />
              </label>
              <label className="control-label">
                URL
                <input
                  name="qr-vcard-url"
                  value={vcard.url}
                  onChange={(event) =>
                    setVcard((current) => ({ ...current, url: event.target.value }))
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </div>
          )}
        </section>
        <section className="suite-editor output-editor">
          <header>
            <span>QR CODE</span>
            <CopyButton value={payload} label="内容をコピー" />
          </header>
          {result.svg ? (
            <div className="qr-preview">
              {/* Generated locally from the qrcode encoder; not a remote asset. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSvgDataUrl(result.svg)}
                alt="生成したQRコード"
                width={width}
                height={width}
              />
            </div>
          ) : (
            <div className="qr-preview qr-preview-empty">
              {result.error || "入力するとQRコードを表示します"}
            </div>
          )}
        </section>
      </div>
      <ToolStatus error={result.error || downloadError}>
        {result.svg
          ? `${describeQrPayload(payload)} · 誤り訂正 ${errorCorrectionLevel} · ${width}px`
          : "入力内容はブラウザ内で処理されます"}
      </ToolStatus>
    </ToolShell>
  );
}
