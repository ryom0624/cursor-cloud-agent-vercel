function csv(header: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [header.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
}

export const sqlSampleTables = {
  customers: csv(
    ["id", "name", "email", "city"],
    [
      [1, "Aki Tanaka", "aki@example.com", "Tokyo"],
      [2, "Mina Sato", "mina@example.com", "Osaka"],
      [3, "Ren Ito", "ren@example.com", "Nagoya"],
      [4, "Yui Mori", "yui@example.com", "Fukuoka"],
      [5, "Kai Nakamura", "kai@example.com", "Sapporo"],
      [6, "Hana Suzuki", "hana@example.com", "Tokyo"],
    ],
  ),
  orders: csv(
    ["id", "customer_id", "amount", "created_at"],
    [
      [101, 1, 12800, "2026-01-12"],
      [102, 1, 4200, "2026-02-03"],
      [103, 2, 8900, "2026-01-18"],
      [104, 3, 2100, "2026-03-01"],
      [105, 2, 15600, "2026-03-22"],
      [106, 6, 980, "2026-04-04"],
      [107, 4, 24000, "2026-04-19"],
      [108, 5, 6700, "2026-05-02"],
    ],
  ),
  products: csv(
    ["id", "name", "price", "category"],
    [
      [1, "Mechanical Keyboard", 12800, "Hardware"],
      [2, "USB-C Hub", 4200, "Hardware"],
      [3, "Monitor Arm", 8900, "Hardware"],
      [4, "Sticker Pack", 800, "Merch"],
      [5, "Notebook", 1200, "Merch"],
      [6, "Desk Mat", 3600, "Merch"],
      [7, "Noise Cancelling Headset", 21400, "Hardware"],
      [8, "Cable Sleeve", 980, "Hardware"],
    ],
  ),
  employees: csv(
    ["id", "name", "department", "salary"],
    [
      [1, "Aki Tanaka", "Platform", 8200000],
      [2, "Mina Sato", "Backend", 7600000],
      [3, "Ren Ito", "Design", 6900000],
      [4, "Yui Mori", "SRE", 8100000],
      [5, "Kai Nakamura", "Product", 7200000],
      [6, "Hana Suzuki", "Platform", 6400000],
    ],
  ),
  sales: csv(
    ["id", "employee_id", "product_id", "quantity", "sold_at"],
    [
      [1, 1, 1, 3, "2026-01-12"],
      [2, 2, 7, 1, "2026-01-18"],
      [3, 1, 2, 4, "2026-02-03"],
      [4, 3, 5, 10, "2026-02-11"],
      [5, 4, 3, 2, "2026-03-01"],
      [6, 5, 6, 5, "2026-03-22"],
      [7, 2, 1, 1, "2026-04-04"],
      [8, 6, 4, 20, "2026-04-19"],
      [9, 1, 7, 2, "2026-05-02"],
      [10, 4, 8, 6, "2026-05-08"],
    ],
  ),
} as const;

export type SqlSampleId = keyof typeof sqlSampleTables;

export const sqlSampleCatalog: Array<{
  id: SqlSampleId;
  label: string;
  description: string;
}> = [
  { id: "customers", label: "Customers", description: "顧客マスタ" },
  { id: "orders", label: "E-commerce Orders", description: "注文データ。customers と JOINできます" },
  { id: "products", label: "Products", description: "価格つき商品" },
  { id: "employees", label: "Employees", description: "部署と年収" },
  { id: "sales", label: "Sales", description: "社員と商品の売上" },
];

export const sqlJoinExample = `SELECT
  c.name,
  SUM(o.amount) AS total
FROM customers c
JOIN orders o
  ON c.id = o.customer_id
GROUP BY c.name
ORDER BY total DESC;`;
