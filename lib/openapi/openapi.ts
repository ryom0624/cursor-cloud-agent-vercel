import YAML from "yaml";
import {
  emptyHttpRequest,
  upsertHeader,
  type HttpRequestModel,
} from "../http/request-model";

export type OpenApiParameter = {
  name: string;
  in: "query" | "path" | "header" | "cookie" | string;
  required: boolean;
  description?: string;
  schema?: unknown;
  example?: unknown;
};

export type OpenApiOperation = {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: OpenApiParameter[];
  requestBody?: {
    required: boolean;
    contentType?: string;
    schema?: unknown;
    example?: unknown;
  };
  responses: Array<{
    status: string;
    description?: string;
    contentType?: string;
    schema?: unknown;
  }>;
};

export type OpenApiDocument = {
  raw: Record<string, unknown>;
  openapi: string;
  title: string;
  version: string;
  description?: string;
  servers: string[];
  operations: OpenApiOperation[];
  schemas: Array<{ name: string; schema: unknown }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveRef(root: Record<string, unknown>, value: unknown, seen = new Set<string>()): unknown {
  if (!isRecord(value) || typeof value.$ref !== "string") return value;
  const ref = value.$ref;
  if (!ref.startsWith("#/")) {
    throw new Error(`Invalid OpenAPI\nリモート $ref は解決しません: ${ref}`);
  }
  if (seen.has(ref)) return value;
  seen.add(ref);
  const parts = ref.slice(2).split("/");
  let current: unknown = root;
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      throw new Error(`Invalid OpenAPI\n$ref を解決できません: ${ref}`);
    }
    current = current[part];
  }
  return resolveRef(root, current, seen);
}

function exampleFromSchema(schema: unknown, root: Record<string, unknown>, depth = 0): unknown {
  const resolved = resolveRef(root, schema);
  if (!isRecord(resolved) || depth > 4) return {};
  if (resolved.example !== undefined) return resolved.example;
  if (Array.isArray(resolved.enum) && resolved.enum.length) return resolved.enum[0];
  const type = resolved.type;
  if (type === "string") return "string";
  if (type === "integer" || type === "number") return 0;
  if (type === "boolean") return true;
  if (type === "array") return [exampleFromSchema(resolved.items, root, depth + 1)];
  if (type === "object" || resolved.properties) {
    const properties = isRecord(resolved.properties) ? resolved.properties : {};
    return Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, exampleFromSchema(value, root, depth + 1)]),
    );
  }
  return null;
}

function firstContent(value: unknown) {
  if (!isRecord(value) || !isRecord(value.content)) return undefined;
  const entries = Object.entries(value.content);
  if (!entries.length) return undefined;
  const [contentType, media] = entries[0];
  const record = isRecord(media) ? media : {};
  return {
    contentType,
    schema: record.schema,
    example: record.example ?? (isRecord(record.examples) ? Object.values(record.examples)[0] : undefined),
  };
}

