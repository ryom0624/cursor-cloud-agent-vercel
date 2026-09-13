import { describe, expect, it } from "vitest";
import {
  diffOpenApi,
  operationToHttpRequest,
  parseOpenApi,
  sampleOpenApi,
} from "./openapi";

describe("OpenAPI parsing", () => {
  it("parses YAML endpoints and schemas", () => {
    const parsed = parseOpenApi(sampleOpenApi);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.document.title).toBe("DevSmith Users API");
    expect(parsed.document.operations.map((item) => `${item.method} ${item.path}`)).toEqual([
      "GET /users",
      "POST /users",
      "GET /users/{id}",
      "DELETE /users/{id}",
    ]);
    expect(parsed.document.schemas.map((item) => item.name)).toEqual(["User"]);
  });

  it("rejects swagger 2 and empty documents", () => {
    expect(parseOpenApi("").ok).toBe(false);
    expect(parseOpenApi("swagger: '2.0'\ninfo:\n  title: x\npaths: {}").ok).toBe(false);
  });

  it("builds an HTTP request model from an endpoint", () => {
    const parsed = parseOpenApi(sampleOpenApi);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const created = parsed.document.operations.find((item) => item.method === "POST")!;
    const request = operationToHttpRequest(parsed.document, created);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://api.example.com/users");
    expect(request.bodyType).toBe("json");
    expect(request.body).toContain("email");
  });

  it("diffs added, removed and changed endpoints plus schemas", () => {
    const before = parseOpenApi(sampleOpenApi);
    const after = parseOpenApi(`openapi: 3.0.3
info:
  title: DevSmith Users API
  version: 1.1.0
servers:
  - url: https://api.example.com
paths:
  /users:
    get:
      summary: List users
      responses:
        "200":
          description: OK
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
    get:
      summary: Get user
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        "200":
          description: OK
    delete:
      summary: Delete user
      responses:
        "204":
          description: No Content
  /health:
    get:
      summary: Health
      responses:
        "200":
          description: OK
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
`);
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    const diff = diffOpenApi(before.document, after.document);
    expect(diff.added.map((item) => `${item.method} ${item.path}`)).toEqual(["GET /health"]);
    expect(diff.changed.length).toBeGreaterThan(0);
    expect(diff.changedSchemas).toEqual(["User"]);
    const removedUsers = parseOpenApi(`openapi: 3.0.3
info:
  title: Empty
  version: 0.0.1
paths:
  /health:
    get:
      responses:
        "200":
          description: OK
`);
    expect(removedUsers.ok).toBe(true);
    if (!removedUsers.ok) return;
    const removed = diffOpenApi(before.document, removedUsers.document);
    expect(removed.removed.length).toBe(4);
    expect(removed.added.map((item) => item.path)).toEqual(["/health"]);
    expect(removed.removedSchemas).toEqual(["User"]);
  });
});
