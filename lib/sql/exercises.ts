import { sqlSampleTables } from "./samples";
import type { SqlResultRow } from "./results";

export type SqlExerciseLevel = "Beginner" | "Intermediate" | "Advanced";

export type SqlExercise = {
  id: string;
  level: SqlExerciseLevel;
  title: string;
  prompt: string;
  hint: string;
  tables: Array<keyof typeof sqlSampleTables>;
  starterSql: string;
  expected: SqlResultRow[];
  ordered?: boolean;
};

export const sqlExercises: SqlExercise[] = [
  {
    id: "select-price",
    level: "Beginner",
    title: "SELECT / WHERE",
    prompt: "価格が1000以上の商品の name と price を取得してください。",
    hint: "WHERE price >= 1000",
    tables: ["products"],
    starterSql: "SELECT name, price\nFROM products\n",
    expected: [
      { name: "Mechanical Keyboard", price: 12800 },
      { name: "USB-C Hub", price: 4200 },
      { name: "Monitor Arm", price: 8900 },
      { name: "Notebook", price: 1200 },
      { name: "Desk Mat", price: 3600 },
      { name: "Noise Cancelling Headset", price: 21400 },
    ],
  },
  {
    id: "order-limit",
    level: "Beginner",
    title: "ORDER BY / LIMIT",
    prompt: "顧客を name の昇順で並べ、先頭3件の name を取得してください。",
    hint: "ORDER BY name LIMIT 3",
    tables: ["customers"],
    starterSql: "SELECT name\nFROM customers\n",
    ordered: true,
    expected: [
      { name: "Aki Tanaka" },
      { name: "Hana Suzuki" },
      { name: "Kai Nakamura" },
    ],
  },
  {
    id: "group-having",
    level: "Intermediate",
    title: "GROUP BY / HAVING",
    prompt: "カテゴリごとの平均価格を求め、平均が3000より大きい category と avg_price を取得してください。",
    hint: "GROUP BY category HAVING AVG(price) > 3000",
    tables: ["products"],
    starterSql: "SELECT category, AVG(price) AS avg_price\nFROM products\n",
    expected: [{ category: "Hardware", avg_price: 9656 }],
  },
  {
    id: "join-totals",
    level: "Intermediate",
    title: "JOIN",
    prompt: "顧客名ごとの注文合計 total を大きい順に取得してください。列は name, total です。",
    hint: "JOIN customers と orders。GROUP BY c.name ORDER BY total DESC",
    tables: ["customers", "orders"],
    starterSql: "SELECT c.name, SUM(o.amount) AS total\nFROM customers c\nJOIN orders o\n  ON c.id = o.customer_id\n",
    ordered: true,
    expected: [
      { name: "Mina Sato", total: 24500 },
      { name: "Yui Mori", total: 24000 },
      { name: "Aki Tanaka", total: 17000 },
      { name: "Kai Nakamura", total: 6700 },
      { name: "Ren Ito", total: 2100 },
      { name: "Hana Suzuki", total: 980 },
    ],
  },
  {
    id: "case-tier",
    level: "Intermediate",
    title: "CASE",
    prompt: "商品名と、price が 10000 以上なら premium、それ以外は standard という tier を取得してください。",
    hint: "CASE WHEN price >= 10000 THEN 'premium' ELSE 'standard' END",
    tables: ["products"],
    starterSql: "SELECT name, price,\n  CASE\n    WHEN price >= 10000 THEN 'premium'\n    ELSE 'standard'\n  END AS tier\nFROM products\n",
    expected: [
      { name: "Mechanical Keyboard", price: 12800, tier: "premium" },
      { name: "USB-C Hub", price: 4200, tier: "standard" },
      { name: "Monitor Arm", price: 8900, tier: "standard" },
      { name: "Sticker Pack", price: 800, tier: "standard" },
      { name: "Notebook", price: 1200, tier: "standard" },
      { name: "Desk Mat", price: 3600, tier: "standard" },
      { name: "Noise Cancelling Headset", price: 21400, tier: "premium" },
      { name: "Cable Sleeve", price: 980, tier: "standard" },
    ],
  },
  {
    id: "cte",
    level: "Advanced",
    title: "CTE",
    prompt: "CTE で顧客ごとの合計金額を作り、total が 10000 以上の name と total を取得してください。",
    hint: "WITH totals AS (SELECT ... GROUP BY ...) SELECT ... WHERE total >= 10000",
    tables: ["customers", "orders"],
    starterSql: `WITH totals AS (
  SELECT c.name, SUM(o.amount) AS total
  FROM customers c
  JOIN orders o ON c.id = o.customer_id
  GROUP BY c.name
)
SELECT name, total
FROM totals
`,
    expected: [
      { name: "Aki Tanaka", total: 17000 },
      { name: "Mina Sato", total: 24500 },
      { name: "Yui Mori", total: 24000 },
    ],
  },
  {
    id: "window",
    level: "Advanced",
    title: "Window Function",
    prompt: "部署ごとに給与が高い順の rank を付け、department, name, salary, rank を取得してください。",
    hint: "RANK() OVER (PARTITION BY department ORDER BY salary DESC)",
    tables: ["employees"],
    starterSql: `SELECT
  department,
  name,
  salary,
  RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS rank
FROM employees
`,
    expected: [
      { department: "Backend", name: "Mina Sato", salary: 7600000, rank: 1 },
      { department: "Design", name: "Ren Ito", salary: 6900000, rank: 1 },
      { department: "Platform", name: "Aki Tanaka", salary: 8200000, rank: 1 },
      { department: "Platform", name: "Hana Suzuki", salary: 6400000, rank: 2 },
      { department: "Product", name: "Kai Nakamura", salary: 7200000, rank: 1 },
      { department: "SRE", name: "Yui Mori", salary: 8100000, rank: 1 },
    ],
  },
  {
    id: "subquery",
    level: "Advanced",
    title: "Subquery",
    prompt: "平均価格より高い商品の name と price を取得してください。",
    hint: "WHERE price > (SELECT AVG(price) FROM products)",
    tables: ["products"],
    starterSql: "SELECT name, price\nFROM products\nWHERE price > (\n  SELECT AVG(price)\n  FROM products\n)\n",
    expected: [
      { name: "Mechanical Keyboard", price: 12800 },
      { name: "Monitor Arm", price: 8900 },
      { name: "Noise Cancelling Headset", price: 21400 },
    ],
  },
];
