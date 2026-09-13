export type CacheControlDirective = {
  name: string;
  value?: string;
  seconds?: number;
  human?: string;
  description: string;
};

const DESCRIPTIONS: Record<string, string> = {
  public: "共有キャッシュに保存できます",
  private: "ブラウザなど私的キャッシュのみに保存できます",
  "no-cache": "使う前に必ず再検証が必要です",
  "no-store": "キャッシュへ保存してはいけません",
  "no-transform": "プロキシが内容を変換してはいけません",
  "must-revalidate": "期限切れ後は再検証が必要です",
  "proxy-revalidate": "共有キャッシュは期限切れ後に再検証が必要です",
  immutable: "期限まで内容が変わらないとみなせます",
  "must-understand": "キャッシュは指令を理解できる場合のみ保存します",
  "max-age": "この秒数だけ fresh とみなします",
  "s-maxage": "共有キャッシュ向けの fresh 秒数です",
  "max-stale": "期限切れ後もこの秒数まで利用できます",
  "min-fresh": "少なくともこの秒数は fresh である応答が必要です",
  "stale-while-revalidate": "再検証中、この秒数だけ stale 応答を返せます",
  "stale-if-error": "エラー時、この秒数だけ stale 応答を返せます",
};

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "";
  const abs = Math.abs(seconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const rest = abs % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (rest || !parts.length) parts.push(`${rest} second${rest === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function parseCacheControl(input: string) {
  const raw = input.replace(/^cache-control:\s*/i, "").trim();
  if (!raw) return { ok: false as const, error: "Cache-Control が空です。" };
  const directives: CacheControlDirective[] = [];
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const eq = token.indexOf("=");
    const name = (eq === -1 ? token : token.slice(0, eq)).trim().toLowerCase();
    const value = eq === -1 ? undefined : token.slice(eq + 1).trim().replace(/^"|"$/g, "");
    const seconds = value !== undefined && /^\d+$/.test(value) ? Number(value) : undefined;
    directives.push({
      name,
      value,
      seconds,
      human: seconds !== undefined ? `${seconds} seconds = ${formatDuration(seconds)}` : undefined,
      description: DESCRIPTIONS[name] ?? "標準以外の指令です",
    });
  }
  if (!directives.length) return { ok: false as const, error: "有効な Cache-Control 指令がありません。" };
  return { ok: true as const, raw, directives };
}
