import { describe, expect, it } from "vitest";
import {
  buildVCardPayload,
  buildWifiPayload,
  describeQrPayload,
  escapeWifiValue,
  generateQrSvg,
  qrSvgDataUrl,
} from "./qr-utils";

describe("QR payload builders", () => {
  it("escapes Wi-Fi special characters", () => {
    expect(escapeWifiValue(`net;work: "A",\\B`)).toBe(
      String.raw`net\;work\: \"A\"\,\\B`,
    );
  });

  it("builds a WPA Wi-Fi payload", () => {
    expect(
      buildWifiPayload({
        ssid: "DevSmith",
        password: "secret;key",
        security: "WPA",
        hidden: false,
      }),
    ).toBe("WIFI:T:WPA;S:DevSmith;P:secret\\;key;;");
  });

  it("omits the password for open networks and marks hidden SSIDs", () => {
    expect(
      buildWifiPayload({
        ssid: "Guest",
        password: "ignored",
        security: "nopass",
        hidden: true,
      }),
    ).toBe("WIFI:T:nopass;S:Guest;H:true;;");
  });

  it("returns an empty Wi-Fi payload without an SSID", () => {
    expect(
      buildWifiPayload({
        ssid: "  ",
        password: "x",
        security: "WPA",
        hidden: false,
      }),
    ).toBe("");
  });

  it("builds a vCard with optional fields", () => {
    expect(
      buildVCardPayload({
        name: "Dev Smith",
        org: "DevSmith",
        phone: "+81-90-0000-0000",
        email: "dev@example.com",
        url: "https://devsmith.io",
      }),
    ).toBe(
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        "FN:Dev Smith",
        "ORG:DevSmith",
        "TEL:+81-90-0000-0000",
        "EMAIL:dev@example.com",
        "URL:https://devsmith.io",
        "END:VCARD",
      ].join("\n"),
    );
  });

  it("returns an empty vCard without a name", () => {
    expect(
      buildVCardPayload({
        name: "",
        org: "DevSmith",
        phone: "1",
        email: "a@b.c",
        url: "https://example.com",
      }),
    ).toBe("");
  });
});

describe("QR rendering", () => {
  it("renders a crisp SVG symbol for Unicode text", () => {
    const svg = generateQrSvg("DevSmith 日本語", {
      errorCorrectionLevel: "M",
      width: 256,
      margin: 2,
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('fill="#171c19"');
    expect(svg).toContain("<rect");
    expect(qrSvgDataUrl(svg)).toMatch(/^data:image\/svg\+xml/);
  });

  it("describes payload size in characters and bytes", () => {
    expect(describeQrPayload("あ")).toBe("1文字 · 3 bytes");
  });
});
