export type ParsedUrl = {
  href: string;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  path: string;
  pathname: string;
  search: string;
  hash: string;
  fragment: string;
  origin: string;
  query: Array<{ key: string; value: string; raw: string; decoded: string }>;
};

export type UrlParseResult =
  | { ok: true; value: ParsedUrl }
  | { ok: false; error: string };

function decodeValue(value: string) {
  try {
    return decodeURIComponent(value.replaceAll("+", " "));
  } catch {
    return value;
  }
}

export function parseQueryString(input: string) {
  const search = input.startsWith("?") ? input.slice(1) : input;
  if (!search.trim()) return [] as Array<{ key: string; value: string; raw: string; decoded: string }>;
  return search.split("&").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    const rawKey = index === -1 ? part : part.slice(0, index);
    const raw = index === -1 ? "" : part.slice(index + 1);
    const key = decodeValue(rawKey.replaceAll("+", " "));
    const decoded = decodeValue(raw.replaceAll("+", " "));
    return {
      key,
      value: decoded,
      raw,
      decoded,
    };
  });
}

export function buildQueryString(
  pairs: Array<{ key: string; value: string }>,
  options: { includeQuestionMark?: boolean } = {},
) {
  const params = new URLSearchParams();
  for (const pair of pairs) {
    if (!pair.key) continue;
    params.append(pair.key, pair.value);
  }
  const query = params.toString();
  if (!query) return "";
  return options.includeQuestionMark === false ? query : `?${query}`;
}

export function parseUrl(input: string): UrlParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Invalid URL\nURLが空です。" };
  try {
    const url = new URL(trimmed);
    if (!url.protocol || !url.hostname) {
      return { ok: false, error: "Invalid URL\nホスト名を含む絶対URLを入力してください。" };
    }
    return {
      ok: true,
      value: {
        href: url.href,
        protocol: url.protocol.replace(/:$/, ""),
        username: url.username,
        password: url.password,
        host: url.host,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        fragment: url.hash.replace(/^#/, ""),
        origin: url.origin,
        query: parseQueryString(url.search),
      },
    };
  } catch {
    return {
      ok: false,
      error: "Invalid URL\n絶対URLとして解析できません。例: https://example.com:8443/api/users?page=2",
    };
  }
}

export function encodeUrlComponent(input: string) {
  return encodeURIComponent(input);
}

export function decodeUrlComponent(input: string) {
  try {
    return decodeURIComponent(input.replaceAll("+", " "));
  } catch {
    throw new Error("Invalid URL\nパーセントエンコードを復号できません。");
  }
}

export function buildUrl(parts: {
  protocol: string;
  hostname: string;
  port?: string;
  pathname?: string;
  query?: Array<{ key: string; value: string }>;
  fragment?: string;
}) {
  const protocol = parts.protocol.replace(/:?$/, "");
  if (!protocol || !parts.hostname) {
    throw new Error("Invalid URL\nProtocol と Host は必須です。");
  }
  const url = new URL(`${protocol}://${parts.hostname}`);
  if (parts.port) url.port = parts.port;
  url.pathname = parts.pathname || "/";
  url.search = buildQueryString(parts.query ?? [], { includeQuestionMark: false });
  url.hash = parts.fragment ? `#${parts.fragment.replace(/^#/, "")}` : "";
  return url.toString();
}
