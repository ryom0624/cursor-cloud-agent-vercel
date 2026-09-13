const KEYWORDS = new Set(
  [
    "select", "from", "where", "and", "or", "not", "as", "join", "left", "right",
    "inner", "full", "outer", "cross", "on", "using", "group", "by", "having",
    "order", "limit", "offset", "union", "all", "except", "intersect", "with",
    "recursive", "case", "when", "then", "else", "end", "insert", "into", "values",
    "update", "set", "delete", "create", "table", "view", "distinct", "over",
    "partition", "window", "qualify", "returning", "exists", "in", "is", "null",
    "like", "ilike", "between", "true", "false", "asc", "desc", "nulls", "first",
    "last",
  ],
);

type Token = {
  type: "word" | "string" | "number" | "punct" | "space" | "comment";
  value: string;
};

function tokenizeSql(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    const next = input[index + 1];

    if (char === "-" && next === "-") {
      let value = "";
      while (index < input.length && input[index] !== "\n") {
        value += input[index];
        index += 1;
      }
      tokens.push({ type: "comment", value });
      continue;
    }

    if (char === "/" && next === "*") {
      let value = "/*";
      index += 2;
      while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) {
        value += input[index];
        index += 1;
      }
      value += "*/";
      index += 2;
      tokens.push({ type: "comment", value });
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      let value = char;
      index += 1;
      while (index < input.length) {
        value += input[index];
        if (input[index] === quote) {
          if (input[index + 1] === quote) {
            value += input[index + 1];
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      tokens.push({ type: "string", value });
      continue;
    }

    if (/\s/.test(char)) {
      let value = "";
      while (index < input.length && /\s/.test(input[index])) {
        value += input[index];
        index += 1;
      }
      tokens.push({ type: "space", value });
      continue;
    }

    if (/[0-9]/.test(char)) {
      let value = "";
      while (index < input.length && /[0-9.]/.test(input[index])) {
        value += input[index];
        index += 1;
      }
      tokens.push({ type: "number", value });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let value = "";
      while (index < input.length && /[A-Za-z0-9_]/.test(input[index])) {
        value += input[index];
        index += 1;
      }
      tokens.push({ type: "word", value });
      continue;
    }

    tokens.push({ type: "punct", value: char });
    index += 1;
  }

  return tokens;
}

function clauseBreak(previous: string, current: string, following: string) {
  const pair = `${current} ${following}`.toLowerCase();
  if (
    pair === "group by" ||
    pair === "order by" ||
    pair === "partition by" ||
    pair === "union all" ||
    pair === "left join" ||
    pair === "right join" ||
    pair === "inner join" ||
    pair === "outer join" ||
    pair === "cross join" ||
    pair === "full join"
  ) {
    return "pair";
  }
  const word = current.toLowerCase();
  if (
    word === "select" ||
    word === "from" ||
    word === "where" ||
    word === "having" ||
    word === "limit" ||
    word === "offset" ||
    word === "join" ||
    word === "union" ||
    word === "except" ||
    word === "intersect" ||
    word === "with" ||
    word === "qualify" ||
    word === "window" ||
    (word === "on" && previous.toLowerCase() !== "so")
  ) {
    return "single";
  }
  return "";
}

export function formatDuckDbSql(input: string) {
  const tokens = tokenizeSql(input.trim());
  if (!tokens.length) return "";
  let output = "";
  let indent = 0;
  let pendingNewline = false;

  const significant = tokens.filter((token) => token.type !== "space" && token.type !== "comment");

  for (let index = 0; index < significant.length; index += 1) {
    const token = significant[index];
    const previous = significant[index - 1]?.value ?? "";
    const next = significant[index + 1]?.value ?? "";
    const breakKind = token.type === "word" ? clauseBreak(previous, token.value, next) : "";

    if (token.value === ")") {
      indent = Math.max(0, indent - 1);
      pendingNewline = true;
    }

    if (breakKind || pendingNewline) {
      output = output.trimEnd();
      output += `\n${"  ".repeat(indent)}`;
      pendingNewline = false;
    } else if (
      output &&
      !/[(\s]$/.test(output) &&
      token.value !== "," &&
      token.value !== ")" &&
      previous !== "(" &&
      previous !== "."
    ) {
      output += " ";
    }

    if (token.type === "word" && KEYWORDS.has(token.value.toLowerCase())) {
      output += token.value.toUpperCase();
    } else {
      output += token.value;
    }

    if (token.value === "(") {
      indent += 1;
      pendingNewline = true;
    }
    if (token.value === ",") pendingNewline = true;
    if (breakKind === "pair") {
      const following = significant[index + 1];
      if (following) {
        output += ` ${following.type === "word" ? following.value.toUpperCase() : following.value}`;
        index += 1;
      }
    }
  }

  return `${output.trim()}\n`;
}

export function minifyDuckDbSql(input: string) {
  const tokens = tokenizeSql(input.trim()).filter((token) => token.type !== "comment");
  let output = "";
  for (const token of tokens) {
    if (token.type === "space") {
      if (output && !output.endsWith(" ") && !output.endsWith("(")) output += " ";
      continue;
    }
    if (token.value === "," || token.value === ")" || token.value === ";") {
      output = output.trimEnd();
    }
    if (token.value === "(" && output.endsWith(" ")) {
      output = output.trimEnd();
    }
    output += token.type === "word" && KEYWORDS.has(token.value.toLowerCase())
      ? token.value.toUpperCase()
      : token.value;
  }
  return output.trim();
}
