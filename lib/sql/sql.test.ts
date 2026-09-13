import { describe, expect, it } from "vitest";
import { formatDuckDbSql, minifyDuckDbSql } from "./formatter";
import { formatSqlEngineError } from "./errors";
import { sanitizeTableName } from "./identifiers";
import { sqlSampleTables } from "./samples";
import { sqlExercises } from "./exercises";
import { compareSqlResults, stringifySqlCell } from "./results";

function parseSample(csv: string) {
  const [headerLine, ...lines] = csv.split("\n");
  const headers = headerLine.split(",");
  return lines.filter(Boolean).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

describe("SQL identifiers", () => {
  it("sanitizes file names and avoids collisions", () => {
    const used = new Set<string>();
    expect(sanitizeTableName("customers.csv", used)).toBe("customers");
    expect(sanitizeTableName("customers.csv", used)).toBe("customers_2");
    expect(sanitizeTableName("123-orders.csv", used)).toBe("t_123_orders");
  });
});

describe("SQL formatter", () => {
  it("formats DuckDB SQL clauses", () => {
    const formatted = formatDuckDbSql("select name,amount from customers c join orders o on c.id=o.customer_id where amount>1");
    expect(formatted).toContain("SELECT");
    expect(formatted).toContain("\nFROM");
    expect(formatted).toContain("\nJOIN");
    expect(formatted).toContain("\nWHERE");
  });

  it("minifies SQL while keeping strings", () => {
    expect(minifyDuckDbSql("SELECT   'a  b'  FROM   t")).toBe("SELECT 'a  b' FROM t");
  });
});

describe("SQL errors", () => {
  it("extracts missing column suggestions", () => {
    const error = formatSqlEngineError(
      'Binder Error: Referenced column "prices" not found in FROM clause!\nCandidate bindings: "products.price"\nLINE 3: SELECT prices',
    );
    expect(error.title).toBe("Query Error");
    expect(error.detail).toContain("Line 3");
    expect(error.suggestion).toBe("price");
  });
});

describe("SQL sample execution", () => {
  it("keeps beginner price filter in sync with sample products", () => {
    const products = parseSample(sqlSampleTables.products).map((row) => ({
      name: row.name,
      price: Number(row.price),
    }));
    const exercise = sqlExercises.find((item) => item.id === "select-price")!;
    const actual = products.filter((row) => row.price >= 1000);
    expect(compareSqlResults(actual, exercise.expected).equal).toBe(true);
  });

  it("keeps join totals in sync with customers and orders", () => {
    const customers = parseSample(sqlSampleTables.customers);
    const orders = parseSample(sqlSampleTables.orders);
    const totals = customers
      .map((customer) => {
        const total = orders
          .filter((order) => order.customer_id === customer.id)
          .reduce((sum, order) => sum + Number(order.amount), 0);
        return { name: customer.name, total };
      })
      .filter((row) => row.total > 0)
      .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
    const exercise = sqlExercises.find((item) => item.id === "join-totals")!;
    expect(compareSqlResults(totals, exercise.expected, { ordered: true }).equal).toBe(true);
  });

  it("compares result sets by values instead of SQL text", () => {
    expect(
      compareSqlResults(
        [{ Name: "Aki", total: 1 }],
        [{ name: "Aki", total: "1" }],
      ).equal,
    ).toBe(true);
    expect(stringifySqlCell(BigInt(10))).toBe("10");
  });
});
