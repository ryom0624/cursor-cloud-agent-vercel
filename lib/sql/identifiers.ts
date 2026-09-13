const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteDuckDbIdent(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

export function sanitizeTableName(fileName: string, used: Set<string>) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const normalized = base
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  let candidate = IDENT.test(normalized) ? normalized : `t_${normalized}`;
  candidate = IDENT.test(candidate) ? candidate : "data";
  let unique = candidate;
  let index = 2;
  while (used.has(unique)) {
    unique = `${candidate}_${index}`;
    index += 1;
  }
  used.add(unique);
  return unique;
}

export function isSafeTableName(name: string) {
  return IDENT.test(name);
}