export function parseOpenApi(input: string): { ok: true; document: OpenApiDocument } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Invalid OpenAPI\nドキュメントが空です。" };
  let raw: unknown;
  try {
    raw = trimmed.startsWith("{") ? JSON.parse(trimmed) : YAML.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析に失敗しました。";
    return {
      ok: false,
      error: `Invalid OpenAPI\n${trimmed.startsWith("{") ? "JSON" : "YAML"} を解析できません。${message}`,
    };
  }
  if (!isRecord(raw)) return { ok: false, error: "Invalid OpenAPI\nオブジェクトではありません。" };
  const openapi = typeof raw.openapi === "string" ? raw.openapi : "";
  if (!openapi.startsWith("3.")) {
    return { ok: false, error: "Invalid OpenAPI\nOpenAPI 3.x のドキュメントを入力してください。" };
  }
  const info = isRecord(raw.info) ? raw.info : {};
  const title = typeof info.title === "string" ? info.title : "";
  if (!title) return { ok: false, error: "Invalid OpenAPI\ninfo.title がありません。" };
  const paths = isRecord(raw.paths) ? raw.paths : null;
  if (!paths) return { ok: false, error: "Invalid OpenAPI\npaths がありません。" };

  const operations: OpenApiOperation[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isRecord(pathItem)) continue;
    const sharedParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
    for (const method of ["get", "post", "put", "patch", "delete", "head", "options", "trace"]) {
      const operation = pathItem[method];
      if (!isRecord(operation)) continue;
      const parameters = [...sharedParams, ...(Array.isArray(operation.parameters) ? operation.parameters : [])]
        .map((item) => resolveRef(raw, item))
        .filter(isRecord)
        .map((item) => ({
          name: String(item.name ?? ""),
          in: String(item.in ?? "query"),
          required: Boolean(item.required) || item.in === "path",
          description: typeof item.description === "string" ? item.description : undefined,
          schema: item.schema,
          example: item.example,
        }));
      const request = firstContent(operation.requestBody);
      const responses: OpenApiOperation["responses"] = [];
      if (isRecord(operation.responses)) {
        for (const [status, response] of Object.entries(operation.responses)) {
          const resolved = resolveRef(raw, response);
          const content = firstContent(resolved);
          responses.push({
            status,
            description: isRecord(resolved) && typeof resolved.description === "string" ? resolved.description : undefined,
            contentType: content?.contentType,
            schema: content?.schema,
          });
        }
      }
      operations.push({
        method: method.toUpperCase(),
        path,
        operationId: typeof operation.operationId === "string" ? operation.operationId : undefined,
        summary: typeof operation.summary === "string" ? operation.summary : undefined,
        description: typeof operation.description === "string" ? operation.description : undefined,
        tags: Array.isArray(operation.tags) ? operation.tags.map(String) : [],
        parameters,
        requestBody: isRecord(operation.requestBody)
          ? {
              required: Boolean(operation.requestBody.required),
              contentType: request?.contentType,
              schema: request?.schema,
              example: request?.example,
            }
          : undefined,
        responses,
      });
    }
  }

  const schemaMap = isRecord(raw.components) && isRecord(raw.components.schemas) ? raw.components.schemas : {};
  return {
    ok: true,
    document: {
      raw,
      openapi,
      title,
      version: typeof info.version === "string" ? info.version : "",
      description: typeof info.description === "string" ? info.description : undefined,
      servers: Array.isArray(raw.servers)
        ? raw.servers.filter(isRecord).map((server) => String(server.url ?? "")).filter(Boolean)
        : [],
      operations,
      schemas: Object.entries(schemaMap).map(([name, schema]) => ({ name, schema })),
    },
  };
}

function parameterExample(parameter: OpenApiParameter, root: Record<string, unknown>) {
  if (parameter.example !== undefined) return String(parameter.example);
  const example = exampleFromSchema(parameter.schema, root);
  return example === null || example === undefined ? `{${parameter.name}}` : String(example);
}

