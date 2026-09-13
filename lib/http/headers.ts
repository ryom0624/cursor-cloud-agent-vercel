export type ParsedHeader = {
  key: string;
  value: string;
};

export type CookiePair = {
  name: string;
  value: string;
};

export type ContentTypeInfo = {
  mediaType: string;
  charset?: string;
  boundary?: string;
  extras: Array<{ key: string; value: string }>;
};

export type AuthorizationInfo = {
  scheme: string;
  token: string;
  isJwt: boolean;
  basicUser?: string;
  basicPassword?: string;
  jwtHeader?: Record<string, unknown>;
  jwtPayload?: Record<string, unknown>;
};

export type HeaderParseResult =
  | {
      ok: true;
      headers: ParsedHeader[];
      contentType?: ContentTypeInfo;
      cookies: CookiePair[];
      authorization?: AuthorizationInfo;
      cacheControl?: string;
    }
  | { ok: false; error: string };

function decodeBase64Utf8(input: string) {
  const binary = atob(input.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function decodeJwtPart(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(decodeBase64Utf8(padded)) as Record<string, unknown>;
}

function looksLikeJwt(token: string) {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+={0,2}$/.test(part));
}

export function parseContentType(value: string): ContentTypeInfo {
  const [mediaType, ...params] = value.split(";").map((item) => item.trim()).filter(Boolean);
  const extras: Array<{ key: string; value: string }> = [];
  let charset: string | undefined;
  let boundary: string | undefined;
  for (const param of params) {
    const index = param.indexOf("=");
    if (index === -1) continue;
    const key = param.slice(0, index).trim().toLowerCase();
    const raw = param.slice(index + 1).trim().replace(/^"|"$/g, "");
    if (key === "charset") charset = raw;
    else if (key === "boundary") boundary = raw;
    else extras.push({ key, value: raw });
  }
  return { mediaType, charset, boundary, extras };
}

export function parseCookieHeader(value: string): CookiePair[] {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      if (index === -1) return { name: part, value: "" };
      return { name: part.slice(0, index).trim(), value: part.slice(index + 1).trim() };
    });
}

export function inspectAuthorization(value: string): AuthorizationInfo {
  const [scheme, ...rest] = value.trim().split(/\s+/);
  const token = rest.join(" ");
  const info: AuthorizationInfo = {
    scheme: scheme || "Unknown",
    token,
    isJwt: false,
  };
  if (/^bearer$/i.test(scheme) && looksLikeJwt(token)) {
    info.isJwt = true;
    try {
      const [header, payload] = token.split(".");
      info.jwtHeader = decodeJwtPart(header);
      info.jwtPayload = decodeJwtPart(payload);
    } catch {
      info.isJwt = true;
    }
  }
  if (/^basic$/i.test(scheme) && token) {
    try {
      const decoded = decodeBase64Utf8(token);
      const index = decoded.indexOf(":");
      info.basicUser = index === -1 ? decoded : decoded.slice(0, index);
      info.basicPassword = index === -1 ? "" : decoded.slice(index + 1);
    } catch {
      // Keep the raw token when decoding fails.
    }
  }
  return info;
}

export function parseRawHeaders(input: string): HeaderParseResult {
  const trimmed = input.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { ok: false, error: "Invalid headers\nヘッダーが空です。" };
  const lines = trimmed.split(/\r?\n/);
  const headers: ParsedHeader[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (/^\s/.test(line) && headers.length) {
      headers[headers.length - 1].value += ` ${line.trim()}`;
      continue;
    }
    const index = line.indexOf(":");
    if (index === -1) {
      return {
        ok: false,
        error: `Invalid headers\nコロン区切りの Key: Value 形式ではありません: ${line}`,
      };
    }
    headers.push({
      key: line.slice(0, index).trim(),
      value: line.slice(index + 1).trim(),
    });
  }
  if (!headers.length) return { ok: false, error: "Invalid headers\n有効なヘッダーがありません。" };

  const contentTypeHeader = headers.find((header) => header.key.toLowerCase() === "content-type");
  const cookieHeader = headers.find((header) => header.key.toLowerCase() === "cookie");
  const authorizationHeader = headers.find((header) => header.key.toLowerCase() === "authorization");
  const cacheControlHeader = headers.find((header) => header.key.toLowerCase() === "cache-control");

  return {
    ok: true,
    headers,
    contentType: contentTypeHeader ? parseContentType(contentTypeHeader.value) : undefined,
    cookies: cookieHeader ? parseCookieHeader(cookieHeader.value) : [],
    authorization: authorizationHeader ? inspectAuthorization(authorizationHeader.value) : undefined,
    cacheControl: cacheControlHeader?.value,
  };
}
