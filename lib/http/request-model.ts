export type HttpBodyType = "json" | "form" | "raw" | "none";

export type HttpPair = {
  key: string;
  value: string;
};

export type HttpRequestModel = {
  method: string;
  url: string;
  query: HttpPair[];
  headers: HttpPair[];
  body: string;
  bodyType: HttpBodyType;
};

export const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

export function emptyHttpRequest(): HttpRequestModel {
  return {
    method: "GET",
    url: "https://example.com/api/users",
    query: [],
    headers: [],
    body: "",
    bodyType: "none",
  };
}

export function headerValue(headers: HttpPair[], name: string) {
  const match = headers.find((header) => header.key.toLowerCase() === name.toLowerCase());
  return match?.value ?? "";
}

export function upsertHeader(headers: HttpPair[], name: string, value: string) {
  const index = headers.findIndex((header) => header.key.toLowerCase() === name.toLowerCase());
  if (index === -1) return [...headers, { key: name, value }];
  return headers.map((header, itemIndex) => (itemIndex === index ? { ...header, value } : header));
}

export function resolvedRequestUrl(model: HttpRequestModel) {
  const trimmed = model.url.trim();
  if (!trimmed) throw new Error("Invalid URL\nURLが空です。");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL\n絶対URLを入力してください。例: https://example.com/api");
  }
  for (const pair of model.query) {
    if (!pair.key) continue;
    url.searchParams.append(pair.key, pair.value);
  }
  return url.toString();
}

export function parseUrlIntoRequest(input: string): HttpRequestModel {
  const parsed = new URL(input.trim());
  const query = [...parsed.searchParams.entries()].map(([key, value]) => ({ key, value }));
  parsed.search = "";
  return {
    ...emptyHttpRequest(),
    url: parsed.toString(),
    query,
  };
}

export function inferBodyType(headers: HttpPair[], body: string): HttpBodyType {
  if (!body.trim()) return "none";
  const contentType = headerValue(headers, "content-type").toLowerCase();
  if (contentType.includes("application/json")) return "json";
  if (contentType.includes("application/x-www-form-urlencoded")) return "form";
  try {
    JSON.parse(body);
    return "json";
  } catch {
    return contentType.includes("form") ? "form" : "raw";
  }
}
