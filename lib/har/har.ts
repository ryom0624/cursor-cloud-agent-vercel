import { emptyHttpRequest, inferBodyType, type HttpRequestModel } from "../http/request-model";

export type HarHeader = { name: string; value: string };
export type HarQuery = { name: string; value: string };

export type HarEntryView = {
  index: number;
  method: string;
  url: string;
  host: string;
  path: string;
  status: number;
  statusText: string;
  size: number;
  duration: number;
  mimeType: string;
  requestHeaders: HarHeader[];
  responseHeaders: HarHeader[];
  query: HarQuery[];
  requestBody?: string;
  responseBodySize: number;
  timings: Record<string, number>;
  startedDateTime?: string;
  httpVersion?: string;
};

export type HarSummary = {
  requestCount: number;
  totalTransferred: number;
  totalDuration: number;
  errorCount: number;
  slowCount: number;
  largestSize: number;
  entries: HarEntryView[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function headerList(value: unknown): HarHeader[] {
  return asArray(value)
    .filter(isRecord)
    .map((item) => ({
      name: String(item.name ?? ""),
      value: String(item.value ?? ""),
    }))
    .filter((item) => item.name);
}

function queryList(value: unknown): HarQuery[] {
  return asArray(value)
    .filter(isRecord)
    .map((item) => ({
      name: String(item.name ?? ""),
      value: String(item.value ?? ""),
    }));
}

function timingMap(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => typeof item === "number")
      .map(([key, item]) => [key, item as number]),
  );
}

export function parseHar(input: string): { ok: true; summary: HarSummary } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Invalid HAR\nHARが空です。" };
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (error) {
    return {
      ok: false,
      error: `Invalid HAR\nJSONとして解析できません。${error instanceof Error ? error.message : ""}`,
    };
  }
  const log = isRecord(raw) && isRecord(raw.log) ? raw.log : isRecord(raw) ? raw : null;
  const entries = log ? asArray(log.entries) : [];
  if (!log || !entries.length && !(isRecord(log) && Array.isArray(log.entries))) {
    return { ok: false, error: "Invalid HAR\nlog.entries が見つかりません。" };
  }

  const views: HarEntryView[] = entries.filter(isRecord).map((entry, index) => {
    const request = isRecord(entry.request) ? entry.request : {};
    const response = isRecord(entry.response) ? entry.response : {};
    const content = isRecord(response.content) ? response.content : {};
    const url = String(request.url ?? "");
    let host = "";
    let path = url;
    try {
      const parsed = new URL(url);
      host = parsed.host;
      path = `${parsed.pathname}${parsed.search}`;
    } catch {
      // Keep the raw URL when it is not absolute.
    }
    const size = Number(content.size ?? response.bodySize ?? 0);
    const duration = Number(entry.time ?? 0);
    const postData = isRecord(request.postData) ? request.postData : undefined;
    return {
      index,
      method: String(request.method ?? "GET").toUpperCase(),
      url,
      host,
      path,
      status: Number(response.status ?? 0),
      statusText: String(response.statusText ?? ""),
      size: Number.isFinite(size) ? size : 0,
      duration: Number.isFinite(duration) ? duration : 0,
      mimeType: String(content.mimeType ?? ""),
      requestHeaders: headerList(request.headers),
      responseHeaders: headerList(response.headers),
      query: queryList(request.queryString),
      requestBody: postData ? String(postData.text ?? "") : undefined,
      responseBodySize: Number(response.bodySize ?? content.size ?? 0) || 0,
      timings: timingMap(entry.timings),
      startedDateTime: typeof entry.startedDateTime === "string" ? entry.startedDateTime : undefined,
      httpVersion: typeof request.httpVersion === "string" ? request.httpVersion : undefined,
    };
  });

  const totalTransferred = views.reduce(
    (total, entry) => total + Math.max(0, entry.size) + Math.max(0, entry.responseBodySize ? 0 : 0),
    0,
  ) || views.reduce((total, entry) => total + Math.max(0, entry.size), 0);

  return {
    ok: true,
    summary: {
      requestCount: views.length,
      totalTransferred,
      totalDuration: views.reduce((total, entry) => total + Math.max(0, entry.duration), 0),
      errorCount: views.filter((entry) => entry.status >= 400).length,
      slowCount: views.filter((entry) => entry.duration >= 1000).length,
      largestSize: views.reduce((max, entry) => Math.max(max, entry.size), 0),
      entries: views,
    },
  };
}

export type HarFilter = "all" | "slowest" | "largest" | "4xx" | "5xx";

export function filterHarEntries(entries: HarEntryView[], filter: HarFilter) {
  if (filter === "4xx") return entries.filter((entry) => entry.status >= 400 && entry.status < 500);
  if (filter === "5xx") return entries.filter((entry) => entry.status >= 500);
  if (filter === "slowest") return [...entries].sort((left, right) => right.duration - left.duration);
  if (filter === "largest") return [...entries].sort((left, right) => right.size - left.size);
  return entries;
}

export function harEntryToHttpRequest(entry: HarEntryView): HttpRequestModel {
  let url = entry.url;
  const query = entry.query.map((item) => ({ key: item.name, value: item.value }));
  try {
    const parsed = new URL(entry.url);
    parsed.search = "";
    url = parsed.toString();
  } catch {
    // Keep the original URL.
  }
  const headers = entry.requestHeaders
    .filter((header) => !["host", "content-length"].includes(header.name.toLowerCase()))
    .map((header) => ({ key: header.name, value: header.value }));
  const body = entry.requestBody ?? "";
  return {
    ...emptyHttpRequest(),
    method: entry.method,
    url,
    query,
    headers,
    body,
    bodyType: inferBodyType(headers, body),
  };
}

export const sampleHar = JSON.stringify(
  {
    log: {
      version: "1.2",
      creator: { name: "DevSmith", version: "0.1.0" },
      entries: [
        {
          startedDateTime: "2026-09-13T07:00:00.000Z",
          time: 42,
          request: {
            method: "GET",
            url: "https://api.example.com/users?page=1",
            httpVersion: "HTTP/1.1",
            headers: [
              { name: "Accept", value: "application/json" },
            ],
            queryString: [{ name: "page", value: "1" }],
          },
          response: {
            status: 200,
            statusText: "OK",
            headers: [{ name: "Content-Type", value: "application/json" }],
            content: { size: 128, mimeType: "application/json" },
            bodySize: 128,
          },
          timings: { send: 1, wait: 38, receive: 3 },
        },
        {
          startedDateTime: "2026-09-13T07:00:01.000Z",
          time: 1280,
          request: {
            method: "POST",
            url: "https://api.example.com/users",
            headers: [
              { name: "Content-Type", value: "application/json" },
              { name: "Authorization", value: "Bearer token" },
            ],
            postData: { mimeType: "application/json", text: '{"name":"Dev"}' },
            queryString: [],
          },
          response: {
            status: 500,
            statusText: "Error",
            headers: [],
            content: { size: 64, mimeType: "application/json" },
            bodySize: 64,
          },
          timings: { send: 2, wait: 1260, receive: 18 },
        },
        {
          startedDateTime: "2026-09-13T07:00:02.000Z",
          time: 210,
          request: {
            method: "GET",
            url: "https://cdn.example.com/app.js",
            headers: [],
            queryString: [],
          },
          response: {
            status: 404,
            statusText: "Not Found",
            headers: [],
            content: { size: 20480, mimeType: "text/javascript" },
            bodySize: 20480,
          },
          timings: { send: 1, wait: 180, receive: 29 },
        },
      ],
    },
  },
  null,
  2,
);
