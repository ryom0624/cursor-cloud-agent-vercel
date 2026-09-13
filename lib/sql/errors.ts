export type SqlEngineError = {
  title: string;
  detail: string;
  suggestion?: string;
  line?: number;
};

function uniqueSuggestions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function formatSqlEngineError(message: string): SqlEngineError {
  const lineMatch = message.match(/LINE\s+(\d+)/i);
  const columnMatch =
    message.match(/Referenced column "([^"]+)"/i) ||
    message.match(/column ["']([^"']+)["']/i) ||
    message.match(/Table ["']([^"']+)["'] does not exist/i);
  const candidates = uniqueSuggestions(
    [...message.matchAll(/Candidate bindings:\s*([^\n]+)/gi)].flatMap((match) =>
      [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1].split(".").pop() ?? item[1]),
    ),
  );
  const line = lineMatch ? Number(lineMatch[1]) : undefined;
  const title = message.startsWith("Parser Error")
    ? "Query Error"
    : message.startsWith("Binder Error")
      ? "Query Error"
      : message.startsWith("Invalid Input Error")
        ? "CSV Parse Error"
        : "Query Error";
  const firstLine = message.split("\n").find((item) => item.trim()) ?? message;
  const detail = line
    ? `Line ${line}: ${firstLine.replace(/^(Binder|Parser|Invalid Input) Error:\s*/i, "")}`
    : firstLine.replace(/^(Binder|Parser|Invalid Input) Error:\s*/i, "");

  return {
    title,
    detail,
    suggestion: candidates.length ? candidates.join(", ") : columnMatch ? undefined : undefined,
    line,
  };
}

export function describeSqlError(error: SqlEngineError) {
  const suggestion = error.suggestion ? `\n\nDid you mean:\n${error.suggestion}` : "";
  return `${error.title}\n${error.detail}${suggestion}`;
}
