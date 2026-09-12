import { parseCsv } from "./csv-utils";

export { parseCsv } from "./csv-utils";

export function csvToJson(input: string): string {
  const [headers, ...rows] = parseCsv(input);
  if (!headers) return "[]";
  const values = rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
  return JSON.stringify(values, null, 2);
}

function csvEscape(value: unknown): string {
  const text =
    typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function jsonToCsv(input: string): string {
  const parsed: unknown = JSON.parse(input);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const objects = items.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
  if (objects.length !== items.length) {
    throw new Error("JSONはオブジェクト、またはオブジェクトの配列にしてください。");
  }
  const headers = Array.from(
    new Set(objects.flatMap((item) => Object.keys(item))),
  );
  return [
    headers.map(csvEscape).join(","),
    ...objects.map((item) =>
      headers.map((header) => csvEscape(item[header])).join(","),
    ),
  ].join("\n");
}

export function encodeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function decodeBase64(input: string): string {
  const binary = atob(input.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

const htmlEncodeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function encodeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => htmlEncodeMap[char]);
}

export function decodeHtml(input: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    "#39": "'",
  };
  return input.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi,
    (match, entity: string) => {
      if (entity.toLowerCase().startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      }
      if (entity.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      }
      return entities[entity.toLowerCase()] ?? match;
    },
  );
}

export function decodeJwtPart(value: string): Record<string, unknown> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(decodeBase64(padded)) as Record<string, unknown>;
}

export function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateUlid(timestamp = Date.now()): string {
  let time = timestamp;
  let timePart = "";
  for (let index = 0; index < 10; index += 1) {
    timePart = crockford[time % 32] + timePart;
    time = Math.floor(time / 32);
  }
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  const randomPart = Array.from(random, (byte) => crockford[byte % 32])
    .join("")
    .slice(0, 16);
  return `${timePart}${randomPart}`;
}

export type DiffLine = {
  type: "same" | "added" | "removed";
  value: string;
};

export function diffLines(before: string, after: string): DiffLine[] {
  const left = before.split("\n");
  const right = after.split("\n");
  const table = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        left[i] === right[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      result.push({ type: "same", value: left[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ type: "removed", value: left[i] });
      i += 1;
    } else {
      result.push({ type: "added", value: right[j] });
      j += 1;
    }
  }
  while (i < left.length) result.push({ type: "removed", value: left[i++] });
  while (j < right.length) result.push({ type: "added", value: right[j++] });
  return result;
}

export type TextCase =
  | "upper"
  | "lower"
  | "camel"
  | "pascal"
  | "snake"
  | "kebab";

function words(input: string): string[] {
  return input
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .trim()
    .split(/[\s_\-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

export function convertCase(input: string, target: TextCase): string {
  if (target === "upper") return input.toUpperCase();
  if (target === "lower") return input.toLowerCase();
  const values = words(input);
  if (target === "snake") return values.join("_");
  if (target === "kebab") return values.join("-");
  const pascal = values
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  if (target === "pascal") return pascal;
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function describeCron(expression: string): string {
  const common: Record<string, string> = {
    "* * * * *": "毎分",
    "0 * * * *": "毎時0分",
    "0 0 * * *": "毎日 0:00",
    "0 0 * * 0": "毎週日曜日 0:00",
    "0 0 1 * *": "毎月1日 0:00",
    "0 9 * * 1-5": "平日の 9:00",
  };
  if (common[expression.trim()]) return common[expression.trim()];
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return "5フィールドのCron式を入力してください";
  const [minute, hour, day, month, week] = fields;
  if (minute.startsWith("*/") && hour === "*" && day === "*" && month === "*" && week === "*") {
    return `${minute.slice(2)}分ごと`;
  }
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && day === "*" && month === "*" && week === "*") {
    return `毎日 ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  }
  return `Cron: ${expression.trim()}`;
}
