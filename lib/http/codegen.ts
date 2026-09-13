import { headerValue, resolvedRequestUrl, type HttpRequestModel } from "./request-model";

export type HttpCodeTarget = "curl" | "fetch" | "axios" | "python" | "go";

function escapeShell(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function escapeJs(value: string) {
  return JSON.stringify(value);
}

function indentBlock(value: string, spaces = 2) {
  const pad = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

function headersObjectLiteral(model: HttpRequestModel) {
  if (!model.headers.length) return "";
  const entries = model.headers
    .filter((header) => header.key)
    .map((header) => `  ${escapeJs(header.key)}: ${escapeJs(header.value)},`)
    .join("\n");
  return `{\n${entries}\n}`;
}

function pythonDict(model: HttpRequestModel) {
  if (!model.headers.filter((header) => header.key).length) return "{}";
  return (
    "{\n" +
    model.headers
      .filter((header) => header.key)
      .map((header) => `    ${JSON.stringify(header.key)}: ${JSON.stringify(header.value)},`)
      .join("\n") +
    "\n}"
  );
}

function bodyForFetch(model: HttpRequestModel) {
  if (model.bodyType === "none" || !model.body) return "";
  if (model.bodyType === "json") {
    try {
      JSON.parse(model.body);
      return `JSON.stringify(${model.body})`;
    } catch {
      return escapeJs(model.body);
    }
  }
  return escapeJs(model.body);
}

export function generateCurl(model: HttpRequestModel) {
  const url = resolvedRequestUrl(model);
  const lines = [`curl --request ${model.method} ${escapeShell(url)}`];
  for (const header of model.headers.filter((item) => item.key)) {
    lines.push(`  --header ${escapeShell(`${header.key}: ${header.value}`)}`);
  }
  if (model.body && model.bodyType !== "none" && model.method !== "GET" && model.method !== "HEAD") {
    const flag = model.bodyType === "json" ? "--data-raw" : "--data";
    lines.push(`  ${flag} ${escapeShell(model.body)}`);
  }
  if (lines.length === 1) return lines[0];
  return `${lines[0]} \\\n${lines.slice(1).join(" \\\n")}`;
}

export function generateFetch(model: HttpRequestModel) {
  const url = resolvedRequestUrl(model);
  const options: string[] = [];
  if (model.method !== "GET") options.push(`method: ${escapeJs(model.method)}`);
  const headers = headersObjectLiteral(model);
  if (headers) options.push(`headers: ${headers}`);
  const body = bodyForFetch(model);
  if (body) options.push(`body: ${body}`);
  if (!options.length) return `await fetch(${escapeJs(url)});`;
  return `await fetch(${escapeJs(url)}, {\n${indentBlock(options.join(",\n"))}\n});`;
}

export function generateAxios(model: HttpRequestModel) {
  const url = resolvedRequestUrl(model);
  const method = model.method.toLowerCase();
  const headers = headersObjectLiteral(model);
  const configParts: string[] = [];
  if (headers) configParts.push(`headers: ${headers}`);
  const hasBody = Boolean(model.body) && model.bodyType !== "none" && !["GET", "HEAD"].includes(model.method);
  if (["get", "delete", "head", "options"].includes(method) && !hasBody) {
    if (!configParts.length) return `await axios.${method}(${escapeJs(url)});`;
    return `await axios.${method}(${escapeJs(url)}, {\n${indentBlock(configParts.join(",\n"))}\n});`;
  }
  let dataExpr = "null";
  if (hasBody) {
    if (model.bodyType === "json") {
      try {
        JSON.parse(model.body);
        dataExpr = model.body;
      } catch {
        dataExpr = escapeJs(model.body);
      }
    } else {
      dataExpr = escapeJs(model.body);
    }
  }
  if (!configParts.length) {
    return `await axios.${method}(${escapeJs(url)}, ${dataExpr});`;
  }
  return `await axios.${method}(${escapeJs(url)}, ${dataExpr}, {\n${indentBlock(configParts.join(",\n"))}\n});`;
}

export function generatePythonRequests(model: HttpRequestModel) {
  const url = resolvedRequestUrl(model);
  const method = model.method.toLowerCase();
  const lines = ["import requests", "", `url = ${JSON.stringify(url)}`];
  const headers = model.headers.filter((header) => header.key);
  if (headers.length) {
    lines.push(`headers = ${pythonDict(model)}`);
  }
  const args = ["url"];
  if (headers.length) args.push("headers=headers");
  if (model.body && model.bodyType !== "none" && !["GET", "HEAD"].includes(model.method)) {
    if (model.bodyType === "json") {
      try {
        JSON.parse(model.body);
        lines.push(`payload = ${model.body}`);
        args.push("json=payload");
      } catch {
        lines.push(`payload = ${JSON.stringify(model.body)}`);
        args.push("data=payload");
      }
    } else {
      lines.push(`payload = ${JSON.stringify(model.body)}`);
      args.push("data=payload");
    }
  }
  lines.push(`response = requests.${method}(${args.join(", ")})`);
  lines.push("print(response.status_code)");
  return lines.join("\n");
}

export function generateGo(model: HttpRequestModel) {
  const url = resolvedRequestUrl(model);
  const lines = [
    "package main",
    "",
    "import (",
    '  "fmt"',
    '  "io"',
    '  "net/http"',
    '  "strings"',
    ")",
    "",
    "func main() {",
  ];
  if (model.body && model.bodyType !== "none") {
    lines.push(`  body := strings.NewReader(${JSON.stringify(model.body)})`);
    lines.push(`  req, err := http.NewRequest(${JSON.stringify(model.method)}, ${JSON.stringify(url)}, body)`);
  } else {
    lines.push(`  req, err := http.NewRequest(${JSON.stringify(model.method)}, ${JSON.stringify(url)}, nil)`);
  }
  lines.push("  if err != nil {");
  lines.push("    panic(err)");
  lines.push("  }");
  for (const header of model.headers.filter((item) => item.key)) {
    lines.push(`  req.Header.Set(${JSON.stringify(header.key)}, ${JSON.stringify(header.value)})`);
  }
  if (!headerValue(model.headers, "content-type") && model.bodyType === "json") {
    lines.push(`  req.Header.Set("Content-Type", "application/json")`);
  }
  lines.push("  res, err := http.DefaultClient.Do(req)");
  lines.push("  if err != nil {");
  lines.push("    panic(err)");
  lines.push("  }");
  lines.push("  defer res.Body.Close()");
  lines.push("  data, _ := io.ReadAll(res.Body)");
  lines.push("  fmt.Println(res.Status)");
  lines.push("  fmt.Println(string(data))");
  lines.push("}");
  return lines.join("\n");
}

export function generateHttpCode(model: HttpRequestModel, target: HttpCodeTarget) {
  switch (target) {
    case "curl":
      return generateCurl(model);
    case "fetch":
      return generateFetch(model);
    case "axios":
      return generateAxios(model);
    case "python":
      return generatePythonRequests(model);
    case "go":
      return generateGo(model);
  }
}
