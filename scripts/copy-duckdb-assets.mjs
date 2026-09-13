import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules/@duckdb/duckdb-wasm/dist");
const dest = join(root, "public/duckdb");

mkdirSync(dest, { recursive: true });

const files = [
  "duckdb-mvp.wasm",
  "duckdb-eh.wasm",
  "duckdb-browser-mvp.worker.js",
  "duckdb-browser-eh.worker.js",
];

for (const file of files) {
  copyFileSync(join(source, file), join(dest, file));
}
