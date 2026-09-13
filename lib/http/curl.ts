import {
  emptyHttpRequest,
  headerValue,
  inferBodyType,
  upsertHeader,
  type HttpPair,
  type HttpRequestModel,
} from "./request-model";

function tokenizeCurl(input: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  const push = () => {
    if (current.length > 0 || quote !== null) {
      tokens.push(current);
      current = "";
    }
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (quote === '"' && char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "\\" && (input[index + 1] === "\n" || input[index + 1] === "\r")) {
      if (input[index + 1] === "\r" && input[index + 2] === "\n") index += 2;
      else index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  push();
  return tokens;
}

const VALUE_FLAGS = new Map<string, string>([
  ["-X", "request"],
  ["--request", "request"],
  ["-H", "header"],
  ["--header", "header"],
  ["-d", "data"],
  ["--data", "data"],
  ["--data-raw", "data"],
  ["--data-binary", "data"],
  ["--data-ascii", "data"],
  ["--data-urlencode", "data-urlencode"],
  ["--json", "json"],
  ["-u", "user"],
  ["--user", "user"],
  ["-A", "user-agent"],
  ["--user-agent", "user-agent"],
  ["-b", "cookie"],
  ["--cookie", "cookie"],
  ["-e", "referer"],
  ["--referer", "referer"],
  ["--url", "url"],
  ["-F", "form"],
  ["--form", "form"],
]);

function splitFlag(token: string): { flag: string; inline?: string } {
  if (token.startsWith("--") && token.includes("=")) {
    const index = token.indexOf("=");
    return { flag: token.slice(0, index), inline: token.slice(index + 1) };
  }
  if (/^-[A-Za-z]$/.test(token.slice(0, 2)) && token.length > 2 && !token.startsWith("--")) {
    const flag = token.slice(0, 2);
    if (VALUE_FLAGS.has(flag)) return { flag, inline: token.slice(2) };
  }
  return { flag: token };
}

function parseHeader(value: string): HttpPair {
  const index = value.indexOf(":");
  if (index === -1) return { key: value.trim(), value: "" };
  return { key: value.slice(0, index).trim(), value: value.slice(index + 1).trim() };
}

export type CurlParseResult =
  | { ok: true; request: HttpRequestModel }
  | { ok: false; error: string };

export function parseCurl(input: string): CurlParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Invalid cURL\ncURLが空です。" };
  const tokens = tokenizeCurl(trimmed).filter((token) => token !== "\\");
  if (!tokens.length) return { ok: false, error: "Invalid cURL\ncURLを解析できませんでした。" };

  let offset = 0;
  if (tokens[0] === "curl") offset = 1;

  const request = emptyHttpRequest();
  request.url = "";
  const dataParts: string[] = [];
  let jsonMode = false;
  let getWithData = false;
  let head = false;

  const takeValue = (current: number, inline?: string) => {
    if (inline !== undefined) return { value: inline, next: current };
    const value = tokens[current + 1];
    if (value === undefined || value.startsWith("-")) {
      throw new Error("Invalid cURL\nフラグの値がありません。");
    }
    return { value, next: current + 1 };
  };

  try {
    for (let index = offset; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === "-G" || token === "--get") {
        getWithData = true;
        continue;
      }
      if (token === "-I" || token === "--head") {
        head = true;
        continue;
      }
      if (
        token === "-s" ||
        token === "--silent" ||
        token === "-k" ||
        token === "--insecure" ||
        token === "-L" ||
        token === "--location" ||
        token === "--compressed" ||
        token === "-i" ||
        token === "--include"
      ) {
        continue;
      }

      const { flag, inline } = splitFlag(token);
      const kind = VALUE_FLAGS.get(flag);
      if (kind) {
        const taken = takeValue(index, inline);
        index = taken.next;
        if (kind === "request") request.method = taken.value.toUpperCase();
        else if (kind === "header") request.headers.push(parseHeader(taken.value));
        else if (kind === "data") dataParts.push(taken.value);
        else if (kind === "data-urlencode") {
          const encoded = taken.value.includes("=")
            ? `${taken.value.slice(0, taken.value.indexOf("="))}=${encodeURIComponent(taken.value.slice(taken.value.indexOf("=") + 1))}`
            : encodeURIComponent(taken.value);
          dataParts.push(encoded);
        } else if (kind === "json") {
          jsonMode = true;
          dataParts.push(taken.value);
          request.headers = upsertHeader(request.headers, "Content-Type", "application/json");
          request.headers = upsertHeader(request.headers, "Accept", "application/json");
        } else if (kind === "user") {
          request.headers = upsertHeader(
            request.headers,
            "Authorization",
            `Basic ${btoa(taken.value)}`,
          );
        } else if (kind === "user-agent") {
          request.headers = upsertHeader(request.headers, "User-Agent", taken.value);
        } else if (kind === "cookie") {
          request.headers = upsertHeader(request.headers, "Cookie", taken.value);
        } else if (kind === "referer") {
          request.headers = upsertHeader(request.headers, "Referer", taken.value);
        } else if (kind === "url") {
          request.url = taken.value;
        } else if (kind === "form") {
          request.bodyType = "form";
          dataParts.push(taken.value);
          request.headers = upsertHeader(
            request.headers,
            "Content-Type",
            "application/x-www-form-urlencoded",
          );
        }
        continue;
      }

      if (token.startsWith("-")) {
        return { ok: false, error: `Invalid cURL\n未対応のフラグです: ${token}` };
      }
      if (!request.url) request.url = token;
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid cURL\n解析に失敗しました。",
    };
  }

  if (!request.url) return { ok: false, error: "Invalid cURL\nURLが見つかりません。" };

  try {
    const url = new URL(request.url);
    request.query = [...url.searchParams.entries()].map(([key, value]) => ({ key, value }));
    url.search = "";
    request.url = url.toString();
  } catch {
    return { ok: false, error: `Invalid cURL\nURLを解析できません: ${request.url}` };
  }

  const body = dataParts.join("&");
  if (head) request.method = "HEAD";
  if (getWithData && body) {
    request.method = "GET";
    const extra = new URL(request.url);
    const params = new URLSearchParams(body);
    params.forEach((value, key) => request.query.push({ key, value }));
    extra.search = "";
    request.url = extra.toString();
  } else if (body) {
    request.body = body;
    if (request.method === "GET") request.method = "POST";
    request.bodyType = jsonMode ? "json" : inferBodyType(request.headers, body);
    if (request.bodyType === "raw" && !headerValue(request.headers, "content-type")) {
      request.bodyType = "form";
    }
    if (request.bodyType === "json") {
      request.headers = upsertHeader(request.headers, "Content-Type", "application/json");
    } else if (request.bodyType === "form") {
      request.headers = upsertHeader(
        request.headers,
        "Content-Type",
        "application/x-www-form-urlencoded",
      );
    }
  }

  return { ok: true, request };
}