export function operationToHttpRequest(
  document: OpenApiDocument,
  operation: OpenApiOperation,
): HttpRequestModel {
  const server = document.servers[0] || "https://api.example.com";
  let path = operation.path;
  const query: HttpRequestModel["query"] = [];
  let headers: HttpRequestModel["headers"] = [];
  for (const parameter of operation.parameters) {
    const value = parameterExample(parameter, document.raw);
    if (parameter.in === "path") path = path.replaceAll(`{${parameter.name}}`, encodeURIComponent(value));
    if (parameter.in === "query") query.push({ key: parameter.name, value });
    if (parameter.in === "header") headers.push({ key: parameter.name, value });
  }
  const url = `${server.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  let body = "";
  let bodyType: HttpRequestModel["bodyType"] = "none";
  if (operation.requestBody) {
    const example =
      operation.requestBody.example ??
      exampleFromSchema(operation.requestBody.schema, document.raw);
    if (operation.requestBody.contentType?.includes("json") || typeof example === "object") {
      bodyType = "json";
      body = JSON.stringify(example ?? {}, null, 2);
      headers = upsertHeader(headers, "Content-Type", operation.requestBody.contentType || "application/json");
    } else {
      bodyType = "raw";
      body = String(example ?? "");
    }
  }
  return {
    ...emptyHttpRequest(),
    method: operation.method,
    url,
    query,
    headers,
    body,
    bodyType,
  };
}

export type OpenApiDiff = {
  added: OpenApiOperation[];
  removed: OpenApiOperation[];
  changed: Array<{ before: OpenApiOperation; after: OpenApiOperation; reasons: string[] }>;
  addedSchemas: string[];
  removedSchemas: string[];
  changedSchemas: string[];
};

function operationKey(operation: OpenApiOperation) {
  return `${operation.method} ${operation.path}`;
}

function summarizeOperation(operation: OpenApiOperation) {
  return JSON.stringify({
    parameters: operation.parameters,
    requestBody: operation.requestBody,
    responses: operation.responses.map((item) => ({
      status: item.status,
      contentType: item.contentType,
      schema: item.schema,
    })),
  });
}

export function diffOpenApi(before: OpenApiDocument, after: OpenApiDocument): OpenApiDiff {
  const beforeOps = new Map(before.operations.map((item) => [operationKey(item), item]));
  const afterOps = new Map(after.operations.map((item) => [operationKey(item), item]));
  const added: OpenApiOperation[] = [];
  const removed: OpenApiOperation[] = [];
  const changed: OpenApiDiff["changed"] = [];
  for (const [key, operation] of afterOps) {
    const previous = beforeOps.get(key);
    if (!previous) added.push(operation);
    else if (summarizeOperation(previous) !== summarizeOperation(operation)) {
      const reasons: string[] = [];
      if (JSON.stringify(previous.parameters) !== JSON.stringify(operation.parameters)) {
        reasons.push("parameters");
      }
      if (JSON.stringify(previous.requestBody) !== JSON.stringify(operation.requestBody)) {
        reasons.push("requestBody");
      }
      if (JSON.stringify(previous.responses) !== JSON.stringify(operation.responses)) {
        reasons.push("responses");
      }
      changed.push({ before: previous, after: operation, reasons: reasons.length ? reasons : ["definition"] });
    }
  }
  for (const [key, operation] of beforeOps) {
    if (!afterOps.has(key)) removed.push(operation);
  }

  const beforeSchemas = new Map(before.schemas.map((item) => [item.name, JSON.stringify(item.schema)]));
  const afterSchemas = new Map(after.schemas.map((item) => [item.name, JSON.stringify(item.schema)]));
  return {
    added,
    removed,
    changed,
    addedSchemas: [...afterSchemas.keys()].filter((name) => !beforeSchemas.has(name)),
    removedSchemas: [...beforeSchemas.keys()].filter((name) => !afterSchemas.has(name)),
    changedSchemas: [...afterSchemas.keys()].filter(
      (name) => beforeSchemas.has(name) && beforeSchemas.get(name) !== afterSchemas.get(name),
    ),
  };
}

export const sampleOpenApi = `openapi: 3.0.3
info:
  title: DevSmith Users API
  version: 1.0.0
  description: Local sample for Endpoint Explorer
servers:
  - url: https://api.example.com
paths:
  /users:
    get:
      summary: List users
      parameters:
        - in: query
          name: page
          schema:
            type: integer
          example: 1
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/User"
    post:
      summary: Create user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/User"
      responses:
        "201":
          description: Created
  /users/{id}:
    parameters:
      - in: path
        name: id
        required: true
        schema:
          type: string
        example: usr_1
    get:
      summary: Get user
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
    delete:
      summary: Delete user
      responses:
        "204":
          description: No Content
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        email:
          type: string
`;
