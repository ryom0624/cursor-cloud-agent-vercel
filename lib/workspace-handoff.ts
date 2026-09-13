export const handoffKeys = {
  sqlTables: "devsmith:handoff:sql-tables",
  sqlTab: "devsmith:handoff:sql-tab",
  httpRequest: "devsmith:handoff:http-request",
  httpTab: "devsmith:handoff:http-tab",
  jwt: "devsmith:handoff:jwt",
  url: "devsmith:handoff:url",
  urlTab: "devsmith:handoff:url-tab",
} as const;

export type SqlTableHandoff = {
  name: string;
  csv: string;
};

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function setHandoff<T>(key: string, value: T) {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

export function takeHandoff<T>(key: string): T | null {
  if (!canUseSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(key);
  if (raw === null) return null;
  window.sessionStorage.removeItem(key);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setTextHandoff(key: string, value: string) {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(key, value);
}

export function takeTextHandoff(key: string) {
  if (!canUseSessionStorage()) return null;
  const value = window.sessionStorage.getItem(key);
  if (value === null) return null;
  window.sessionStorage.removeItem(key);
  return value;
}
