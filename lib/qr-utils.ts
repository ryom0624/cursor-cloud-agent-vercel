import { create } from "qrcode";

export type QrErrorCorrection = "L" | "M" | "Q" | "H";
export type QrWifiSecurity = "WPA" | "WEP" | "nopass";

export type QrRenderOptions = {
  errorCorrectionLevel: QrErrorCorrection;
  width: number;
  margin: number;
};

export type QrWifiFields = {
  ssid: string;
  password: string;
  security: QrWifiSecurity;
  hidden: boolean;
};

export type QrVCardFields = {
  name: string;
  org: string;
  phone: string;
  email: string;
  url: string;
};

export const qrInk = "#171c19";
export const qrPaper = "#fcfbf7";

export function escapeWifiValue(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export function buildWifiPayload(fields: QrWifiFields): string {
  const ssid = fields.ssid.trim();
  if (!ssid) return "";
  const security = fields.security;
  const password =
    security === "nopass" ? "" : `P:${escapeWifiValue(fields.password)};`;
  const hidden = fields.hidden ? "H:true;" : "";
  return `WIFI:T:${security};S:${escapeWifiValue(ssid)};${password}${hidden};`;
}

export function buildVCardPayload(fields: QrVCardFields): string {
  const name = fields.name.trim();
  if (!name) return "";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    fields.org.trim() ? `ORG:${fields.org.trim()}` : "",
    fields.phone.trim() ? `TEL:${fields.phone.trim()}` : "",
    fields.email.trim() ? `EMAIL:${fields.email.trim()}` : "",
    fields.url.trim() ? `URL:${fields.url.trim()}` : "",
    "END:VCARD",
  ];
  return lines.filter(Boolean).join("\n");
}

export function describeQrPayload(payload: string): string {
  const bytes = new TextEncoder().encode(payload).length;
  return `${payload.length}文字 · ${bytes} bytes`;
}

export function generateQrSvg(text: string, options: QrRenderOptions): string {
  const qr = create(text, {
    errorCorrectionLevel: options.errorCorrectionLevel,
  });
  const size = qr.modules.size;
  const margin = options.margin;
  const view = size + margin * 2;
  const cells: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.modules.get(row, col)) {
        cells.push(
          `<rect x="${col + margin}" y="${row + margin}" width="1" height="1"/>`,
        );
      }
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}" width="${options.width}" height="${options.width}" shape-rendering="crispEdges">`,
    `<rect width="100%" height="100%" fill="${qrPaper}"/>`,
    `<g fill="${qrInk}">${cells.join("")}</g>`,
    "</svg>",
  ].join("");
}

export function qrSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function svgToPngDataUrl(svg: string, size: number): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("PNGの書き出しに失敗しました。"));
    element.src = qrSvgDataUrl(svg);
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvasを初期化できませんでした。");
  context.drawImage(image, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

export function downloadBlob(content: BlobPart, filename: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
